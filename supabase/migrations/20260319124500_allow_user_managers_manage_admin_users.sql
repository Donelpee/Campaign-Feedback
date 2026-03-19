-- Allow delegated user managers (users permission) to manage admin accounts
-- while keeping super-admin role assignment restricted to super admins.

DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
CREATE POLICY "User managers can manage admin roles"
ON public.user_roles
FOR ALL TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'users')
  )
  AND role = 'admin'
)
WITH CHECK (
  (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'users')
  )
  AND role = 'admin'
);

CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can manage permissions" ON public.user_permissions;
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
      WHERE ur.user_id = user_permissions.user_id
        AND ur.role = 'admin'
    )
  )
);

DROP POLICY IF EXISTS "Super admins can manage campaign permissions"
ON public.user_campaign_permissions;
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
      WHERE ur.user_id = user_campaign_permissions.user_id
        AND ur.role = 'admin'
    )
  )
);
