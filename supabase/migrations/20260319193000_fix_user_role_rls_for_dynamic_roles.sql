-- Allow user managers to assign/manage any non-super-admin role.
-- Keep super_admin assignment restricted to super admins only.

DROP POLICY IF EXISTS "User managers can manage admin roles" ON public.user_roles;
CREATE POLICY "User managers can manage admin roles"
ON public.user_roles
FOR ALL TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'users')
  )
  AND role <> 'super_admin'
)
WITH CHECK (
  (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'users')
  )
  AND role <> 'super_admin'
);

-- Keep dependent permission tables aligned with dynamic roles.
DROP POLICY IF EXISTS "User managers can manage permissions" ON public.user_permissions;
CREATE POLICY "User managers can manage permissions"
ON public.user_permissions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = user_permissions.user_id
        AND ur.role <> 'super_admin'
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
      WHERE ur.user_id = user_permissions.user_id
        AND ur.role <> 'super_admin'
    )
  )
);

DROP POLICY IF EXISTS "User managers can manage campaign permissions" ON public.user_campaign_permissions;
CREATE POLICY "User managers can manage campaign permissions"
ON public.user_campaign_permissions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = user_campaign_permissions.user_id
        AND ur.role <> 'super_admin'
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
      WHERE ur.user_id = user_campaign_permissions.user_id
        AND ur.role <> 'super_admin'
    )
  )
);

DROP POLICY IF EXISTS "User managers can manage company permissions" ON public.user_company_permissions;
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
        AND ur.role <> 'super_admin'
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
        AND ur.role <> 'super_admin'
    )
  )
);
