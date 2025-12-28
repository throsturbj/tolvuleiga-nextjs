-- Reviews table for front-page testimonials
-- Uses pgcrypto's gen_random_uuid() which is available on Supabase

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  reviewer_name text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful index for ordering/filtering
CREATE INDEX IF NOT EXISTS reviews_published_created_idx
  ON public.reviews (is_published, created_at DESC);

-- Enable RLS and allow public read of published reviews only
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reviews'
      AND policyname = 'Public can read published reviews'
  ) THEN
    CREATE POLICY "Public can read published reviews"
      ON public.reviews
      FOR SELECT
      TO anon, authenticated
      USING (is_published = true);
  END IF;
END $$;

-- Optional: example inserts (uncomment and edit)
-- INSERT INTO public.reviews (content, reviewer_name, rating) VALUES
--   ('Frábær þjónusta og glæsileg tölva!', 'Jón Jónsson', 5),
--   ('Mjög ánægður með afköstin.', 'Guðrún Þórsdóttir', 4);

