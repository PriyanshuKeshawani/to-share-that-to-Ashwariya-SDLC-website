-- SISTEC Library Portal — Ebook-Only Schema with Google Drive
-- Run this in your Supabase SQL Editor to migrate to ebook-only mode.

-- =========================================================
-- 1. Branches
-- =========================================================
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

INSERT INTO branches (name) VALUES
  ('CSE (Computer Science & Engineering)'),
  ('CSE (Artificial Intelligence & Data Science)'),
  ('IT (Information Technology)'),
  ('ECE (Electronics & Communication Engineering)'),
  ('Cyber Security'),
  ('Civil Engineering'),
  ('Mechanical Engineering (ME)'),
  ('Electrical Engineering (EX/EE)'),
  ('B.Pharm'),
  ('M.Pharm (Pharmaceutical Chemistry)'),
  ('M.Pharm (Pharmaceutics)'),
  ('BBA'),
  ('MBA'),
  ('M.Tech CSE'),
  ('CTM (Construction Technology & Management)'),
  ('SE (Structural Engineering)'),
  ('Machine Design'),
  ('Thermal Engineering'),
  ('Digital Communication'),
  ('VLSI Design')
ON CONFLICT (name) DO NOTHING;

-- =========================================================
-- 2. Categories
-- =========================================================
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  parent_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
);

INSERT INTO categories (name) VALUES
  ('Core Engineering'),
  ('Programming & Software'),
  ('Mathematics & Science'),
  ('Humanities & Management')
ON CONFLICT DO NOTHING;

-- =========================================================
-- 3. Users
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  roll_number TEXT,
  branch_name TEXT,
  year TEXT,
  semester TEXT,
  bt_number TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'student')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  is_blocked INTEGER DEFAULT 0,
  auth_provider TEXT DEFAULT 'password',
  google_id TEXT UNIQUE,
  avatar_url TEXT,
  admin_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  fcm_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS block_reason TEXT;

-- =========================================================
-- 4. Books (with Google Drive support)
-- =========================================================
CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  priority TEXT NOT NULL CHECK(priority IN ('main', 'sub')) DEFAULT 'main',
  pdf_url TEXT,                       -- legacy / fallback (uploaded PDF or data URL)
  drive_file_id TEXT,                 -- Google Drive file ID (preferred for reading)
  drive_link TEXT,                    -- Full Google Drive share URL (preferred for reading)
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration for existing books
ALTER TABLE books ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS drive_link TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS isbn TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_source TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS size_mb NUMERIC DEFAULT 0;
ALTER TABLE books ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE books ALTER COLUMN branch_id DROP NOT NULL;

-- =========================================================
-- 5. Per-Book Access Permissions
-- =========================================================
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

ALTER TABLE permissions ADD COLUMN IF NOT EXISTS book_id INTEGER REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_user_id_branch_id_key;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permissions_user_id_book_id_key') THEN
    ALTER TABLE permissions ADD CONSTRAINT permissions_user_id_book_id_key UNIQUE (user_id, book_id);
  END IF;
END $$;

-- =========================================================
-- 6. User Reading Progress
-- =========================================================
CREATE TABLE IF NOT EXISTS user_book_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  last_page_read INTEGER DEFAULT 1,
  total_pages INTEGER DEFAULT 0,
  reading_time_minutes INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed')),
  session_start_at TIMESTAMP WITH TIME ZONE,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accessed_count INTEGER DEFAULT 0,
  downloaded_count INTEGER DEFAULT 0,
  is_downloaded INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Migration: add new analytics columns to existing user_book_progress
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 0;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER DEFAULT 0;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 0;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'in_progress';
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS session_start_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS accessed_count INTEGER DEFAULT 0;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS downloaded_count INTEGER DEFAULT 0;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS is_downloaded INTEGER DEFAULT 0;
ALTER TABLE user_book_progress ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;

