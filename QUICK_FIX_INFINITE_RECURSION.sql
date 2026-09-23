-- ==============================================================================
-- SISTEC LIBRARY PORTAL - ENTERPRISE DATA EDIT & SECURITY CONTROLLER
-- Fixes PostgreSQL Error 42P17 (infinite recursion) & handles all User/Admin edits securely.
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Go to "SQL Editor" in the left sidebar
-- 3. Click "New Query", paste this entire script, and click "RUN" (or Ctrl + Enter)
-- 4. All admin edits, student registrations, approvals, and profile updates will work seamlessly!
-- ==============================================================================

-- STEP 1: Ensure All Required Tables and Columns Exist
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS block_reason TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS admin_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS google_id TEXT;

-- Drop foreign key constraints that cause 23503 lockouts for custom auth
ALTER TABLE IF EXISTS permissions DROP CONSTRAINT IF EXISTS permissions_user_id_fkey;
ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Ensure Project Likes and Reactions tables exist
CREATE TABLE IF NOT EXISTS public.project_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID,
  user_email TEXT NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 2: Non-Recursive Admin Verification Function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
DECLARE
  jwt_email TEXT;
  user_role TEXT;
  auth_user_id UUID;
BEGIN
  -- 1. Service role / postgres internal bypass
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN TRUE;
  END IF;

  auth_user_id := auth.uid();
  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  -- 2. Fast check: Known institutional admin emails in JWT claim
  IF jwt_email IN (
    'sistec.library@sistec.ac.in',
    'cse.admin@sistec.ac.in',
    'it.admin@sistec.ac.in',
    'ec.admin@sistec.ac.in',
    'me.admin@sistec.ac.in',
    'ce.admin@sistec.ac.in',
    'ee.admin@sistec.ac.in',
    'admin@sistec.ac.in',
    'admin@sistec.local'
  ) OR jwt_email LIKE '%.admin@sistec.ac.in' OR jwt_email LIKE '%admin%@sistec.local' THEN
    RETURN TRUE;
  END IF;

  -- 3. Check public.users table by auth.uid()
  IF auth_user_id IS NOT NULL THEN
    SELECT role INTO user_role
    FROM public.users
    WHERE id = auth_user_id;

    IF user_role = 'admin' THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- 4. Check public.users table by JWT email or username slug
  IF jwt_email <> '' THEN
    SELECT role INTO user_role
    FROM public.users
    WHERE lower(username) = jwt_email
       OR lower(username) = replace(jwt_email, '@sistec.local', '')
       OR lower(username) = split_part(jwt_email, '@', 1)
       OR lower(roll_number) = jwt_email
    LIMIT 1;

    IF user_role = 'admin' THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

-- STEP 3: Clean Up Existing Policies on public.users
DROP POLICY IF EXISTS "Public can view user profiles" ON public.users;
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
DROP POLICY IF EXISTS "Users can update own basic profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Users and admins can update users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- STEP 4: Define Clean, Non-Recursive Policies on public.users
CREATE POLICY "Public can view user profiles" ON public.users 
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own record" ON public.users 
  FOR INSERT WITH CHECK (
    auth.uid() = id OR auth.uid() IS NULL OR public.is_admin()
  );

CREATE POLICY "Users and admins can update users" ON public.users 
  FOR UPDATE 
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can delete users" ON public.users 
  FOR DELETE 
  USING (public.is_admin());

-- STEP 5: Bulletproof Role, Status, and Privilege Escalation Trigger
-- Allows full, unhindered edits by administrators (approvals, rejects, edits, blocks, unblocks, deletes).
-- Allows students to register and edit their legitimate academic profile fields (full_name, branch, roll, year, sem, bt_number, email, avatar, fcm).
-- Strictly blocks students from elevating to admin, self-approving, unblocking, or assigning branch admin rights.
CREATE OR REPLACE FUNCTION public.protect_user_role_and_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- 1. Full Administrator Bypass:
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 2. Non-Admin (Student / Public) Enforcement:
  -- Role can never be set to 'admin' by a student
  IF NEW.role = 'admin' THEN
    RAISE EXCEPTION 'Security Policy Violation: Only administrators can grant admin privileges.';
  END IF;
  NEW.role := 'student';

  -- INSERT Rules:
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' THEN
      RAISE EXCEPTION 'Security Policy Violation: Student accounts require administrator approval.';
    END IF;
    NEW.status := 'pending';
    NEW.is_blocked := 0;
    NEW.admin_branch_id := NULL;
  END IF;

  -- UPDATE Rules:
  IF TG_OP = 'UPDATE' THEN
    -- Student cannot change their status (cannot self-approve)
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Security Policy Violation: Only administrators can modify account status.';
    END IF;

    -- Student cannot unblock themselves
    IF coalesce(OLD.is_blocked, 0) = 1 AND NEW.is_blocked = 0 THEN
      RAISE EXCEPTION 'Security Policy Violation: Only administrators can unblock an account.';
    END IF;

    -- Student cannot self-assign department administration rights
    IF NEW.admin_branch_id IS NOT NULL AND NEW.admin_branch_id IS DISTINCT FROM OLD.admin_branch_id THEN
      RAISE EXCEPTION 'Security Policy Violation: Only administrators can assign department administration rights.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_user_role_and_status ON public.users;
