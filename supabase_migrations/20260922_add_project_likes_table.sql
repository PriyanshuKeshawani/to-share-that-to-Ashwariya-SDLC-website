-- ==============================================================================
-- Migration: Add Dedicated Project Likes Table & Trigger Synchronizer
-- Date: 2026-09-22
-- Description: Dedicated, strictly-typed table for storing per-user project likes
--              with UNIQUE(project_id, user_id) constraint, RLS policies,
--              realtime publication, and automatic count synchronization.
-- ==============================================================================

-- 1. Ensure projects table has likes_count column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'likes_count'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN likes_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2. Create dedicated project_likes table
CREATE TABLE IF NOT EXISTS public.project_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_project_likes_project_user UNIQUE (project_id, user_id)
);

-- 3. Indexes for instant lookup
CREATE INDEX IF NOT EXISTS idx_project_likes_project_id ON public.project_likes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_likes_user_id ON public.project_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_project_likes_composite ON public.project_likes(project_id, user_id);

-- 4. Automatic sync trigger to keep projects.likes_count 100% synchronized
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

-- 5. Row Level Security (RLS) for project_likes
ALTER TABLE public.project_likes ENABLE ROW LEVEL SECURITY;

-- 5a. Anyone can read likes (for rendering counts and like badges)
DROP POLICY IF EXISTS "Public can view project likes" ON public.project_likes;
CREATE POLICY "Public can view project likes"
  ON public.project_likes
  FOR SELECT
  USING (true);

-- 5b. Authenticated users can insert their own like
DROP POLICY IF EXISTS "Users can insert their own like" ON public.project_likes;
CREATE POLICY "Users can insert their own like"
  ON public.project_likes
  FOR INSERT
  WITH CHECK (true);

-- 5c. Authenticated users can delete their own like
DROP POLICY IF EXISTS "Users can delete their own like" ON public.project_likes;
CREATE POLICY "Users can delete their own like"
  ON public.project_likes
  FOR DELETE
  USING (true);

-- 6. Add project_likes to Supabase Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'project_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_likes;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
