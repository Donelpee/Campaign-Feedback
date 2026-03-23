-- Multi-tenant foundation (single-tenant-per-user) + creator-first campaign response visibility

-- 1) Tenants
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Add tenant columns + creator ownership.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.company_campaign_links
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.feedback_responses
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.onboarding_invites
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 3) Backfill a default tenant and map existing rows.
INSERT INTO public.tenants (name, created_by)
SELECT
  'Default Workspace',
  (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'super_admin'
    ORDER BY ur.created_at ASC
    LIMIT 1
  )
WHERE NOT EXISTS (SELECT 1 FROM public.tenants);

CREATE OR REPLACE FUNCTION public.default_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.tenants
  ORDER BY created_at ASC
  LIMIT 1
$$;

UPDATE public.profiles
SET tenant_id = public.default_tenant_id()
WHERE tenant_id IS NULL;

UPDATE public.companies
SET tenant_id = public.default_tenant_id()
WHERE tenant_id IS NULL;

UPDATE public.campaigns
SET tenant_id = public.default_tenant_id()
WHERE tenant_id IS NULL;

WITH fallback_creator AS (
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('super_admin', 'admin')
  ORDER BY
    CASE WHEN ur.role = 'super_admin' THEN 0 ELSE 1 END,
    ur.created_at ASC
  LIMIT 1
)
UPDATE public.campaigns c
SET created_by_user_id = fc.user_id
FROM fallback_creator fc
WHERE c.created_by_user_id IS NULL;

UPDATE public.company_campaign_links l
SET tenant_id = COALESCE(c.tenant_id, camp.tenant_id, public.default_tenant_id())
FROM public.companies c, public.campaigns camp
WHERE c.id = l.company_id
  AND camp.id = l.campaign_id
  AND l.tenant_id IS NULL;

UPDATE public.feedback_responses fr
SET
  campaign_id = ccl.campaign_id,
  tenant_id = COALESCE(ccl.tenant_id, public.default_tenant_id())
FROM public.company_campaign_links ccl
WHERE ccl.id = fr.link_id
  AND (fr.campaign_id IS NULL OR fr.tenant_id IS NULL);

UPDATE public.onboarding_invites oi
SET tenant_id = p.tenant_id
FROM public.profiles p
WHERE oi.created_by = p.user_id
  AND oi.tenant_id IS NULL;

UPDATE public.onboarding_invites
SET tenant_id = public.default_tenant_id()
WHERE tenant_id IS NULL;

-- 4) Enforce one-tenant-per-user and non-null tenant context.
ALTER TABLE public.profiles
  ALTER COLUMN tenant_id SET DEFAULT public.default_tenant_id();
ALTER TABLE public.profiles
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.companies
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.campaigns
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.company_campaign_links
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.feedback_responses
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN campaign_id SET NOT NULL;

