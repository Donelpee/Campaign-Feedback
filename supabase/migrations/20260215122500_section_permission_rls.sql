-- Tighten table access to section-based permissions (not generic admin role)

-- Companies
DROP POLICY IF EXISTS "Admins can view companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can update companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can delete companies" ON public.companies;

CREATE POLICY "Section users can view companies"
ON public.companies
FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'overview')
  OR public.has_permission(auth.uid(), 'companies')
  OR public.has_permission(auth.uid(), 'links')
  OR public.has_permission(auth.uid(), 'responses')
);

CREATE POLICY "Section users can insert companies"
ON public.companies
FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'companies'));

CREATE POLICY "Section users can update companies"
ON public.companies
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'companies'))
WITH CHECK (public.has_permission(auth.uid(), 'companies'));

CREATE POLICY "Section users can delete companies"
ON public.companies
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'companies'));

-- Campaigns
DROP POLICY IF EXISTS "Admins can view campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can delete campaigns" ON public.campaigns;

CREATE POLICY "Section users can view campaigns"
ON public.campaigns
FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'overview')
  OR public.has_permission(auth.uid(), 'campaigns')
  OR public.has_permission(auth.uid(), 'links')
  OR public.has_permission(auth.uid(), 'responses')
);

CREATE POLICY "Section users can insert campaigns"
ON public.campaigns
FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'campaigns'));

CREATE POLICY "Section users can update campaigns"
ON public.campaigns
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'campaigns'))
WITH CHECK (public.has_permission(auth.uid(), 'campaigns'));

CREATE POLICY "Section users can delete campaigns"
ON public.campaigns
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'campaigns'));

-- Company/Campaign links
DROP POLICY IF EXISTS "Admins can view links" ON public.company_campaign_links;
DROP POLICY IF EXISTS "Anyone can view active links by code" ON public.company_campaign_links;
DROP POLICY IF EXISTS "Admins can insert links" ON public.company_campaign_links;
DROP POLICY IF EXISTS "Admins can update links" ON public.company_campaign_links;
DROP POLICY IF EXISTS "Admins can delete links" ON public.company_campaign_links;

CREATE POLICY "Section users can view links"
ON public.company_campaign_links
FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'overview')
  OR public.has_permission(auth.uid(), 'links')
  OR public.has_permission(auth.uid(), 'responses')
);

CREATE POLICY "Section users can insert links"
ON public.company_campaign_links
FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'links'));

CREATE POLICY "Section users can update links"
ON public.company_campaign_links
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'links'))
WITH CHECK (public.has_permission(auth.uid(), 'links'));

CREATE POLICY "Section users can delete links"
ON public.company_campaign_links
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'links'));

-- Responses
DROP POLICY IF EXISTS "Admins can view responses" ON public.feedback_responses;

CREATE POLICY "Section users can view responses"
ON public.feedback_responses
FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'overview')
  OR public.has_permission(auth.uid(), 'responses')
);

-- User roles
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;

CREATE POLICY "Users section can view roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), 'users')
);

-- Profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users section can view all profiles"
ON public.profiles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), 'users')
);

-- User permissions
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_permissions;

CREATE POLICY "Users section can view permissions"
ON public.user_permissions
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), 'users')
);