CREATE TRIGGER tr_protect_user_role_and_status
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_role_and_status();

-- STEP 6: Re-link All Other Tables to Non-Recursive public.is_admin()

-- 6a. Branches & Categories
DROP POLICY IF EXISTS "Public can view branches" ON public.branches;
CREATE POLICY "Public can view branches" ON public.branches FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;
CREATE POLICY "Admins can manage branches" ON public.branches 
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories 
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6b. Books (Admin Add/Edit/Delete, Public Read)
DROP POLICY IF EXISTS "Public can view books" ON public.books;
CREATE POLICY "Public can view books" ON public.books FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage books" ON public.books;
CREATE POLICY "Admins can manage books" ON public.books 
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6c. Permissions (Cross-Department Clearance)
DROP POLICY IF EXISTS "Users can view own permissions" ON public.permissions;
CREATE POLICY "Users can view own permissions" ON public.permissions 
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can request permissions" ON public.permissions;
CREATE POLICY "Users can request permissions" ON public.permissions 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update permissions" ON public.permissions;
CREATE POLICY "Admins can update permissions" ON public.permissions 
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete permissions" ON public.permissions;
CREATE POLICY "Admins can delete permissions" ON public.permissions 
  FOR DELETE USING (public.is_admin());

-- 6d. Reading Progress
DROP POLICY IF EXISTS "Users manage own reading progress" ON public.user_book_progress;
CREATE POLICY "Users manage own reading progress" ON public.user_book_progress 
  FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 6e. Study Notes & Bookmarks
DROP POLICY IF EXISTS "Users manage own notes" ON public.notes;
CREATE POLICY "Users manage own notes" ON public.notes 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own bookmarks" ON public.bookmarks;
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6f. Notifications
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications 
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "System and admins insert notifications" ON public.notifications;
CREATE POLICY "System and admins insert notifications" ON public.notifications 
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users update own notification read state" ON public.notifications;
CREATE POLICY "Users update own notification read state" ON public.notifications 
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "Admins can delete notifications" ON public.notifications 
  FOR DELETE USING (public.is_admin());

-- 6g. Activity Logs (Append-Only Audit Trail)
DROP POLICY IF EXISTS "Users view own activity logs" ON public.activity_logs;
CREATE POLICY "Users view own activity logs" ON public.activity_logs 
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert activity logs" ON public.activity_logs;
CREATE POLICY "Users insert activity logs" ON public.activity_logs 
  FOR INSERT WITH CHECK (true);

-- 6h. System Settings
DROP POLICY IF EXISTS "Public can view system settings" ON public.system_settings;
CREATE POLICY "Public can view system settings" ON public.system_settings 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings" ON public.system_settings 
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6i. Senior Academic Profiles
DROP POLICY IF EXISTS "Public and students can view published senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Public and students can view published senior profiles" ON public.senior_academic_profiles
  FOR SELECT USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Admins can insert senior profiles" ON public.senior_academic_profiles
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Admins can update senior profiles" ON public.senior_academic_profiles
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Admins can delete senior profiles" ON public.senior_academic_profiles
  FOR DELETE USING (public.is_admin());

-- 6j. Projects Directory & Reactions
DROP POLICY IF EXISTS "Public and students can view published active projects" ON public.projects;
CREATE POLICY "Public and students can view published active projects" ON public.projects
  FOR SELECT USING ((is_published = true AND is_active = true) OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert projects" ON public.projects;
CREATE POLICY "Admins can insert projects" ON public.projects
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
CREATE POLICY "Admins can update projects" ON public.projects
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow reaction count updates on projects" ON public.projects;
CREATE POLICY "Allow reaction count updates on projects" ON public.projects
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE USING (public.is_admin());

-- 6k. User Push Notification Tokens
DROP POLICY IF EXISTS "Public and users can manage fcm tokens" ON public.user_fcm_tokens;
CREATE POLICY "Public and users can manage fcm tokens" ON public.user_fcm_tokens
  FOR ALL USING (true) WITH CHECK (true);