ALTER TABLE public.onboarding_invites
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON public.companies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON public.campaigns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by_user_id ON public.campaigns (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_links_tenant_id ON public.company_campaign_links (tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_tenant_id ON public.feedback_responses (tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_campaign_id ON public.feedback_responses (campaign_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_invites_tenant_id ON public.onboarding_invites (tenant_id);

-- 5) Tenant helper functions.
CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.tenant_id
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin')
    OR public.get_user_tenant(_user_id) = _tenant_id
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin')
    OR (
      public.has_role(_user_id, 'admin')
      AND public.get_user_tenant(_user_id) = _tenant_id
    )
$$;

CREATE OR REPLACE FUNCTION public.is_campaign_owner(_user_id UUID, _campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id = _campaign_id
      AND c.created_by_user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_campaign_access(_user_id UUID, _campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id = _campaign_id
      AND (
        public.has_role(_user_id, 'super_admin')
        OR public.is_tenant_admin(_user_id, c.tenant_id)
        OR c.created_by_user_id = _user_id
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_campaign_responses(_user_id UUID, _campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id = _campaign_id
      AND (
        public.has_role(_user_id, 'super_admin')
        OR (
          public.is_tenant_admin(_user_id, c.tenant_id)
          AND (
            public.has_permission(_user_id, 'overview')
            OR public.has_permission(_user_id, 'responses')
          )
        )
        OR c.created_by_user_id = _user_id
      )
  )
$$;

DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
CREATE POLICY "Users can view own tenant"
ON public.tenants
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR id = public.get_user_tenant(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage tenants" ON public.tenants;
CREATE POLICY "Super admins can manage tenants"
ON public.tenants
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 6) Tenant assignment triggers.
CREATE OR REPLACE FUNCTION public.set_company_tenant_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tenant UUID;
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

  IF NOT public.has_role(auth.uid(), 'super_admin') AND NEW.tenant_id <> v_user_tenant THEN
    RAISE EXCEPTION 'Cross-tenant write is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_company_tenant_context ON public.companies;
CREATE TRIGGER trg_set_company_tenant_context
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.set_company_tenant_context();

CREATE OR REPLACE FUNCTION public.set_campaign_tenant_and_owner_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tenant UUID;
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

  IF NOT public.has_role(auth.uid(), 'super_admin') AND NEW.tenant_id <> v_user_tenant THEN
    RAISE EXCEPTION 'Cross-tenant write is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_campaign_tenant_and_owner_context ON public.campaigns;
CREATE TRIGGER trg_set_campaign_tenant_and_owner_context
BEFORE INSERT OR UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.set_campaign_tenant_and_owner_context();

CREATE OR REPLACE FUNCTION public.set_link_tenant_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_tenant UUID;
  v_campaign_tenant UUID;
BEGIN
  SELECT c.tenant_id INTO v_company_tenant
  FROM public.companies c
  WHERE c.id = NEW.company_id;

  SELECT camp.tenant_id INTO v_campaign_tenant
  FROM public.campaigns camp
  WHERE camp.id = NEW.campaign_id;

  IF v_company_tenant IS NULL OR v_campaign_tenant IS NULL THEN
    RAISE EXCEPTION 'Invalid company or campaign for link';
  END IF;

  IF v_company_tenant <> v_campaign_tenant THEN
    RAISE EXCEPTION 'Company and campaign must belong to the same tenant';
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_company_tenant;
  END IF;

  IF NEW.tenant_id <> v_company_tenant THEN
    RAISE EXCEPTION 'Link tenant mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_link_tenant_context ON public.company_campaign_links;
CREATE TRIGGER trg_set_link_tenant_context
BEFORE INSERT OR UPDATE ON public.company_campaign_links
FOR EACH ROW
EXECUTE FUNCTION public.set_link_tenant_context();

-- 7) Update secure feedback submission to include tenant and campaign context.
CREATE OR REPLACE FUNCTION public.submit_feedback_response(p_code TEXT, p_payload JSONB)
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
BEGIN
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
    answers
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
    COALESCE(p_payload->'answers', '{}'::jsonb)
  )
  RETURNING id INTO v_response_id;

  RETURN v_response_id;
END;
$$;

-- 8) Tenant-safe user-management and data-access policies.

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users section can view all profiles" ON public.profiles;
CREATE POLICY "Tenant users can view profiles"
ON public.profiles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  )
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_user_tenant(auth.uid()));

-- Roles and permissions tables
DROP POLICY IF EXISTS "Users section can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "User managers can manage admin roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;

CREATE POLICY "Tenant users can view roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND public.get_user_tenant(auth.uid()) = public.get_user_tenant(user_id)
  )
);

CREATE POLICY "Tenant managers can manage roles"
ON public.user_roles
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND public.get_user_tenant(auth.uid()) = public.get_user_tenant(user_id)
    AND role <> 'super_admin'
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND public.get_user_tenant(auth.uid()) = public.get_user_tenant(user_id)
    AND role <> 'super_admin'
  )
);

DROP POLICY IF EXISTS "Users can view own module permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Users managers can manage module permissions" ON public.user_module_permissions;
CREATE POLICY "Users can view own module permissions"
ON public.user_module_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Tenant managers can manage module permissions"
ON public.user_module_permissions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND public.get_user_tenant(auth.uid()) = public.get_user_tenant(user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = user_module_permissions.user_id
        AND ur.role = 'super_admin'
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND public.get_user_tenant(auth.uid()) = public.get_user_tenant(user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = user_module_permissions.user_id
        AND ur.role = 'super_admin'
    )
  )
);

DROP POLICY IF EXISTS "Users can view own company permissions" ON public.user_company_permissions;
DROP POLICY IF EXISTS "User managers can manage company permissions" ON public.user_company_permissions;
CREATE POLICY "Users can view own company permissions"
ON public.user_company_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Tenant managers can manage company permissions"
ON public.user_company_permissions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND public.get_user_tenant(auth.uid()) = public.get_user_tenant(user_id)
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = user_company_permissions.company_id
        AND c.tenant_id = public.get_user_tenant(auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = user_company_permissions.user_id
        AND ur.role = 'super_admin'
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND public.get_user_tenant(auth.uid()) = public.get_user_tenant(user_id)
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = user_company_permissions.company_id
        AND c.tenant_id = public.get_user_tenant(auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = user_company_permissions.user_id
        AND ur.role = 'super_admin'
    )
  )
);

