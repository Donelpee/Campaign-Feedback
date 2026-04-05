ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'organization',
  ADD COLUMN IF NOT EXISTS respondent_name_preference TEXT NOT NULL DEFAULT 'organization_name';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_account_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_type_check
      CHECK (account_type IN ('individual', 'organization'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_respondent_name_preference_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_respondent_name_preference_check
      CHECK (respondent_name_preference IN ('individual_name', 'organization_name'));
  END IF;
END $$;

UPDATE public.profiles
SET
  full_name = COALESCE(NULLIF(BTRIM(full_name), ''), NULLIF(BTRIM(username), ''), full_name),
  account_type = COALESCE(NULLIF(BTRIM(account_type), ''), 'organization'),
  respondent_name_preference = CASE
    WHEN COALESCE(NULLIF(BTRIM(account_type), ''), 'organization') = 'individual'
      THEN 'individual_name'
    ELSE COALESCE(NULLIF(BTRIM(respondent_name_preference), ''), 'organization_name')
  END;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_account_type TEXT := CASE
    WHEN lower(COALESCE(NEW.raw_user_meta_data ->> 'account_type', 'organization')) = 'individual'
      THEN 'individual'
    ELSE 'organization'
  END;
  v_respondent_name_preference TEXT := CASE
    WHEN lower(COALESCE(NEW.raw_user_meta_data ->> 'account_type', 'organization')) = 'individual'
      THEN 'individual_name'
    WHEN lower(COALESCE(NEW.raw_user_meta_data ->> 'respondent_name_preference', 'organization_name')) = 'individual_name'
      THEN 'individual_name'
    ELSE 'organization_name'
  END;
BEGIN
  INSERT INTO public.profiles (
    user_id,
    email,
    full_name,
    username,
    account_type,
    respondent_name_preference
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'username'), ''),
    v_account_type,
    v_respondent_name_preference
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    account_type = EXCLUDED.account_type,
    respondent_name_preference = EXCLUDED.respondent_name_preference;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_feedback_link_data(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', ccl.id,
    'is_active', ccl.is_active,
    'company_name', c.name,
    'company_logo_url', c.logo_url,
    'campaign_name', camp.name,
    'campaign_description', camp.description,
    'campaign_type', camp.campaign_type,
    'campaign_questions', COALESCE(camp.questions, '[]'::jsonb),
    'start_date', camp.start_date,
    'end_date', camp.end_date,
    'thank_you_display_name',
    CASE
      WHEN COALESCE(owner.account_type, 'organization') = 'individual'
        THEN COALESCE(NULLIF(BTRIM(owner.full_name), ''), NULLIF(BTRIM(owner.username), ''), c.name)
      WHEN COALESCE(owner.respondent_name_preference, 'organization_name') = 'individual_name'
        THEN COALESCE(NULLIF(BTRIM(owner.full_name), ''), NULLIF(BTRIM(owner.username), ''), c.name)
      ELSE c.name
    END,
    'thank_you_display_preference',
    CASE
      WHEN COALESCE(owner.account_type, 'organization') = 'individual'
        THEN 'individual_name'
      ELSE COALESCE(owner.respondent_name_preference, 'organization_name')
    END
  ) INTO result
  FROM public.company_campaign_links ccl
  JOIN public.companies c ON c.id = ccl.company_id
  JOIN public.campaigns camp ON camp.id = ccl.campaign_id
  LEFT JOIN public.profiles owner
    ON owner.user_id = COALESCE(
      camp.created_by_user_id,
      camp.updated_by_user_id,
      c.created_by_user_id,
      c.updated_by_user_id
    )
  WHERE ccl.unique_code = p_code;

  RETURN result;
END;
$$;
