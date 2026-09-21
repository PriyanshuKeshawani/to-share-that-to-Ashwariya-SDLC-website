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
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
-- 9. RLS - Open for development
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

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public access for all" ON %I', tbl);
    EXECUTE format('CREATE POLICY "Public access for all" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;

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
-- 11. Storage buckets (PDFs & Covers)
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
CREATE POLICY "Anyone can upload pdfs" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('pdfs', 'covers'));

DROP POLICY IF EXISTS "Anyone can update pdfs" ON storage.objects;
CREATE POLICY "Anyone can update pdfs" ON storage.objects FOR UPDATE USING (bucket_id IN ('pdfs', 'covers'));

DROP POLICY IF EXISTS "Anyone can delete pdfs" ON storage.objects;
CREATE POLICY "Anyone can delete pdfs" ON storage.objects FOR DELETE USING (bucket_id IN ('pdfs', 'covers'));

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
-- 13. Relax permission FK (for demo/bypass users)
-- =========================================================
ALTER TABLE IF EXISTS permissions DROP CONSTRAINT IF EXISTS permissions_user_id_fkey;

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
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE public.users.id = auth.uid() 
      AND public.users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Admins can insert senior profiles"
  ON public.senior_academic_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE public.users.id = auth.uid() 
      AND public.users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Admins can update senior profiles"
  ON public.senior_academic_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE public.users.id = auth.uid() 
      AND public.users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE public.users.id = auth.uid() 
      AND public.users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete senior profiles" ON public.senior_academic_profiles;
CREATE POLICY "Admins can delete senior profiles"
  ON public.senior_academic_profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE public.users.id = auth.uid() 
      AND public.users.role = 'admin'
    )
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

  is_published BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert projects" ON public.projects;
CREATE POLICY "Admins can insert projects"
  ON public.projects
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
CREATE POLICY "Admins can update projects"
  ON public.projects
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
CREATE POLICY "Admins can delete projects"
  ON public.projects
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  );

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
  END;
END $$;



