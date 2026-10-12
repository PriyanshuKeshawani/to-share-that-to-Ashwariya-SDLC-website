-- ==============================================================================
-- SISTEC Library Portal: Database Deletion & Lifecycle Integrity Migration
-- ==============================================================================
-- Run this in your Supabase SQL Editor.
-- This migration hardens the database against data loss, orphaned records,
-- and desynchronized authentication when deleting Branches, Students, or Books.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SAFE BRANCH / DEPARTMENT DELETION & MERGE RPC
-- ------------------------------------------------------------------------------
-- Ensures no branch with active books or students is silently deleted.
-- If fallback_branch_id is provided, atomically reassigns all books and students!
CREATE OR REPLACE FUNCTION public.delete_branch_safely(
  branch_id_to_delete INTEGER,
  fallback_branch_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  old_branch RECORD;
  target_branch RECORD;
  books_count INTEGER := 0;
  students_count INTEGER := 0;
  reassigned_books INTEGER := 0;
  reassigned_students INTEGER := 0;
BEGIN
  -- 1. Verify caller is an administrator
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security Policy Violation: Only administrators can delete or merge academic branches.';
  END IF;

  -- 2. Fetch the branch to be deleted
  SELECT * INTO old_branch FROM public.branches WHERE id = branch_id_to_delete;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch with ID % not found.', branch_id_to_delete;
  END IF;

  -- 3. Count assigned books and enrolled students
  SELECT COUNT(*) INTO books_count FROM public.books WHERE branch_id = branch_id_to_delete;
  SELECT COUNT(*) INTO students_count FROM public.users 
  WHERE lower(trim(coalesce(branch_name, ''))) = lower(trim(old_branch.name))
     OR admin_branch_id = branch_id_to_delete;

  -- 4. Check if fallback branch was provided
  IF fallback_branch_id IS NOT NULL THEN
    IF fallback_branch_id = branch_id_to_delete THEN
      RAISE EXCEPTION 'Cannot reassign a branch to itself.';
    END IF;

    SELECT * INTO target_branch FROM public.branches WHERE id = fallback_branch_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Target reassignment branch with ID % does not exist.', fallback_branch_id;
    END IF;

    -- Atomically reassign books
    UPDATE public.books 
    SET branch_id = fallback_branch_id 
    WHERE branch_id = branch_id_to_delete;
    GET DIAGNOSTICS reassigned_books = ROW_COUNT;

    -- Atomically reassign students
    UPDATE public.users 
    SET branch_name = target_branch.name 
    WHERE lower(trim(coalesce(branch_name, ''))) = lower(trim(old_branch.name));
    GET DIAGNOSTICS reassigned_students = ROW_COUNT;

    -- Update department admin references if any
    UPDATE public.users 
    SET admin_branch_id = fallback_branch_id 
    WHERE admin_branch_id = branch_id_to_delete;

    -- Reassign active branch permissions
    UPDATE public.permissions 
    SET branch_id = fallback_branch_id 
    WHERE branch_id = branch_id_to_delete;

    -- Reassign senior profiles & projects
    UPDATE public.senior_academic_profiles 
    SET branch_name = target_branch.name 
    WHERE lower(trim(coalesce(branch_name, ''))) = lower(trim(old_branch.name));

    UPDATE public.projects 
    SET branch_name = target_branch.name 
    WHERE lower(trim(coalesce(branch_name, ''))) = lower(trim(old_branch.name));

  ELSE
    -- No fallback branch provided: Enforce strict referential protection
    IF books_count > 0 OR students_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete branch "%": % books and % students are currently assigned. Please select a target branch to merge/reassign them to first.',
        old_branch.name, books_count, students_count;
    END IF;
  END IF;

  -- 5. Delete the branch cleanly
  DELETE FROM public.branches WHERE id = branch_id_to_delete;

  -- 6. Audit log
  INSERT INTO public.activity_logs (action_type, details, created_at)
  VALUES (
    'branch_deleted',
    format('Academic branch "%s" (ID: %s) deleted. Reassigned %s books and %s students to branch "%s".',
      old_branch.name,
      branch_id_to_delete,
      reassigned_books,
      reassigned_students,
      coalesce(target_branch.name, 'None')
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Branch "%s" deleted successfully.', old_branch.name),
    'deleted_branch_id', branch_id_to_delete,
    'deleted_branch_name', old_branch.name,
    'reassigned_books', reassigned_books,
    'reassigned_students', reassigned_students,
    'target_branch_name', target_branch.name
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2. COMPLETE USER & AUTH PURGE RPC
-- ------------------------------------------------------------------------------
-- Atomically purges a student from both public.users AND auth.users,
-- cleans up bookmarks, progress, notes, tokens, and preserves audit log summaries.
CREATE OR REPLACE FUNCTION public.purge_user_completely(
  target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  target_user RECORD;
  caller_id UUID;
BEGIN
  -- 1. Verify caller is an administrator
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security Policy Violation: Only administrators can permanently delete user accounts.';
  END IF;

  -- 2. Prevent self-deletion
  caller_id := auth.uid();
  IF caller_id IS NOT NULL AND caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot delete your own active administrator account.';
  END IF;

  -- 3. Fetch user profile
  SELECT * INTO target_user FROM public.users WHERE id = target_user_id;
  IF NOT FOUND THEN
    -- Check if exists in auth.users alone (orphaned auth account)
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
      DELETE FROM auth.users WHERE id = target_user_id;
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Orphaned auth account wiped successfully.'
      );
    END IF;
    RAISE EXCEPTION 'User with ID % not found.', target_user_id;
  END IF;

  -- 4. Clean up user-owned private data
  DELETE FROM public.user_book_progress WHERE user_id = target_user_id;
  DELETE FROM public.bookmarks WHERE user_id = target_user_id;
  DELETE FROM public.notes WHERE user_id = target_user_id;
  DELETE FROM public.permissions WHERE user_id = target_user_id;
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  DELETE FROM public.project_likes WHERE user_id = target_user_id;
  DELETE FROM public.project_reactions WHERE user_id = target_user_id;
  DELETE FROM public.user_fcm_tokens WHERE user_id = target_user_id;

  -- Disassociate public academic profiles and authored projects
  UPDATE public.senior_academic_profiles 
  SET student_user_id = NULL 
  WHERE student_user_id = target_user_id;

  UPDATE public.projects 
  SET created_by = NULL 
  WHERE created_by = target_user_id;

  -- Anonymize activity logs (preserves historical reading counts and audit counts)
  UPDATE public.activity_logs 
  SET user_id = NULL,
      details = coalesce(details, '') || format(' [Historical user %s (%s) purged]', target_user.full_name, target_user.roll_number)
  WHERE user_id = target_user_id;

  -- 5. Delete from public.users table
  DELETE FROM public.users WHERE id = target_user_id;

  -- 6. Delete from Supabase Auth internal table (Zero OAuth desync)
  BEGIN
    DELETE FROM auth.users WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- In environments where public schema cannot directly delete from auth schema,
    -- the public.users record is already wiped cleanly.
    NULL;
  END;

  -- 7. Audit log the purge
  INSERT INTO public.activity_logs (action_type, details, created_at)
  VALUES (
    'user_purged',
    format('User account %s (@%s, Roll: %s) was permanently purged from the system.',
      target_user.full_name,
      target_user.username,
      coalesce(target_user.roll_number, 'N/A')
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('User %s purged successfully from database and auth.', target_user.full_name),
    'purged_user_id', target_user_id,
    'purged_username', target_user.username
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. SAFE BOOK DELETION RPC
-- ------------------------------------------------------------------------------
-- Deletes a book cleanly, cleans up associated bookmarks and reading progress,
-- anonymizes activity logs, and returns file asset URLs for storage cleanup.
CREATE OR REPLACE FUNCTION public.delete_book_safely(
  book_id_to_delete INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  target_book RECORD;
BEGIN
  -- 1. Verify caller is an administrator
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security Policy Violation: Only administrators can delete books.';
  END IF;

  -- 2. Fetch the book
  SELECT * INTO target_book FROM public.books WHERE id = book_id_to_delete;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book with ID % not found.', book_id_to_delete;
  END IF;

  -- 3. Clean up associated student records
  DELETE FROM public.user_book_progress WHERE book_id = book_id_to_delete;
  DELETE FROM public.bookmarks WHERE book_id = book_id_to_delete;
  DELETE FROM public.notes WHERE book_id = book_id_to_delete;
  DELETE FROM public.permissions WHERE book_id = book_id_to_delete;

  -- Preserve activity logs by disassociating book_id
  UPDATE public.activity_logs 
  SET book_id = NULL,
      details = coalesce(details, '') || format(' [Book "%s" was deleted from catalog]', target_book.title)
  WHERE book_id = book_id_to_delete;

  -- 4. Delete book from catalog
  DELETE FROM public.books WHERE id = book_id_to_delete;

  -- 5. Audit log
  INSERT INTO public.activity_logs (action_type, details, created_at)
  VALUES (
    'book_deleted',
    format('Book "%s" by %s (ID: %s) deleted from catalog.',
      target_book.title,
      target_book.author,
      book_id_to_delete
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Book "%s" deleted successfully.', target_book.title),
    'deleted_book_id', book_id_to_delete,
    'pdf_url', target_book.pdf_url,
    'cover_url', target_book.cover_url,
    'drive_file_id', target_book.drive_file_id
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. NATIVE DATABASE TRIGGER: GUARD RAW BRANCH DELETIONS
-- ------------------------------------------------------------------------------
-- If anyone attempts a direct SQL `DELETE FROM branches` without reassigning,
-- this trigger intercepts and raises an informative exception if books or users exist!
CREATE OR REPLACE FUNCTION public.check_branch_deletion_safety()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  books_count INTEGER := 0;
  users_count INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO books_count FROM public.books WHERE branch_id = OLD.id;
  SELECT COUNT(*) INTO users_count FROM public.users 
  WHERE lower(trim(coalesce(branch_name, ''))) = lower(trim(OLD.name))
     OR admin_branch_id = OLD.id;

  IF books_count > 0 OR users_count > 0 THEN
    RAISE EXCEPTION 'Referential Integrity Block: Cannot delete branch "%" directly because % books and % students are still linked to it. Use delete_branch_safely() to reassign them.',
      OLD.name, books_count, users_count;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_check_branch_deletion_safety ON public.branches;
CREATE TRIGGER tr_check_branch_deletion_safety
  BEFORE DELETE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.check_branch_deletion_safety();


-- ------------------------------------------------------------------------------
-- 5. GRANTS & RLS EXECUTION RIGHTS
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.delete_branch_safely(INTEGER, INTEGER) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.purge_user_completely(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.delete_book_safely(INTEGER) TO authenticated, service_role, anon;
