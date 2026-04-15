ALTER TABLE public.feedback_responses
  ADD COLUMN IF NOT EXISTS submission_token TEXT,
  ADD COLUMN IF NOT EXISTS submission_payload_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_responses_submission_token
  ON public.feedback_responses (submission_token);

ALTER TABLE public.feedback_submission_attempts
  ADD COLUMN IF NOT EXISTS submission_token TEXT,
  ADD COLUMN IF NOT EXISTS payload_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_feedback_submission_attempts_submission_token_attempted_at
  ON public.feedback_submission_attempts (submission_token, attempted_at DESC)
  WHERE submission_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.submit_feedback_response(
  p_code TEXT,
  p_payload JSONB,
  p_submission_token TEXT DEFAULT NULL,
  p_submission_payload_hash TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_id UUID;
  v_campaign_id UUID;
  v_tenant_id UUID;
  v_is_active BOOLEAN;
  v_start_date DATE;
  v_end_date DATE;
  v_overall INTEGER;
  v_quality INTEGER;
  v_recommendation INTEGER;
  v_comments TEXT;
  v_response_id UUID;
  v_areas TEXT[];
  v_submission_token TEXT := NULLIF(BTRIM(p_submission_token), '');
  v_submission_payload_hash TEXT := NULLIF(BTRIM(p_submission_payload_hash), '');
  v_existing_payload_hash TEXT;
BEGIN
  IF v_submission_token IS NOT NULL THEN
    SELECT fr.id, fr.submission_payload_hash
    INTO v_response_id, v_existing_payload_hash
    FROM public.feedback_responses fr
    WHERE fr.submission_token = v_submission_token
    LIMIT 1;

    IF v_response_id IS NOT NULL THEN
      IF v_submission_payload_hash IS NOT NULL
         AND v_existing_payload_hash IS NOT NULL
         AND v_existing_payload_hash IS DISTINCT FROM v_submission_payload_hash THEN
        RAISE EXCEPTION 'Submission token payload mismatch';
      END IF;

      RETURN v_response_id;
    END IF;
  END IF;

  SELECT ccl.id, ccl.campaign_id, ccl.tenant_id, ccl.is_active, camp.start_date, camp.end_date
  INTO v_link_id, v_campaign_id, v_tenant_id, v_is_active, v_start_date, v_end_date
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
    campaign_id,
    tenant_id,
    overall_satisfaction,
    service_quality,
    recommendation_likelihood,
    improvement_areas,
    additional_comments,
    answers,
    submission_token,
    submission_payload_hash
  )
  VALUES (
    v_link_id,
    v_campaign_id,
    v_tenant_id,
    v_overall,
    v_quality,
    v_recommendation,
    v_areas,
    v_comments,
    COALESCE(p_payload->'answers', '{}'::jsonb),
    v_submission_token,
    v_submission_payload_hash
  )
  ON CONFLICT (submission_token) DO UPDATE
    SET submission_token = EXCLUDED.submission_token
  RETURNING id, submission_payload_hash
  INTO v_response_id, v_existing_payload_hash;

  IF v_submission_token IS NOT NULL
     AND v_submission_payload_hash IS NOT NULL
     AND v_existing_payload_hash IS NOT NULL
     AND v_existing_payload_hash IS DISTINCT FROM v_submission_payload_hash THEN
    RAISE EXCEPTION 'Submission token payload mismatch';
  END IF;

  RETURN v_response_id;
END;
$$;
