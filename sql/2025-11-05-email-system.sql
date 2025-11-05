-- Add emailsent column to users table
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns 
		WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'emailsent'
	) THEN
		ALTER TABLE public.users ADD COLUMN emailsent boolean NOT NULL DEFAULT false;
	END IF;
END $$;

-- Create contact_rate_limit table for IP-based rate limiting
CREATE TABLE IF NOT EXISTS public.contact_rate_limit (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	ip text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_rate_limit_ip_created_idx
	ON public.contact_rate_limit (ip, created_at DESC);

-- Optional: trigger to auto-create users row on auth signup (if desired)
-- Requires pgcrypto or uuid-ossp for gen_random_uuid(); Supabase provides pgcrypto
-- Uncomment if you want automatic users row provisioning
--
-- CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
-- RETURNS trigger AS $$
-- BEGIN
--   INSERT INTO public.users (auth_uid)
--   VALUES (NEW.id)
--   ON CONFLICT DO NOTHING;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


