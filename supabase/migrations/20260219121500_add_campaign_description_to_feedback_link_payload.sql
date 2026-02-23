-- Include campaign description in public link payload used by respondent form
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
    'end_date', camp.end_date
  ) INTO result
  FROM company_campaign_links ccl
  JOIN companies c ON c.id = ccl.company_id
  JOIN campaigns camp ON camp.id = ccl.campaign_id
  WHERE ccl.unique_code = p_code;

  RETURN result;
END;
$$;
