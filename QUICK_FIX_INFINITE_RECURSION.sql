-- ==============================================================================
-- SISTEC LIBRARY PORTAL - IMMEDIATE RLS RECURSION HOTFIX
-- Fixes PostgreSQL Error 42P17: "infinite recursion detected in policy for relation 'users'"
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Go to "SQL Editor" in the left sidebar
-- 3. Click "New Query", paste this entire script, and click "RUN" (or Ctrl + Enter)
-- 4. Refresh your Admin Panel - the error banner will disappear immediately!
-- ==============================================================================

-- STEP 1: Create Non-Recursive Helper Function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- STEP 2: Drop Recursive Policies on users table
DROP POLICY IF EXISTS "Users can update own basic profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Public can view user profiles" ON public.users;
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
DROP POLICY IF EXISTS "Users and admins can update users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- STEP 3: Re-create Non-Recursive Policies on users
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

-- STEP 4: Prevent Role Escalation via BEFORE UPDATE Trigger (Replaces recursive RLS check)
CREATE OR REPLACE FUNCTION public.protect_user_role_and_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can modify user roles.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can modify user account status.';
    END IF;
    IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can modify block status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_user_role_and_status ON public.users;
CREATE TRIGGER tr_protect_user_role_and_status
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_role_and_status();

-- STEP 5: Re-link all related tables to non-recursive public.is_admin()
DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;
CREATE POLICY "Admins can manage branches" ON public.branches 
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories 
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage books" ON public.books;
CREATE POLICY "Admins can manage books" ON public.books 
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

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

DROP POLICY IF EXISTS "Users manage own reading progress" ON public.user_book_progress;
CREATE POLICY "Users manage own reading progress" ON public.user_book_progress 
  FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications 
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users view own activity logs" ON public.activity_logs;
CREATE POLICY "Users view own activity logs" ON public.activity_logs 
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert activity logs" ON public.activity_logs;
CREATE POLICY "Users insert activity logs" ON public.activity_logs 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings" ON public.system_settings 
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
