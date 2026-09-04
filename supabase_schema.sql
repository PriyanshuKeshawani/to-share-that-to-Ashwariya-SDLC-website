-- SISTEC Library Portal Complete Supabase Schema
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/ddjqajadhrwepcybfzam/sql

-- 1. Branches
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

-- 2. Categories
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

-- 3. Users profile table (linked with Supabase Auth UUID)
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

-- 4. Books
CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK(priority IN ('main', 'sub')),
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Physical Book Copies
CREATE TABLE IF NOT EXISTS physical_book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  copy_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'available' CHECK(status IN ('available', 'issued', 'reserved', 'maintenance')),
  qr_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Book Loans
CREATE TABLE IF NOT EXISTS book_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id UUID REFERENCES physical_book_copies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  returned_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'issued' CHECK(status IN ('pending', 'issued', 'returned', 'overdue')),
  fine_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Rooms & Tables
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  qr_identifier TEXT UNIQUE NOT NULL,
  current_occupant_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_started_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'free' CHECK(status IN ('free', 'occupied', 'reserved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Library Sessions
CREATE TABLE IF NOT EXISTS library_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
  entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  exited_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Library Settings
CREATE TABLE IF NOT EXISTS library_settings (
  id SERIAL PRIMARY KEY,
  loan_duration_days INTEGER DEFAULT 14,
  fine_per_day DECIMAL(10,2) DEFAULT 5.00,
  max_fine DECIMAL(10,2) DEFAULT 200.00,
  seating_templates JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE library_settings ADD COLUMN IF NOT EXISTS seating_templates JSONB DEFAULT '[]'::jsonb;

INSERT INTO library_settings (id, loan_duration_days, fine_per_day, max_fine)
VALUES (1, 14, 5.00, 200.00)
ON CONFLICT (id) DO NOTHING;

-- 11. Branch Access Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, branch_id)
);

-- 12. User Book Progress
CREATE TABLE IF NOT EXISTS user_book_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  last_page_read INTEGER DEFAULT 1,
  accessed_count INTEGER DEFAULT 0,
  downloaded_count INTEGER DEFAULT 0,
  is_downloaded INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- 13. Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and public access policies for anon role (development configuration)
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_book_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated & anon clients
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

-- 14. High-Performance B-Tree Indexes (Optimized for 100,000 Users Scale)
CREATE INDEX IF NOT EXISTS idx_users_roll ON users(roll_number);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_tables_qr ON tables(qr_identifier);
CREATE INDEX IF NOT EXISTS idx_tables_room_status ON tables(room_id, status);
CREATE INDEX IF NOT EXISTS idx_physical_copies_qr ON physical_book_copies(qr_code);
CREATE INDEX IF NOT EXISTS idx_physical_copies_book ON physical_book_copies(book_id, status);
CREATE INDEX IF NOT EXISTS idx_book_loans_user ON book_loans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_book_loans_copy ON book_loans(copy_id);
CREATE INDEX IF NOT EXISTS idx_library_sessions_user_active ON library_sessions(user_id) WHERE exited_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_sessions_table ON library_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_books_branch_cat ON books(branch_id, category_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);

-- 15. Supabase Storage Bucket & Policies for Digital PDFs
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

-- 16. Relax Permissions User FK (Supports Demo Students, Bypass Logins & External Users)
ALTER TABLE IF EXISTS permissions DROP CONSTRAINT IF EXISTS permissions_user_id_fkey;



