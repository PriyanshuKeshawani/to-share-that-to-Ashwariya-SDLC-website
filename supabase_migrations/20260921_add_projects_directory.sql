-- ==============================================================================
-- Migration: Add Projects & Opportunities Directory
-- Date: 2026-09-21
-- Description: Dedicated table for storing projects and opportunities
--              (Academic, Major, Minor, Research, Internships, Hackathons, etc.)
--              with full admin CRUD, Google Form / Sheet / Excel / CSV import,
--              and conditional student catalog visibility.
-- ==============================================================================

-- 1. Create projects table
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

-- 2. Indexes for fast filtering and searching
CREATE INDEX IF NOT EXISTS idx_projects_published_active ON public.projects(is_published, is_active);
CREATE INDEX IF NOT EXISTS idx_projects_branch ON public.projects(branch_name);
CREATE INDEX IF NOT EXISTS idx_projects_type ON public.projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_batch ON public.projects(batch);
CREATE INDEX IF NOT EXISTS idx_projects_major ON public.projects(major);
CREATE INDEX IF NOT EXISTS idx_projects_minor ON public.projects(minor);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON public.projects(application_deadline);
CREATE INDEX IF NOT EXISTS idx_projects_sort_order ON public.projects(sort_order);

-- 3. Automatic updated_at trigger
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

-- 4. Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 4a. SELECT Policy: Students/Public can view only if is_published=true AND is_active=true; Admins can view all.
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

-- 4b. INSERT Policy: Administrators only
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

-- 4c. UPDATE Policy: Administrators only
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

-- 4d. DELETE Policy: Administrators only
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

-- 5. Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
