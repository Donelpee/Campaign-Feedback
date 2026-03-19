-- Dynamic roles + modules + secure onboarding invites (one-time, 3-day expiry)

-- 1) Make user role values dynamic (text) instead of enum.
DROP POLICY IF EXISTS "Users section can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "User managers can manage admin roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "User managers can manage permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "User managers can manage campaign permissions" ON public.user_campaign_permissions;
DROP POLICY IF EXISTS "User managers can manage company permissions" ON public.user_company_permissions;

-- Ensure function bodies are type-compatible before converting role column.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role::text
  )
$$;

ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE TEXT USING role::text;

-- 2) Dynamic modules registry.
CREATE TABLE IF NOT EXISTS public.app_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_key TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view modules" ON public.app_modules;
CREATE POLICY "Admins can view modules"
ON public.app_modules
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users managers can manage modules" ON public.app_modules;
CREATE POLICY "Users managers can manage modules"
ON public.app_modules
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_permission(auth.uid(), 'users')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_permission(auth.uid(), 'users')
);

-- Seed modules from existing static permissions
INSERT INTO public.app_modules (module_key, module_name, description)
VALUES
  ('overview', 'Dashboard Overview', 'Overview and analytics dashboard'),
  ('companies', 'Companies', 'Company management'),
  ('campaigns', 'Campaigns', 'Campaign management'),
  ('links', 'Links', 'Campaign links management'),
  ('responses', 'Responses', 'Survey responses and analytics'),
  ('users', 'Admin/Users', 'User and role management'),
  ('settings', 'Settings', 'Application settings')
ON CONFLICT (module_key) DO NOTHING;

-- 3) Dynamic role definitions.
CREATE TABLE IF NOT EXISTS public.app_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view app roles" ON public.app_roles;
CREATE POLICY "Admins can view app roles"
ON public.app_roles
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users managers can manage app roles" ON public.app_roles;
CREATE POLICY "Users managers can manage app roles"
ON public.app_roles
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_permission(auth.uid(), 'users')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_permission(auth.uid(), 'users')
);

-- Seed system roles
INSERT INTO public.app_roles (role_key, role_name, description, is_system)
VALUES
  ('super_admin', 'Super Admin', 'Full unrestricted administrative access', true),
  ('admin', 'Admin', 'Administrative access based on module and company permissions', true)
ON CONFLICT (role_key) DO NOTHING;

-- 4) Role to module mapping (permissions by role).
CREATE TABLE IF NOT EXISTS public.role_module_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_key TEXT NOT NULL REFERENCES public.app_roles(role_key) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES public.app_modules(module_key) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (role_key, module_key)
);

ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view role module permissions" ON public.role_module_permissions;
CREATE POLICY "Admins can view role module permissions"
ON public.role_module_permissions
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users managers can manage role module permissions" ON public.role_module_permissions;
CREATE POLICY "Users managers can manage role module permissions"
ON public.role_module_permissions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_permission(auth.uid(), 'users')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_permission(auth.uid(), 'users')
);

-- Seed base role permissions
INSERT INTO public.role_module_permissions (role_key, module_key)
SELECT 'admin', m.module_key
FROM public.app_modules m
WHERE m.module_key IN ('overview', 'companies', 'campaigns', 'links', 'responses', 'users', 'settings')
ON CONFLICT (role_key, module_key) DO NOTHING;

INSERT INTO public.role_module_permissions (role_key, module_key)
SELECT 'super_admin', m.module_key
FROM public.app_modules m
ON CONFLICT (role_key, module_key) DO NOTHING;

-- 5) Dynamic user-module permissions table (text keys)
CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES public.app_modules(module_key) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key)
);

ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own module permissions" ON public.user_module_permissions;
CREATE POLICY "Users can view own module permissions"
ON public.user_module_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users managers can manage module permissions" ON public.user_module_permissions;
CREATE POLICY "Users managers can manage module permissions"
ON public.user_module_permissions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = user_module_permissions.user_id
        AND ur.role <> 'super_admin'
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.has_permission(auth.uid(), 'users')
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = user_module_permissions.user_id
        AND ur.role <> 'super_admin'
    )
  )
);

-- Backfill from legacy enum table for compatibility.
INSERT INTO public.user_module_permissions (user_id, module_key)
SELECT up.user_id, up.permission::text
FROM public.user_permissions up
ON CONFLICT (user_id, module_key) DO NOTHING;

-- 6) Override has_permission() to support dynamic module permissions.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
    ) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_module_permissions
      WHERE user_id = _user_id AND module_key = _permission
    )
  END
$$;

-- Keep typed wrapper for existing SQL callers using enum.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission public.admin_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission(_user_id, _permission::text)
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- 7) One-time onboarding invites with fixed expiry.
CREATE TABLE IF NOT EXISTS public.onboarding_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  role_key TEXT NOT NULL,
  username TEXT,
  module_keys TEXT[] NOT NULL DEFAULT '{}'::text[],
  company_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_onboarding_invites_email ON public.onboarding_invites (invite_email);
CREATE INDEX IF NOT EXISTS idx_onboarding_invites_expires ON public.onboarding_invites (expires_at);

ALTER TABLE public.onboarding_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users managers can manage onboarding invites" ON public.onboarding_invites;
CREATE POLICY "Users managers can manage onboarding invites"
ON public.onboarding_invites
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_permission(auth.uid(), 'users')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_permission(auth.uid(), 'users')
);

-- Recreate user_roles policies after role column conversion.
CREATE POLICY "Users section can view roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), 'users')
);

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

-- Recreate dependent legacy policies that were dropped before role type conversion.
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
