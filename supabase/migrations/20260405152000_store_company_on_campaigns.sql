ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_company_id
  ON public.campaigns (company_id);

UPDATE public.campaigns AS camp
SET company_id = ccl.company_id
FROM public.company_campaign_links AS ccl
WHERE ccl.campaign_id = camp.id
  AND camp.company_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_campaign_tenant_and_owner_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tenant UUID;
  v_company_tenant UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_user_tenant := public.get_user_tenant(auth.uid());
  IF v_user_tenant IS NULL THEN
    RAISE EXCEPTION 'User has no tenant context';
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_user_tenant;
  END IF;

  IF NEW.created_by_user_id IS NULL THEN
    NEW.created_by_user_id := auth.uid();
  END IF;

  IF NEW.company_id IS NOT NULL THEN
    SELECT c.tenant_id
    INTO v_company_tenant
    FROM public.companies c
    WHERE c.id = NEW.company_id;

    IF v_company_tenant IS NULL THEN
      RAISE EXCEPTION 'Selected company does not exist';
    END IF;

    IF v_company_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Campaign and company must belong to the same tenant';
    END IF;
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin') AND NEW.tenant_id <> v_user_tenant THEN
    RAISE EXCEPTION 'Cross-tenant write is not allowed';
  END IF;

  RETURN NEW;
END;
$$;