-- Add check constraint for status (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_book_progress_status_check') THEN
    ALTER TABLE user_book_progress ADD CONSTRAINT user_book_progress_status_check CHECK (status IN ('in_progress', 'completed'));
  END IF;
END $$;

-- Add total_pages column to books for accurate page counts
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 0;

-- =========================================================
-- 7. Notifications (ebook-only: permissions, books, system)
-- =========================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- 8. Activity Logs (ebook-only)
-- =========================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- 8b. System Settings (Registration Policy & Global Config)
-- =========================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default registration policy
INSERT INTO system_settings (key, value)
VALUES ('registration_policy', '{"policy": "manual"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- 8c. Study Notes & Bookmarks (Per-User, Per-Book)
-- =========================================================
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL DEFAULT 1,
  text TEXT NOT NULL,
  tag TEXT DEFAULT 'Concept',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id, page)
);

-- =========================================================
-- 9. Production-Hardened Row Level Security (RLS)
-- =========================================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_book_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- 9a. Clean up any insecure legacy wildcard development policies
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public access for all" ON public.%I', tbl);
  END LOOP;
END $$;

-- 9b. Non-Recursive Admin Verification Function
-- CRITICAL FIX for Postgres 42P17 ("infinite recursion detected in policy for relation 'users'"):
-- Functions marked SECURITY DEFINER execute with the privileges of the owner (postgres),
-- which BYPASSES RLS on public.users. This allows checking admin status cleanly without
-- triggering recursive policy evaluation loops.
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

-- 9c. Branches & Categories: Public Read, Admin Write
DROP POLICY IF EXISTS "Public can view branches" ON branches;
CREATE POLICY "Public can view branches" ON branches FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage branches" ON branches;
CREATE POLICY "Admins can manage branches" ON branches FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can view categories" ON categories;
CREATE POLICY "Public can view categories" ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories" ON categories FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 9d. Books: Public Read, Admin Write
DROP POLICY IF EXISTS "Public can view books" ON books;
CREATE POLICY "Public can view books" ON books FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage books" ON books;
CREATE POLICY "Admins can manage books" ON books FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 9e. Users: Public Read profiles, Self Registration & Profile Updates, Admin Management
DROP POLICY IF EXISTS "Public can view user profiles" ON users;
CREATE POLICY "Public can view user profiles" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own record" ON users;
CREATE POLICY "Users can insert own record" ON users FOR INSERT WITH CHECK (
  auth.uid() = id OR auth.uid() IS NULL OR public.is_admin()
);

DROP POLICY IF EXISTS "Users can update own basic profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Users and admins can update users" ON users;
CREATE POLICY "Users and admins can update users" ON users FOR UPDATE 
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users" ON users FOR DELETE 
  USING (public.is_admin());

-- 9e-1. Trigger: Enforce Role & Status Security on Users (IDOR / Privilege Escalation Prevention)
-- Allows legitimate edits by students (name, branch, roll, sem, year, bt, avatar, etc.)
-- and all operations by admins (approvals, rejects, edits, blocks, deletes),
-- while strictly preventing non-admin students from elevating to admin, self-approving, or unblocking.
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
    -- Student cannot modify account status (pending -> approved, or approved -> anything)
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

-- 9f. Permissions: User view own, Admin manage all
DROP POLICY IF EXISTS "Users can view own permissions" ON permissions;
CREATE POLICY "Users can view own permissions" ON permissions FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can request permissions" ON permissions;
CREATE POLICY "Users can request permissions" ON permissions FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update permissions" ON permissions;
CREATE POLICY "Admins can update permissions" ON permissions FOR UPDATE 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete permissions" ON permissions;
CREATE POLICY "Admins can delete permissions" ON permissions FOR DELETE 
  USING (public.is_admin());

