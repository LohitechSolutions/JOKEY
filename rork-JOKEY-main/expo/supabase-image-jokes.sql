-- Run in Supabase SQL Editor to enable admin image jokes on the homepage.
-- Then grant admin to your account, e.g.:
-- UPDATE public.users SET is_admin = true WHERE email = 'you@example.com';

INSERT INTO storage.buckets (id, name, public)
VALUES ('image-jokes', 'image-jokes', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE TABLE IF NOT EXISTS public.image_jokes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS image_jokes_created_at_idx ON public.image_jokes(created_at DESC);

ALTER TABLE public.image_jokes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Image jokes are viewable by everyone" ON public.image_jokes;
CREATE POLICY "Image jokes are viewable by everyone"
  ON public.image_jokes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert image jokes" ON public.image_jokes;
CREATE POLICY "Admins can insert image jokes"
  ON public.image_jokes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can delete image jokes" ON public.image_jokes;
CREATE POLICY "Admins can delete image jokes"
  ON public.image_jokes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Image joke files are public" ON storage.objects;
CREATE POLICY "Image joke files are public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'image-jokes');

DROP POLICY IF EXISTS "Admins can upload image jokes" ON storage.objects;
CREATE POLICY "Admins can upload image jokes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'image-jokes'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can delete image joke files" ON storage.objects;
CREATE POLICY "Admins can delete image joke files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'image-jokes'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );
