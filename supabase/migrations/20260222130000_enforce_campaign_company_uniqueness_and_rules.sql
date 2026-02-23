-- Enforce uniqueness and campaign lifecycle rules

-- No two companies can have the exact same name
CREATE UNIQUE INDEX IF NOT EXISTS companies_name_unique_idx
ON public.companies (name);

-- No two campaigns can have the exact same name
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_name_unique_idx
ON public.campaigns (name);

-- A campaign can only have one generated link
CREATE UNIQUE INDEX IF NOT EXISTS company_campaign_links_campaign_id_unique_idx
ON public.company_campaign_links (campaign_id);

-- Link generation is allowed only when campaign is currently active.
CREATE OR REPLACE FUNCTION public.validate_campaign_link_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_active_until TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT start_date, end_date
  INTO v_start_date, v_end_date
  FROM public.campaigns
  WHERE id = NEW.campaign_id
  LIMIT 1;

  IF v_start_date IS NULL OR v_end_date IS NULL THEN
    RAISE EXCEPTION 'Campaign not found for link generation';
  END IF;

  v_active_until := (v_end_date::timestamp + interval '1 day' - interval '1 second');

  IF now() < v_start_date::timestamp OR now() > v_active_until THEN
    RAISE EXCEPTION 'Link can only be generated for an active campaign';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_campaign_link_insert_trigger ON public.company_campaign_links;
CREATE TRIGGER validate_campaign_link_insert_trigger
BEFORE INSERT ON public.company_campaign_links
FOR EACH ROW
EXECUTE FUNCTION public.validate_campaign_link_insert();

-- Start date cannot change once responses exist; end date must be >= start date.
CREATE OR REPLACE FUNCTION public.validate_campaign_update_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_has_responses BOOLEAN;
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'End date cannot be before start date';
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

DROP TRIGGER IF EXISTS validate_campaign_update_rules_trigger ON public.campaigns;
CREATE TRIGGER validate_campaign_update_rules_trigger
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.validate_campaign_update_rules();
