-- Run once in Supabase -> SQL Editor to enable video posts.
-- Creates the videos table and a public storage bucket for recorded videos.

INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE TABLE IF NOT EXISTS public.videos (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  video_uri TEXT NOT NULL,
  thumbnail_uri TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'courtes',
  tags TEXT[] NOT NULL DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'FR',
  level TEXT NOT NULL DEFAULT 'all' CHECK (level IN ('all', 'adult')),
  allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  reactions JSONB NOT NULL DEFAULT '{"😂":0,"🤣":0,"😭":0,"💀":0,"👏":0,"❤️":0}'::jsonb,
  comments_count INTEGER NOT NULL DEFAULT 0,
  is_trending BOOLEAN NOT NULL DEFAULT FALSE,
  average_rating NUMERIC(3, 1) NOT NULL DEFAULT 0,
  total_ratings INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS videos_user_id_idx ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS videos_created_at_idx ON public.videos(created_at DESC);
CREATE INDEX IF NOT EXISTS videos_category_idx ON public.videos(category);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Videos are viewable by everyone" ON public.videos;
CREATE POLICY "Videos are viewable by everyone"
  ON public.videos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert their own videos" ON public.videos;
CREATE POLICY "Authenticated users can insert their own videos"
  ON public.videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own videos" ON public.videos;
CREATE POLICY "Users can update their own videos"
  ON public.videos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own videos" ON public.videos;
CREATE POLICY "Users can delete their own videos"
  ON public.videos FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Video files are public" ON storage.objects;
CREATE POLICY "Video files are public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
CREATE POLICY "Authenticated users can upload videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update uploaded videos" ON storage.objects;
CREATE POLICY "Users can update uploaded videos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'videos' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete uploaded videos" ON storage.objects;
CREATE POLICY "Users can delete uploaded videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'videos' AND auth.role() = 'authenticated');
