
-- Create enum for admin permissions
CREATE TYPE public.admin_permission AS ENUM (
  'overview',
  'companies',
  'campaigns',
  'links',
  'responses',
  'users',
  'settings'
);

-- Create user_permissions table
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission admin_permission NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all permissions
CREATE POLICY "Super admins can manage permissions"
  ON public.user_permissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
  ON public.user_permissions
  FOR SELECT
  USING (user_id = auth.uid());

-- Create a security definer function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission admin_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Super admins always have all permissions
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
    ) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = _permission
    )
  END
$$;
