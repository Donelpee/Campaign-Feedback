-- Add username support and username -> email lookup for sign-in.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

UPDATE public.profiles
SET username = split_part(email, '@', 1) || '_' || left(user_id::text, 6)
WHERE username IS NULL OR btrim(username) = '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    split_part(NEW.email, '@', 1) || '_' || left(NEW.id::text, 6)
  );

  INSERT INTO public.profiles (user_id, email, full_name, username)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', v_username);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE lower(username) = lower(btrim(p_username))
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;
