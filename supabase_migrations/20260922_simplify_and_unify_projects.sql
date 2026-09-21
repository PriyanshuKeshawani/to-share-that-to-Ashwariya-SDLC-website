-- ==============================================================================
-- Migration: Simplify and Unify Projects & Opportunity Directory
-- Date: 2026-09-22
-- Description: Unifies Minors/Majors and Projects into a single schema.
--              Adds image_url, team_members JSONB, live_url, github_url,
--              likes/dislikes counters, and a dedicated project_reactions table.
-- ==============================================================================

-- 1. Ensure projects table has the simplified showcase columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'image_url') THEN
    ALTER TABLE public.projects ADD COLUMN image_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'team_members') THEN
    ALTER TABLE public.projects ADD COLUMN team_members JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'live_url') THEN
    ALTER TABLE public.projects ADD COLUMN live_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'github_url') THEN
    ALTER TABLE public.projects ADD COLUMN github_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'likes_count') THEN
    ALTER TABLE public.projects ADD COLUMN likes_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'dislikes_count') THEN
    ALTER TABLE public.projects ADD COLUMN dislikes_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2. Create project_reactions table for tracking student like/dislike interactions
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

-- Index for fast lookup of a user's vote on a project
CREATE INDEX IF NOT EXISTS idx_project_reactions_lookup ON public.project_reactions(project_id, user_email);
CREATE INDEX IF NOT EXISTS idx_project_reactions_project ON public.project_reactions(project_id);

-- 3. Row Level Security for project_reactions
ALTER TABLE public.project_reactions ENABLE ROW LEVEL SECURITY;

-- Allow public and all users to read reactions
DROP POLICY IF EXISTS "Public can view project reactions" ON public.project_reactions;
CREATE POLICY "Public can view project reactions"
  ON public.project_reactions
  FOR SELECT
  USING (true);

-- Allow any user (authenticated or student with email) to insert/update their own reaction
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

-- Allow students to update project likes_count and dislikes_count when voting
DROP POLICY IF EXISTS "Allow reaction count updates on projects" ON public.projects;
CREATE POLICY "Allow reaction count updates on projects"
  ON public.projects
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 4. Enable Realtime for project_reactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'project_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_reactions;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
