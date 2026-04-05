ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_name TEXT;

UPDATE public.profiles
SET organization_name = COALESCE(NULLIF(BTRIM(organization_name), ''), NULLIF(BTRIM(full_name), ''), NULLIF(BTRIM(username), ''))
WHERE organization_name IS NULL OR BTRIM(organization_name) = '';

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
  v_organization_name TEXT := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'organization_name'), '');
BEGIN
  INSERT INTO public.profiles (
    user_id,
    email,
    full_name,
    username,
    account_type,
    respondent_name_preference,
    organization_name
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'username'), ''),
    v_account_type,
    v_respondent_name_preference,
    CASE
      WHEN v_account_type = 'organization'
        THEN COALESCE(v_organization_name, NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''))
      ELSE v_organization_name
    END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    account_type = EXCLUDED.account_type,
    respondent_name_preference = EXCLUDED.respondent_name_preference,
    organization_name = COALESCE(EXCLUDED.organization_name, public.profiles.organization_name);

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
      ELSE COALESCE(NULLIF(BTRIM(owner.organization_name), ''), c.name)
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
