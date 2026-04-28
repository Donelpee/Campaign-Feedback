ALTER TABLE public.campaign_templates
  ADD COLUMN IF NOT EXISTS visibility_scope TEXT NOT NULL DEFAULT 'organization'
  CHECK (visibility_scope IN ('organization', 'personal'));

DROP POLICY IF EXISTS "Admins can view campaign templates" ON public.campaign_templates;
CREATE POLICY "Admins can view campaign templates"
ON public.campaign_templates
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR (
      public.has_permission(auth.uid(), 'campaigns')
      AND (
        visibility_scope = 'organization'
        OR created_by_user_id = auth.uid()
      )
    )
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
  AND (
    created_by_user_id IS NULL
    OR created_by_user_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
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
    OR (
      public.has_permission(auth.uid(), 'campaigns')
      AND created_by_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR (
      public.has_permission(auth.uid(), 'campaigns')
      AND created_by_user_id = auth.uid()
    )
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
    OR (
      public.has_permission(auth.uid(), 'campaigns')
      AND created_by_user_id = auth.uid()
    )
  )
);