-- 9g. User Book Progress: User isolated (IDOR Prevention)
DROP POLICY IF EXISTS "Users manage own reading progress" ON user_book_progress;
CREATE POLICY "Users manage own reading progress" ON user_book_progress FOR ALL 
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 9h. Notes & Bookmarks: Strict IDOR Prevention
DROP POLICY IF EXISTS "Users manage own notes" ON notes;
CREATE POLICY "Users manage own notes" ON notes FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own bookmarks" ON bookmarks;
CREATE POLICY "Users manage own bookmarks" ON bookmarks FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 9i. Notifications & Activity Logs
DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users update own notification read state" ON notifications;
CREATE POLICY "Users update own notification read state" ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System and admins insert notifications" ON notifications;
CREATE POLICY "System and admins insert notifications" ON notifications FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own activity logs" ON activity_logs;
CREATE POLICY "Users view own activity logs" ON activity_logs FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert activity logs" ON activity_logs;
CREATE POLICY "Users insert activity logs" ON activity_logs FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 9j. System Settings: Public Read, Admin Write
DROP POLICY IF EXISTS "Public can view system settings" ON system_settings;
CREATE POLICY "Public can view system settings" ON system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage system settings" ON system_settings;
CREATE POLICY "Admins can manage system settings" ON system_settings FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =========================================================
-- 10. Indexes
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_users_roll ON users(roll_number);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_books_branch_cat ON books(branch_id, category_id);
CREATE INDEX IF NOT EXISTS idx_books_total_pages ON books(total_pages);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_permissions_user_book ON permissions(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_user_book_progress_status ON user_book_progress(status);
CREATE INDEX IF NOT EXISTS idx_user_book_progress_last_active ON user_book_progress(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_book_progress_session_start ON user_book_progress(session_start_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

-- =========================================================
-- 11. Storage buckets (PDFs & Covers) - Secure Policies
-- =========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pdfs', 'pdfs', true, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

DROP POLICY IF EXISTS "Public can view pdfs" ON storage.objects;
CREATE POLICY "Public can view pdfs" ON storage.objects FOR SELECT USING (bucket_id IN ('pdfs', 'covers'));

DROP POLICY IF EXISTS "Anyone can upload pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload pdfs" ON storage.objects;
CREATE POLICY "Admins can upload pdfs" ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id IN ('pdfs', 'covers')
    AND (public.is_admin() OR auth.role() = 'service_role')
  );

DROP POLICY IF EXISTS "Anyone can update pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update pdfs" ON storage.objects;
CREATE POLICY "Admins can update pdfs" ON storage.objects FOR UPDATE 
  USING (
    bucket_id IN ('pdfs', 'covers')
    AND (public.is_admin() OR auth.role() = 'service_role')
  );

DROP POLICY IF EXISTS "Anyone can delete pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete pdfs" ON storage.objects;
CREATE POLICY "Admins can delete pdfs" ON storage.objects FOR DELETE 
  USING (
    bucket_id IN ('pdfs', 'covers')
    AND (public.is_admin() OR auth.role() = 'service_role')
  );

-- =========================================================
-- 12. Drop physical-library tables (safe to run multiple times)
-- =========================================================
DROP TABLE IF EXISTS book_loans CASCADE;
DROP TABLE IF EXISTS physical_book_copies CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS library_sessions CASCADE;
DROP TABLE IF EXISTS library_settings CASCADE;

-- =========================================================
-- 13. Relax Foreign Key Constraints (Zero-Downtime Student & Demo Users)
-- =========================================================
ALTER TABLE IF EXISTS permissions DROP CONSTRAINT IF EXISTS permissions_user_id_fkey;
ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- =========================================================
-- 14. Enable Realtime Replication for Full Instant Live Updates
-- =========================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE books, permissions, users, notifications, activity_logs, user_book_progress, branches, categories;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
  END;
END $$;

-- =========================================================
-- 15. Senior Majors & Minors Directory (Academic Profiles)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.senior_academic_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  roll_number TEXT,
  branch_name TEXT,
  batch TEXT,
  major TEXT NOT NULL,
  minor TEXT NOT NULL,
  description TEXT,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_senior_profiles_branch ON public.senior_academic_profiles(branch_name);
CREATE INDEX IF NOT EXISTS idx_senior_profiles_batch ON public.senior_academic_profiles(batch);
CREATE INDEX IF NOT EXISTS idx_senior_profiles_major ON public.senior_academic_profiles(major);
CREATE INDEX IF NOT EXISTS idx_senior_profiles_minor ON public.senior_academic_profiles(minor);
CREATE INDEX IF NOT EXISTS idx_senior_profiles_student ON public.senior_academic_profiles(student_user_id);
CREATE INDEX IF NOT EXISTS idx_senior_profiles_published ON public.senior_academic_profiles(is_published);

CREATE OR REPLACE FUNCTION public.update_senior_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_senior_profiles_updated_at ON public.senior_academic_profiles;
CREATE TRIGGER trigger_senior_profiles_updated_at
  BEFORE UPDATE ON public.senior_academic_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_senior_profiles_updated_at();

ALTER TABLE public.senior_academic_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and students can view published senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Public and students can view published senior profiles"
  ON public.senior_academic_profiles
  FOR SELECT
  USING (
    is_published = true 
    OR 
    public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can insert senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Admins can insert senior profiles"
  ON public.senior_academic_profiles
  FOR INSERT
  WITH CHECK (
    public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can update senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Admins can update senior profiles"
  ON public.senior_academic_profiles
  FOR UPDATE
  USING (
    public.is_admin()
  )
  WITH CHECK (
    public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can delete senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Admins can delete senior profiles"
  ON public.senior_academic_profiles
  FOR DELETE
  USING (
    public.is_admin()
  );

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.senior_academic_profiles;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
  END;
END $$;

-- ==============================================================================
-- 16. PROJECTS & OPPORTUNITIES DIRECTORY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  project_type TEXT DEFAULT 'Academic Project',
  department TEXT,
  branch_name TEXT,
  eligibility TEXT,
  required_skills TEXT,
  major TEXT,
  minor TEXT,
  batch TEXT,
  team_size TEXT,
  mentor_name TEXT,
  organization TEXT,

  application_mode TEXT DEFAULT 'google_form',
  application_deadline TIMESTAMP WITH TIME ZONE,

  google_form_url TEXT,
  application_url TEXT,
  resource_url TEXT,

  contact_name TEXT,
  contact_email TEXT,

  source_type TEXT DEFAULT 'manual',
  source_reference TEXT,

  image_url TEXT,
  team_members JSONB DEFAULT '[]'::jsonb,
  live_url TEXT,
  github_url TEXT,
  likes_count INTEGER DEFAULT 0,
  dislikes_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name TEXT,

  is_published BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotent column migrations for projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS team_members JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS live_url TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by_name TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_published_active ON public.projects(is_published, is_active);
CREATE INDEX IF NOT EXISTS idx_projects_branch ON public.projects(branch_name);
CREATE INDEX IF NOT EXISTS idx_projects_type ON public.projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_batch ON public.projects(batch);
CREATE INDEX IF NOT EXISTS idx_projects_major ON public.projects(major);
CREATE INDEX IF NOT EXISTS idx_projects_minor ON public.projects(minor);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON public.projects(application_deadline);
CREATE INDEX IF NOT EXISTS idx_projects_sort_order ON public.projects(sort_order);

CREATE OR REPLACE FUNCTION public.update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_projects_updated_at();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and students can view published active projects" ON public.projects;
CREATE POLICY "Public and students can view published active projects"
  ON public.projects
  FOR SELECT
  USING (
    (is_published = true AND is_active = true)
    OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can insert projects" ON public.projects;
CREATE POLICY "Admins can insert projects"
  ON public.projects
  FOR INSERT
  WITH CHECK (
    public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
CREATE POLICY "Admins can update projects"
  ON public.projects
  FOR UPDATE
  USING (
    public.is_admin()
  )
  WITH CHECK (
    public.is_admin()
  );

-- Allow students and public users to update project like / reaction counts
DROP POLICY IF EXISTS "Allow reaction count updates on projects" ON public.projects;
CREATE POLICY "Allow reaction count updates on projects"
  ON public.projects
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
CREATE POLICY "Admins can delete projects"
  ON public.projects
  FOR DELETE
  USING (
    public.is_admin()
  );

-- ==============================================================================
-- 17. DEDICATED PROJECT LIKES TABLE & TRIGGER SYNCHRONIZER
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_project_likes_project_user UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_likes_project_id ON public.project_likes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_likes_user_id ON public.project_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_project_likes_composite ON public.project_likes(project_id, user_id);

CREATE OR REPLACE FUNCTION public.sync_project_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.projects
    SET likes_count = (
      SELECT COUNT(*)::INTEGER 
      FROM public.project_likes 
      WHERE project_id = NEW.project_id
    )
    WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.projects
    SET likes_count = (
      SELECT COUNT(*)::INTEGER 
      FROM public.project_likes 
      WHERE project_id = OLD.project_id
    )
    WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_project_likes_count ON public.project_likes;
CREATE TRIGGER trigger_sync_project_likes_count
  AFTER INSERT OR DELETE ON public.project_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_likes_count();

ALTER TABLE public.project_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view project likes" ON public.project_likes;
CREATE POLICY "Public can view project likes"
  ON public.project_likes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own like" ON public.project_likes;
CREATE POLICY "Users can insert their own like"
  ON public.project_likes
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own like" ON public.project_likes;
CREATE POLICY "Users can delete their own like"
  ON public.project_likes
  FOR DELETE
  USING (true);

-- ==============================================================================
-- 18. DEDICATED PROJECT REACTIONS TABLE (LIKE / DISLIKE BY EMAIL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID,
  user_email TEXT NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_project_user_reaction UNIQUE (project_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_project_reactions_lookup ON public.project_reactions(project_id, user_email);
CREATE INDEX IF NOT EXISTS idx_project_reactions_project ON public.project_reactions(project_id);

ALTER TABLE public.project_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view project reactions" ON public.project_reactions;
CREATE POLICY "Public can view project reactions"
  ON public.project_reactions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own reaction" ON public.project_reactions;
CREATE POLICY "Users can insert their own reaction"
  ON public.project_reactions
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own reaction" ON public.project_reactions;
CREATE POLICY "Users can update their own reaction"
  ON public.project_reactions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own reaction" ON public.project_reactions;
CREATE POLICY "Users can delete their own reaction"
  ON public.project_reactions
  FOR DELETE
  USING (true);

-- ==============================================================================
-- 19. USER FCM PUSH NOTIFICATION TOKENS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  fcm_token TEXT UNIQUE NOT NULL,
  branch_name TEXT,
  device_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_token ON public.user_fcm_tokens(fcm_token);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user ON public.user_fcm_tokens(user_id);

ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and users can manage fcm tokens" ON public.user_fcm_tokens;
CREATE POLICY "Public and users can manage fcm tokens"
  ON public.user_fcm_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 20. UNIFIED SUPABASE REALTIME REPLICATION (INSTANT LIVE SYNC)
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.books, 
      public.permissions, 
      public.users, 
      public.notifications, 
      public.activity_logs, 
      public.user_book_progress, 
      public.branches, 
      public.categories,
      public.senior_academic_profiles,
      public.projects,
      public.project_likes,
      public.project_reactions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
  END;
END $$;

-- ==============================================================================
-- 21. SAFE DELETION & LIFECYCLE INTEGRITY (RPCs & REFERENTIAL GUARDS)
-- ==============================================================================
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security Policy Violation: Only administrators can delete or merge academic branches.';
  END IF;

  SELECT * INTO old_branch FROM public.branches WHERE id = branch_id_to_delete;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch with ID % not found.', branch_id_to_delete;
  END IF;

  SELECT COUNT(*) INTO books_count FROM public.books WHERE branch_id = branch_id_to_delete;
  SELECT COUNT(*) INTO students_count FROM public.users 
  WHERE lower(trim(coalesce(branch_name, ''))) = lower(trim(old_branch.name))
     OR admin_branch_id = branch_id_to_delete;

  IF fallback_branch_id IS NOT NULL THEN
    IF fallback_branch_id = branch_id_to_delete THEN
      RAISE EXCEPTION 'Cannot reassign a branch to itself.';
    END IF;

    SELECT * INTO target_branch FROM public.branches WHERE id = fallback_branch_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Target reassignment branch with ID % does not exist.', fallback_branch_id;
    END IF;

    UPDATE public.books SET branch_id = fallback_branch_id WHERE branch_id = branch_id_to_delete;
    GET DIAGNOSTICS reassigned_books = ROW_COUNT;

    UPDATE public.users SET branch_name = target_branch.name WHERE lower(trim(coalesce(branch_name, ''))) = lower(trim(old_branch.name));
    GET DIAGNOSTICS reassigned_students = ROW_COUNT;

    UPDATE public.users SET admin_branch_id = fallback_branch_id WHERE admin_branch_id = branch_id_to_delete;
    UPDATE public.permissions SET branch_id = fallback_branch_id WHERE branch_id = branch_id_to_delete;
    UPDATE public.senior_academic_profiles SET branch_name = target_branch.name WHERE lower(trim(coalesce(branch_name, ''))) = lower(trim(old_branch.name));
    UPDATE public.projects SET branch_name = target_branch.name WHERE lower(trim(coalesce(branch_name, ''))) = lower(trim(old_branch.name));
  ELSE
    IF books_count > 0 OR students_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete branch "%": % books and % students are currently assigned. Please select a target branch to merge/reassign them to first.',
        old_branch.name, books_count, students_count;
    END IF;
  END IF;

  DELETE FROM public.branches WHERE id = branch_id_to_delete;

  INSERT INTO public.activity_logs (action_type, details, created_at)
  VALUES (
    'branch_deleted',
    format('Academic branch "%s" (ID: %s) deleted. Reassigned %s books and %s students to branch "%s".',
      old_branch.name, branch_id_to_delete, reassigned_books, reassigned_students, coalesce(target_branch.name, 'None')
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security Policy Violation: Only administrators can permanently delete user accounts.';
  END IF;

  caller_id := auth.uid();
  IF caller_id IS NOT NULL AND caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot delete your own active administrator account.';
  END IF;

  SELECT * INTO target_user FROM public.users WHERE id = target_user_id;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
      DELETE FROM auth.users WHERE id = target_user_id;
      RETURN jsonb_build_object('success', true, 'message', 'Orphaned auth account wiped successfully.');
    END IF;
    RAISE EXCEPTION 'User with ID % not found.', target_user_id;
  END IF;

  DELETE FROM public.user_book_progress WHERE user_id = target_user_id;
  DELETE FROM public.bookmarks WHERE user_id = target_user_id;
  DELETE FROM public.notes WHERE user_id = target_user_id;
  DELETE FROM public.permissions WHERE user_id = target_user_id;
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  DELETE FROM public.project_likes WHERE user_id = target_user_id;
  DELETE FROM public.project_reactions WHERE user_id = target_user_id;
  DELETE FROM public.user_fcm_tokens WHERE user_id = target_user_id;

  UPDATE public.senior_academic_profiles SET student_user_id = NULL WHERE student_user_id = target_user_id;
  UPDATE public.projects SET created_by = NULL WHERE created_by = target_user_id;

  UPDATE public.activity_logs 
  SET user_id = NULL,
      details = coalesce(details, '') || format(' [Historical user %s (%s) purged]', target_user.full_name, target_user.roll_number)
  WHERE user_id = target_user_id;

  DELETE FROM public.users WHERE id = target_user_id;

  BEGIN
    DELETE FROM auth.users WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.activity_logs (action_type, details, created_at)
  VALUES (
    'user_purged',
    format('User account %s (@%s, Roll: %s) was permanently purged from the system.',
      target_user.full_name, target_user.username, coalesce(target_user.roll_number, 'N/A')
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security Policy Violation: Only administrators can delete books.';
  END IF;

  SELECT * INTO target_book FROM public.books WHERE id = book_id_to_delete;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book with ID % not found.', book_id_to_delete;
  END IF;

  DELETE FROM public.user_book_progress WHERE book_id = book_id_to_delete;
  DELETE FROM public.bookmarks WHERE book_id = book_id_to_delete;
  DELETE FROM public.notes WHERE book_id = book_id_to_delete;
  DELETE FROM public.permissions WHERE book_id = book_id_to_delete;

  UPDATE public.activity_logs 
  SET book_id = NULL,
      details = coalesce(details, '') || format(' [Book "%s" was deleted from catalog]', target_book.title)
  WHERE book_id = book_id_to_delete;

  DELETE FROM public.books WHERE id = book_id_to_delete;

  INSERT INTO public.activity_logs (action_type, details, created_at)
  VALUES (
    'book_deleted',
    format('Book "%s" by %s (ID: %s) deleted from catalog.', target_book.title, target_book.author, book_id_to_delete),
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

GRANT EXECUTE ON FUNCTION public.delete_branch_safely(INTEGER, INTEGER) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.purge_user_completely(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.delete_book_safely(INTEGER) TO authenticated, service_role, anon;




