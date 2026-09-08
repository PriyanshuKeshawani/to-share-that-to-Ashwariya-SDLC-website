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
  ('Computer Science and Engineering'),
  ('Information Technology'),
  ('Electronics and Communication'),
  ('Mechanical Engineering'),
  ('Civil Engineering'),
  ('Electrical Engineering')
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

-- =========================================================
-- 11. Storage bucket (legacy PDFs, optional)
-- =========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pdfs', 'pdfs', true, 52428800, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can view pdfs" ON storage.objects;
CREATE POLICY "Public can view pdfs" ON storage.objects FOR SELECT USING (bucket_id = 'pdfs');

DROP POLICY IF EXISTS "Anyone can upload pdfs" ON storage.objects;
CREATE POLICY "Anyone can upload pdfs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pdfs');

DROP POLICY IF EXISTS "Anyone can update pdfs" ON storage.objects;
CREATE POLICY "Anyone can update pdfs" ON storage.objects FOR UPDATE USING (bucket_id = 'pdfs');

DROP POLICY IF EXISTS "Anyone can delete pdfs" ON storage.objects;
CREATE POLICY "Anyone can delete pdfs" ON storage.objects FOR DELETE USING (bucket_id = 'pdfs');

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
