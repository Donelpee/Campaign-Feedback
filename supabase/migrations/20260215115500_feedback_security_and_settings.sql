-- Harden anonymous feedback submission and add persisted user settings

-- Store full dynamic answers payload while keeping legacy metric columns
ALTER TABLE public.feedback_responses
ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Remove permissive direct insert policies; feedback submissions should flow through RPC validation
DROP POLICY IF EXISTS "Anyone can insert responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Anyone can submit feedback responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback_responses;

-- Extend public feedback link payload to include campaign metadata/questions
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

-- Secure submission RPC: validates link status + campaign window before insert
CREATE OR REPLACE FUNCTION public.submit_feedback_response(p_code TEXT, p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_id UUID;
  v_is_active BOOLEAN;
  v_start_date DATE;
  v_end_date DATE;
  v_overall INTEGER;
  v_quality INTEGER;
  v_recommendation INTEGER;
  v_comments TEXT;
  v_response_id UUID;
  v_areas TEXT[];
BEGIN
  SELECT ccl.id, ccl.is_active, camp.start_date, camp.end_date
  INTO v_link_id, v_is_active, v_start_date, v_end_date
  FROM public.company_campaign_links ccl
  JOIN public.campaigns camp ON camp.id = ccl.campaign_id
  WHERE ccl.unique_code = p_code
  LIMIT 1;

  IF v_link_id IS NULL THEN
    RAISE EXCEPTION 'Invalid feedback link';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Feedback link is inactive';
  END IF;

  IF CURRENT_DATE < v_start_date THEN
    RAISE EXCEPTION 'Campaign has not started';
  END IF;

  IF CURRENT_DATE > v_end_date THEN
    RAISE EXCEPTION 'Campaign has ended';
  END IF;

  v_overall := GREATEST(1, LEAST(10, COALESCE((p_payload->>'overall_satisfaction')::INTEGER, 5)));
  v_quality := GREATEST(1, LEAST(5, COALESCE((p_payload->>'service_quality')::INTEGER, 3)));
  v_recommendation := GREATEST(1, LEAST(5, COALESCE((p_payload->>'recommendation_likelihood')::INTEGER, 3)));
  v_comments := NULLIF(TRIM(COALESCE(p_payload->>'additional_comments', '')), '');

  SELECT COALESCE(array_agg(value), ARRAY[]::TEXT[])
  INTO v_areas
  FROM jsonb_array_elements_text(COALESCE(p_payload->'improvement_areas', '[]'::jsonb)) AS value;

  INSERT INTO public.feedback_responses (
    link_id,
    overall_satisfaction,
    service_quality,
    recommendation_likelihood,
    improvement_areas,
    additional_comments,
    answers
  )
  VALUES (
    v_link_id,
    v_overall,
    v_quality,
    v_recommendation,
    v_areas,
    v_comments,
    COALESCE(p_payload->'answers', '{}'::jsonb)
  )
  RETURNING id INTO v_response_id;

  RETURN v_response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_feedback_response(TEXT, JSONB) TO anon, authenticated;

-- Persist per-user settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  weekly_summary BOOLEAN NOT NULL DEFAULT false,
  compact_view BOOLEAN NOT NULL DEFAULT false,
  show_response_timestamps BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
ON public.user_settings
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings"
ON public.user_settings
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
ON public.user_settings
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
