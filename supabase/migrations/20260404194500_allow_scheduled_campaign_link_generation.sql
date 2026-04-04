-- Allow admins to generate feedback links for scheduled campaigns.
-- Submission access is still enforced separately by the public form
-- and submit_feedback_response() date checks.

CREATE OR REPLACE FUNCTION public.validate_campaign_link_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.campaigns
    WHERE id = NEW.campaign_id
  ) THEN
    RAISE EXCEPTION 'Campaign not found for link generation';
  END IF;

  RETURN NEW;
END;
$$;
