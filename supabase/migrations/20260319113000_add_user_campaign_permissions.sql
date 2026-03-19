-- Campaign-level access control for admin users

CREATE TABLE IF NOT EXISTS public.user_campaign_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_user_campaign_permissions_user
  ON public.user_campaign_permissions (user_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_user_campaign_permissions_campaign
  ON public.user_campaign_permissions (campaign_id, user_id);

ALTER TABLE public.user_campaign_permissions ENABLE ROW LEVEL SECURITY;

-- Backfill: preserve existing admin access to current campaigns.
INSERT INTO public.user_campaign_permissions (user_id, campaign_id)
SELECT ur.user_id, c.id
FROM public.user_roles ur
CROSS JOIN public.campaigns c
WHERE ur.role = 'admin'
ON CONFLICT (user_id, campaign_id) DO NOTHING;

DROP POLICY IF EXISTS "Super admins can manage campaign permissions"
ON public.user_campaign_permissions;
CREATE POLICY "Super admins can manage campaign permissions"
ON public.user_campaign_permissions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Users can view own campaign permissions"
ON public.user_campaign_permissions;
CREATE POLICY "Users can view own campaign permissions"
ON public.user_campaign_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

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
    ELSE EXISTS (
      SELECT 1
      FROM public.user_campaign_permissions
      WHERE user_id = _user_id
        AND campaign_id = _campaign_id
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.grant_campaign_access_to_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_campaign_permissions (user_id, campaign_id)
  VALUES (v_user_id, NEW.id)
  ON CONFLICT (user_id, campaign_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_campaign_access_to_creator ON public.campaigns;
CREATE TRIGGER trg_grant_campaign_access_to_creator
AFTER INSERT ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.grant_campaign_access_to_creator();

-- Campaign policies: module permission + campaign assignment
DROP POLICY IF EXISTS "Section users can view campaigns" ON public.campaigns;
CREATE POLICY "Section users can view campaigns"
ON public.campaigns
FOR SELECT TO authenticated
USING (
  (
    public.has_permission(auth.uid(), 'overview')
    OR public.has_permission(auth.uid(), 'campaigns')
    OR public.has_permission(auth.uid(), 'links')
    OR public.has_permission(auth.uid(), 'responses')
  )
  AND public.has_campaign_access(auth.uid(), id)
);

DROP POLICY IF EXISTS "Section users can update campaigns" ON public.campaigns;
CREATE POLICY "Section users can update campaigns"
ON public.campaigns
FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), 'campaigns')
  AND public.has_campaign_access(auth.uid(), id)
)
WITH CHECK (
  public.has_permission(auth.uid(), 'campaigns')
  AND public.has_campaign_access(auth.uid(), id)
);

DROP POLICY IF EXISTS "Section users can delete campaigns" ON public.campaigns;
CREATE POLICY "Section users can delete campaigns"
ON public.campaigns
FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), 'campaigns')
  AND public.has_campaign_access(auth.uid(), id)
);

-- Link policies: module permission + campaign assignment
DROP POLICY IF EXISTS "Section users can view links" ON public.company_campaign_links;
CREATE POLICY "Section users can view links"
ON public.company_campaign_links
FOR SELECT TO authenticated
USING (
  (
    public.has_permission(auth.uid(), 'overview')
    OR public.has_permission(auth.uid(), 'links')
    OR public.has_permission(auth.uid(), 'responses')
  )
  AND public.has_campaign_access(auth.uid(), campaign_id)
);

DROP POLICY IF EXISTS "Section users can insert links" ON public.company_campaign_links;
CREATE POLICY "Section users can insert links"
ON public.company_campaign_links
FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), 'links')
  AND public.has_campaign_access(auth.uid(), campaign_id)
);

DROP POLICY IF EXISTS "Section users can update links" ON public.company_campaign_links;
CREATE POLICY "Section users can update links"
ON public.company_campaign_links
FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), 'links')
  AND public.has_campaign_access(auth.uid(), campaign_id)
)
WITH CHECK (
  public.has_permission(auth.uid(), 'links')
  AND public.has_campaign_access(auth.uid(), campaign_id)
);

DROP POLICY IF EXISTS "Section users can delete links" ON public.company_campaign_links;
CREATE POLICY "Section users can delete links"
ON public.company_campaign_links
FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), 'links')
  AND public.has_campaign_access(auth.uid(), campaign_id)
);

-- Response policy: module permission + campaign assignment through link
DROP POLICY IF EXISTS "Section users can view responses" ON public.feedback_responses;
CREATE POLICY "Section users can view responses"
ON public.feedback_responses
FOR SELECT TO authenticated
USING (
  (
    public.has_permission(auth.uid(), 'overview')
    OR public.has_permission(auth.uid(), 'responses')
  )
  AND EXISTS (
    SELECT 1
    FROM public.company_campaign_links ccl
    WHERE ccl.id = feedback_responses.link_id
      AND public.has_campaign_access(auth.uid(), ccl.campaign_id)
  )
);
