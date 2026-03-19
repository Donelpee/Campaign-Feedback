-- Company-based user access model:
-- if a user can access a company, they automatically access that company's campaigns.

CREATE TABLE IF NOT EXISTS public.user_company_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_company_permissions_user
  ON public.user_company_permissions (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_user_company_permissions_company
  ON public.user_company_permissions (company_id, user_id);

ALTER TABLE public.user_company_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company permissions"
ON public.user_company_permissions;
CREATE POLICY "Users can view own company permissions"
ON public.user_company_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "User managers can manage company permissions"
ON public.user_company_permissions;
CREATE POLICY "User managers can manage company permissions"
ON public.user_company_permissions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = user_company_permissions.user_id
        AND ur.role = 'admin'
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = user_company_permissions.user_id
        AND ur.role = 'admin'
    )
  )
);

CREATE OR REPLACE FUNCTION public.has_company_access(
  _user_id UUID,
  _company_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'super_admin'
    ) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.user_company_permissions
      WHERE user_id = _user_id
        AND company_id = _company_id
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.has_campaign_access(
  _user_id UUID,
  _campaign_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'super_admin'
    ) THEN true
    WHEN EXISTS (
      SELECT 1
      FROM public.company_campaign_links ccl
      JOIN public.user_company_permissions ucp
        ON ucp.company_id = ccl.company_id
      WHERE ccl.campaign_id = _campaign_id
        AND ucp.user_id = _user_id
    ) THEN true
    WHEN NOT EXISTS (
      SELECT 1
      FROM public.company_campaign_links ccl
      WHERE ccl.campaign_id = _campaign_id
    ) AND public.has_permission(_user_id, 'campaigns') THEN true
    ELSE false
  END
$$;

-- Backfill company access for existing admin users so rollout is non-breaking.
INSERT INTO public.user_company_permissions (user_id, company_id)
SELECT ur.user_id, c.id
FROM public.user_roles ur
CROSS JOIN public.companies c
WHERE ur.role = 'admin'
ON CONFLICT (user_id, company_id) DO NOTHING;
