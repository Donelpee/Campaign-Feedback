-- Correct legacy company attribution so pre-tracking records are not assigned a false creator/editor.

UPDATE public.companies c
SET created_by_user_id = NULL
WHERE c.created_by_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.audit_logs al
    WHERE al.entity_type = 'company'
      AND al.entity_id = c.id
      AND al.action = 'create'
  );

UPDATE public.companies c
SET updated_by_user_id = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.audit_logs al
    WHERE al.entity_type = 'company'
      AND al.entity_id = c.id
      AND al.action = 'create'
  ) THEN c.created_by_user_id
  ELSE NULL
END
WHERE c.updated_by_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.audit_logs al
    WHERE al.entity_type = 'company'
      AND al.entity_id = c.id
      AND al.action = 'update'
  );

CREATE OR REPLACE FUNCTION public.get_companies_with_activity()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id UUID,
  updated_by_user_id UUID,
  created_by_name TEXT,
  updated_by_name TEXT,
  created_by_email TEXT,
  updated_by_email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.description,
    c.logo_url,
    c.created_at,
    c.updated_at,
    c.created_by_user_id,
    c.updated_by_user_id,
    COALESCE(NULLIF(BTRIM(cp.full_name), ''), NULLIF(BTRIM(cp.username), ''), cp.email) AS created_by_name,
    COALESCE(NULLIF(BTRIM(up.full_name), ''), NULLIF(BTRIM(up.username), ''), up.email) AS updated_by_name,
    cp.email AS created_by_email,
    up.email AS updated_by_email
  FROM public.companies c
  LEFT JOIN public.profiles cp ON cp.user_id = c.created_by_user_id
  LEFT JOIN public.profiles up ON up.user_id = c.updated_by_user_id
  WHERE auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR (
        c.tenant_id = public.get_user_tenant(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), c.tenant_id)
          OR public.has_permission(auth.uid(), 'companies')
        )
      )
    )
  ORDER BY c.created_at DESC;
$$;
