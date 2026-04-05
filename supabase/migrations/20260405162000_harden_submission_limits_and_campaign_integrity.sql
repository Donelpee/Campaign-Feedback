ALTER TABLE public.feedback_submission_attempts
  ADD COLUMN IF NOT EXISTS client_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS attempt_status TEXT NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS response_id UUID REFERENCES public.feedback_responses(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feedback_submission_attempts_attempt_status_check'
  ) THEN
    ALTER TABLE public.feedback_submission_attempts
      ADD CONSTRAINT feedback_submission_attempts_attempt_status_check
      CHECK (attempt_status IN ('received', 'submitted', 'failed', 'rate_limited'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feedback_submission_attempts_client_code_attempted_at
  ON public.feedback_submission_attempts (client_fingerprint, link_code, attempted_at DESC)
  WHERE client_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_submission_attempts_ip_code_attempted_at
  ON public.feedback_submission_attempts (ip_fingerprint, link_code, attempted_at DESC);

CREATE OR REPLACE FUNCTION public.validate_campaign_update_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_has_responses BOOLEAN;
  v_has_links BOOLEAN;
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'End date cannot be before start date';
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.company_campaign_links ccl
      WHERE ccl.campaign_id = OLD.id
    )
    INTO v_has_links;

    IF v_has_links THEN
      RAISE EXCEPTION 'Campaign company cannot be changed after a link has been generated';
    END IF;
  END IF;

  IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.feedback_responses fr
      JOIN public.company_campaign_links ccl ON ccl.id = fr.link_id
      WHERE ccl.campaign_id = OLD.id
    )
    INTO v_has_responses;

    IF v_has_responses THEN
      RAISE EXCEPTION 'Start date cannot be changed once responses are recorded';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
