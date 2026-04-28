CREATE TABLE IF NOT EXISTS public.campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT public.default_tenant_id(),
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'feedback',
  questions JSONB NOT NULL DEFAULT '{"version":2,"sections":[],"questions":[]}'::jsonb,
  source_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_templates_tenant_id_created_at
  ON public.campaign_templates (tenant_id, created_at DESC);

ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view campaign templates" ON public.campaign_templates;
CREATE POLICY "Admins can view campaign templates"
ON public.campaign_templates
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_permission(auth.uid(), 'campaigns')
  )
);

DROP POLICY IF EXISTS "Admins can insert campaign templates" ON public.campaign_templates;
CREATE POLICY "Admins can insert campaign templates"
ON public.campaign_templates
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_permission(auth.uid(), 'campaigns')
  )
);

DROP POLICY IF EXISTS "Admins can update campaign templates" ON public.campaign_templates;
CREATE POLICY "Admins can update campaign templates"
ON public.campaign_templates
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_permission(auth.uid(), 'campaigns')
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_permission(auth.uid(), 'campaigns')
  )
);

DROP POLICY IF EXISTS "Admins can delete campaign templates" ON public.campaign_templates;
CREATE POLICY "Admins can delete campaign templates"
ON public.campaign_templates
FOR DELETE
TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_permission(auth.uid(), 'campaigns')
  )
);

DROP TRIGGER IF EXISTS update_campaign_templates_updated_at ON public.campaign_templates;
CREATE TRIGGER update_campaign_templates_updated_at
BEFORE UPDATE ON public.campaign_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
