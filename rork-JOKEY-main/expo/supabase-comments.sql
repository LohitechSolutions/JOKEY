-- Run once in Supabase → SQL Editor to enable joke comments.
-- If a previous attempt failed, this drops and recreates the table safely.

DROP TABLE IF EXISTS public.comments CASCADE;

CREATE TABLE public.comments (
  id TEXT PRIMARY KEY,
  joke_id TEXT NOT NULL REFERENCES public.jokes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) <= 200),
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX comments_joke_id_idx ON public.comments(joke_id);
CREATE INDEX comments_user_id_idx ON public.comments(user_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);
