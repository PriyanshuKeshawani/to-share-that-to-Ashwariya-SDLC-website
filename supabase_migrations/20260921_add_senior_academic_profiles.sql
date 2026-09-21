-- ==============================================================================
-- Migration: Add Senior Academic Profiles (Majors & Minors Directory)
-- Date: 2026-09-21
-- Description: Dedicated table for storing senior students' Major & Minor
--              specializations for academic guidance and peer mentorship.
-- ==============================================================================

-- 1. Create senior_academic_profiles table
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

-- 2. Indexes for efficient searching and filtering
CREATE INDEX IF NOT EXISTS idx_senior_profiles_branch ON public.senior_academic_profiles(branch_name);
CREATE INDEX IF NOT EXISTS idx_senior_profiles_batch ON public.senior_academic_profiles(batch);
CREATE INDEX IF NOT EXISTS idx_senior_profiles_major ON public.senior_academic_profiles(major);
CREATE INDEX IF NOT EXISTS idx_senior_profiles_minor ON public.senior_academic_profiles(minor);
CREATE INDEX IF NOT EXISTS idx_senior_profiles_student ON public.senior_academic_profiles(student_user_id);
CREATE INDEX IF NOT EXISTS idx_senior_profiles_published ON public.senior_academic_profiles(is_published);

-- 3. Trigger for automatic updated_at timestamp
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

-- 4. Row Level Security (RLS)
ALTER TABLE public.senior_academic_profiles ENABLE ROW LEVEL SECURITY;

-- 4a. Allow SELECT for published profiles (Public / Students / Faculty)
--     Or if admin, allow viewing all profiles (including unpublished/drafts)
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

-- 4b. Allow Administrators to INSERT new records
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

-- 4c. Allow Administrators to UPDATE records
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

-- 4d. Allow Administrators to DELETE records
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

-- 5. Enable Realtime Replication for instant directory updates
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.senior_academic_profiles;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
  END;
END $$;
