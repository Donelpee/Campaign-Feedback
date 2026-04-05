-- Fix public feedback link loading after thank-you signoff changes.
-- campaigns does not have updated_by_user_id, so owner lookup must only use
-- columns that exist across legacy and current schemas.
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
      WHEN COALESCE(owner.show_thank_you_signoff, true) = false THEN NULL
      WHEN COALESCE(owner.account_type, 'organization') = 'individual'
        THEN COALESCE(NULLIF(BTRIM(owner.full_name), ''), NULLIF(BTRIM(owner.username), ''), c.name)
      ELSE COALESCE(NULLIF(BTRIM(owner.organization_name), ''), c.name)
    END,
    'thank_you_display_preference',
    CASE
      WHEN COALESCE(owner.show_thank_you_signoff, true) = false
        THEN 'hidden'
      WHEN COALESCE(owner.account_type, 'organization') = 'individual'
        THEN 'individual_name'
      ELSE 'organization_name'
    END
  ) INTO result
  FROM public.company_campaign_links ccl
  JOIN public.companies c ON c.id = ccl.company_id
  JOIN public.campaigns camp ON camp.id = ccl.campaign_id
  LEFT JOIN public.profiles owner
    ON owner.user_id = COALESCE(
      camp.created_by_user_id,
      c.created_by_user_id,
      c.updated_by_user_id
    )
  WHERE ccl.unique_code = p_code;

  RETURN result;
END;
$$;