DROP POLICY IF EXISTS "Users managers can manage onboarding invites" ON public.onboarding_invites;
CREATE POLICY "Tenant managers can manage onboarding invites"
ON public.onboarding_invites
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND tenant_id = public.get_user_tenant(auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND tenant_id = public.get_user_tenant(auth.uid())
  )
);

-- Core domain tables
DROP POLICY IF EXISTS "Section users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Section users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Section users can update companies" ON public.companies;
DROP POLICY IF EXISTS "Section users can delete companies" ON public.companies;

CREATE POLICY "Tenant users can view companies"
ON public.companies
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.has_permission(auth.uid(), 'overview')
      OR public.has_permission(auth.uid(), 'companies')
      OR public.has_permission(auth.uid(), 'campaigns')
      OR public.has_permission(auth.uid(), 'links')
      OR public.has_permission(auth.uid(), 'responses')
    )
  )
);

CREATE POLICY "Tenant users can insert companies"
ON public.companies
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_permission(auth.uid(), 'companies')
  )
);

CREATE POLICY "Tenant users can update companies"
ON public.companies
FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_permission(auth.uid(), 'companies')
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_permission(auth.uid(), 'companies')
  )
);

CREATE POLICY "Tenant users can delete companies"
ON public.companies
FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_permission(auth.uid(), 'companies')
  )
);

DROP POLICY IF EXISTS "Section users can view campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Section users can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Section users can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Section users can delete campaigns" ON public.campaigns;

CREATE POLICY "Tenant users can view campaigns"
ON public.campaigns
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (
      (
        public.is_tenant_admin(auth.uid(), tenant_id)
        AND (
          public.has_permission(auth.uid(), 'overview')
          OR public.has_permission(auth.uid(), 'campaigns')
          OR public.has_permission(auth.uid(), 'links')
          OR public.has_permission(auth.uid(), 'responses')
        )
      )
      OR created_by_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Tenant users can insert campaigns"
ON public.campaigns
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_permission(auth.uid(), 'campaigns')
  )
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "Tenant users can update campaigns"
ON public.campaigns
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    tenant_id = public.get_user_tenant(auth.uid())
    AND public.has_permission(auth.uid(), 'campaigns')
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR created_by_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    tenant_id = public.get_user_tenant(auth.uid())
    AND public.has_permission(auth.uid(), 'campaigns')
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR created_by_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Tenant users can delete campaigns"
ON public.campaigns
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    tenant_id = public.get_user_tenant(auth.uid())
    AND public.has_permission(auth.uid(), 'campaigns')
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR created_by_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Section users can view links" ON public.company_campaign_links;
DROP POLICY IF EXISTS "Section users can insert links" ON public.company_campaign_links;
DROP POLICY IF EXISTS "Section users can update links" ON public.company_campaign_links;
DROP POLICY IF EXISTS "Section users can delete links" ON public.company_campaign_links;

CREATE POLICY "Tenant users can view links"
ON public.company_campaign_links
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (
      (
        public.is_tenant_admin(auth.uid(), tenant_id)
        AND (
          public.has_permission(auth.uid(), 'overview')
          OR public.has_permission(auth.uid(), 'links')
          OR public.has_permission(auth.uid(), 'responses')
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.campaigns c
        WHERE c.id = company_campaign_links.campaign_id
          AND c.created_by_user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Tenant users can insert links"
ON public.company_campaign_links
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND public.has_permission(auth.uid(), 'links')
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = company_campaign_links.campaign_id
        AND c.created_by_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Tenant users can update links"
ON public.company_campaign_links
FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND public.has_permission(auth.uid(), 'links')
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = company_campaign_links.campaign_id
        AND c.created_by_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND public.has_permission(auth.uid(), 'links')
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = company_campaign_links.campaign_id
        AND c.created_by_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Tenant users can delete links"
ON public.company_campaign_links
FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND public.has_permission(auth.uid(), 'links')
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = company_campaign_links.campaign_id
        AND c.created_by_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Section users can view responses" ON public.feedback_responses;
CREATE POLICY "Tenant users can view responses"
ON public.feedback_responses
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    tenant_id = public.get_user_tenant(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = feedback_responses.campaign_id
        AND public.can_view_campaign_responses(auth.uid(), c.id)
    )
  )
);
