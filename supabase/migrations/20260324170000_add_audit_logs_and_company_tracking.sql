-- Audit log foundation + company creator/editor tracking

-- 1) Register audit log module and grant base access.
INSERT INTO public.app_modules (module_key, module_name, description)
VALUES ('audit_logs', 'Audit Log', 'Audit trail for tracked administrative activity')
ON CONFLICT (module_key) DO UPDATE
SET
  module_name = EXCLUDED.module_name,
  description = EXCLUDED.description;

INSERT INTO public.role_module_permissions (role_key, module_key)
VALUES
  ('admin', 'audit_logs'),
  ('super_admin', 'audit_logs')
ON CONFLICT (role_key, module_key) DO NOTHING;

INSERT INTO public.user_module_permissions (user_id, module_key)
SELECT DISTINCT ur.user_id, 'audit_logs'
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT (user_id, module_key) DO NOTHING;

-- 2) Track company creator/editor identity.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

WITH fallback_creator AS (
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('super_admin', 'admin')
  ORDER BY
    CASE WHEN ur.role = 'super_admin' THEN 0 ELSE 1 END,
    ur.created_at ASC
  LIMIT 1
)
UPDATE public.companies c
SET created_by_user_id = fc.user_id
FROM fallback_creator fc
WHERE c.created_by_user_id IS NULL;

WITH fallback_creator AS (
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('super_admin', 'admin')
  ORDER BY
    CASE WHEN ur.role = 'super_admin' THEN 0 ELSE 1 END,
    ur.created_at ASC
  LIMIT 1
)
UPDATE public.companies c
SET updated_by_user_id = COALESCE(c.created_by_user_id, fc.user_id)
FROM fallback_creator fc
WHERE c.updated_by_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_created_by_user_id
  ON public.companies (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_companies_updated_by_user_id
  ON public.companies (updated_by_user_id);

CREATE OR REPLACE FUNCTION public.set_company_tenant_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tenant UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'INSERT' AND NEW.updated_by_user_id IS NULL THEN
      NEW.updated_by_user_id := NEW.created_by_user_id;
    END IF;
    RETURN NEW;
  END IF;

  v_user_tenant := public.get_user_tenant(auth.uid());
  IF v_user_tenant IS NULL THEN
    RAISE EXCEPTION 'User has no tenant context';
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_user_tenant;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.created_by_user_id IS NULL THEN
    NEW.created_by_user_id := auth.uid();
  END IF;

  NEW.updated_by_user_id := auth.uid();

  IF NOT public.has_role(auth.uid(), 'super_admin') AND NEW.tenant_id <> v_user_tenant THEN
    RAISE EXCEPTION 'Cross-tenant write is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Audit log storage and helper functions.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_check
    CHECK (action IN ('create', 'update', 'delete'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at
  ON public.audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created_at
  ON public.audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view audit logs" ON public.audit_logs;
CREATE POLICY "Tenant users can view audit logs"
ON public.audit_logs
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.has_permission(auth.uid(), 'audit_logs')
    )
  )
);

CREATE OR REPLACE FUNCTION public.changed_jsonb_keys(
  p_old JSONB,
  p_new JSONB,
  p_ignored_keys TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(entry.key ORDER BY entry.key), ARRAY[]::TEXT[])
  FROM (
    SELECT DISTINCT key
    FROM jsonb_each(COALESCE(p_old, '{}'::jsonb) || COALESCE(p_new, '{}'::jsonb))
  ) AS entry
  WHERE NOT (entry.key = ANY(COALESCE(p_ignored_keys, ARRAY[]::TEXT[])))
    AND COALESCE(p_old -> entry.key, 'null'::jsonb)
      IS DISTINCT FROM COALESCE(p_new -> entry.key, 'null'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.record_audit_log(
  p_tenant_id UUID,
  p_user_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_entity_name TEXT,
  p_action TEXT,
  p_summary TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant_id IS NULL OR p_entity_type IS NULL OR p_action IS NULL OR p_summary IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    entity_type,
    entity_id,
    entity_name,
    action,
    summary,
    metadata
  )
  VALUES (
    p_tenant_id,
    p_user_id,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_action,
    p_summary,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_company_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_changed_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor := COALESCE(auth.uid(), NEW.updated_by_user_id, NEW.created_by_user_id);
    PERFORM public.record_audit_log(
      NEW.tenant_id,
      v_actor,
      'company',
      NEW.id,
      NEW.name,
      'create',
      format('Created company "%s"', NEW.name),
      jsonb_build_object(
        'changed_fields', ARRAY['name', 'description', 'logo_url'],
        'company_name', NEW.name
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_actor := COALESCE(auth.uid(), NEW.updated_by_user_id, NEW.created_by_user_id, OLD.updated_by_user_id, OLD.created_by_user_id);
    v_changed_fields := public.changed_jsonb_keys(
      to_jsonb(OLD),
      to_jsonb(NEW),
      ARRAY['updated_at', 'updated_by_user_id']
    );

    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM public.record_audit_log(
      NEW.tenant_id,
      v_actor,
      'company',
      NEW.id,
      NEW.name,
      'update',
      format('Updated company "%s"', COALESCE(NEW.name, OLD.name)),
      jsonb_build_object(
        'changed_fields', v_changed_fields,
        'previous_name', OLD.name,
        'current_name', NEW.name
      )
    );
    RETURN NEW;
  END IF;

  v_actor := COALESCE(auth.uid(), OLD.updated_by_user_id, OLD.created_by_user_id);
  PERFORM public.record_audit_log(
    OLD.tenant_id,
    v_actor,
    'company',
    OLD.id,
    OLD.name,
    'delete',
    format('Deleted company "%s"', OLD.name),
    jsonb_build_object('company_name', OLD.name)
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_company_changes ON public.companies;
CREATE TRIGGER trg_audit_company_changes
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.audit_company_changes();

CREATE OR REPLACE FUNCTION public.audit_campaign_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_changed_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor := COALESCE(auth.uid(), NEW.created_by_user_id);
    PERFORM public.record_audit_log(
      NEW.tenant_id,
      v_actor,
      'campaign',
      NEW.id,
      NEW.name,
      'create',
      format('Created campaign "%s"', NEW.name),
      jsonb_build_object(
        'changed_fields', ARRAY['name', 'description', 'campaign_type', 'start_date', 'end_date', 'questions'],
        'campaign_name', NEW.name
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_actor := COALESCE(auth.uid(), NEW.created_by_user_id, OLD.created_by_user_id);
    v_changed_fields := public.changed_jsonb_keys(
      to_jsonb(OLD),
      to_jsonb(NEW),
      ARRAY['updated_at']
    );

    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM public.record_audit_log(
      NEW.tenant_id,
      v_actor,
      'campaign',
      NEW.id,
      NEW.name,
      'update',
      format('Updated campaign "%s"', COALESCE(NEW.name, OLD.name)),
      jsonb_build_object(
        'changed_fields', v_changed_fields,
        'previous_name', OLD.name,
        'current_name', NEW.name
      )
    );
    RETURN NEW;
  END IF;

  v_actor := COALESCE(auth.uid(), OLD.created_by_user_id);
  PERFORM public.record_audit_log(
    OLD.tenant_id,
    v_actor,
    'campaign',
    OLD.id,
    OLD.name,
    'delete',
    format('Deleted campaign "%s"', OLD.name),
    jsonb_build_object('campaign_name', OLD.name)
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_campaign_changes ON public.campaigns;
CREATE TRIGGER trg_audit_campaign_changes
AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.audit_campaign_changes();

CREATE OR REPLACE FUNCTION public.audit_link_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_changed_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor := auth.uid();
    PERFORM public.record_audit_log(
      NEW.tenant_id,
      v_actor,
      'link',
      NEW.id,
      NEW.unique_code,
      'create',
      format('Created feedback link "%s"', NEW.unique_code),
      jsonb_build_object(
        'changed_fields', ARRAY['company_id', 'campaign_id', 'unique_code', 'is_active'],
        'unique_code', NEW.unique_code
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_actor := auth.uid();
    v_changed_fields := public.changed_jsonb_keys(
      to_jsonb(OLD),
      to_jsonb(NEW),
      ARRAY['access_count']
    );

    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM public.record_audit_log(
      NEW.tenant_id,
      v_actor,
      'link',
      NEW.id,
      NEW.unique_code,
      'update',
      format('Updated feedback link "%s"', COALESCE(NEW.unique_code, OLD.unique_code)),
      jsonb_build_object(
        'changed_fields', v_changed_fields,
        'previous_code', OLD.unique_code,
        'current_code', NEW.unique_code
      )
    );
    RETURN NEW;
  END IF;

  v_actor := auth.uid();
  PERFORM public.record_audit_log(
    OLD.tenant_id,
    v_actor,
    'link',
    OLD.id,
    OLD.unique_code,
    'delete',
    format('Deleted feedback link "%s"', OLD.unique_code),
    jsonb_build_object('unique_code', OLD.unique_code)
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_link_changes ON public.company_campaign_links;
CREATE TRIGGER trg_audit_link_changes
AFTER INSERT OR UPDATE OR DELETE ON public.company_campaign_links
FOR EACH ROW
EXECUTE FUNCTION public.audit_link_changes();

-- 4) Read APIs for the admin UI.
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
    COALESCE(NULLIF(BTRIM(cp.full_name), ''), NULLIF(BTRIM(cp.username), ''), cp.email, 'Unknown') AS created_by_name,
    COALESCE(NULLIF(BTRIM(up.full_name), ''), NULLIF(BTRIM(up.username), ''), up.email, 'Unknown') AS updated_by_name,
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

CREATE OR REPLACE FUNCTION public.get_audit_log_users()
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  activity_count BIGINT,
  last_activity_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    al.user_id,
    COALESCE(NULLIF(BTRIM(p.full_name), ''), NULLIF(BTRIM(p.username), ''), p.email, 'Unknown') AS user_name,
    p.email AS user_email,
    COUNT(*)::BIGINT AS activity_count,
    MAX(al.created_at) AS last_activity_at
  FROM public.audit_logs al
  LEFT JOIN public.profiles p ON p.user_id = al.user_id
  WHERE al.user_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR (
        al.tenant_id = public.get_user_tenant(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), al.tenant_id)
          OR public.has_permission(auth.uid(), 'audit_logs')
        )
      )
    )
  GROUP BY al.user_id, p.full_name, p.username, p.email
  ORDER BY last_activity_at DESC NULLS LAST, user_name ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_audit_log_page(
  p_user_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  action TEXT,
  summary TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped_logs AS (
    SELECT
      al.id,
      al.tenant_id,
      al.user_id,
      COALESCE(NULLIF(BTRIM(p.full_name), ''), NULLIF(BTRIM(p.username), ''), p.email, 'System') AS user_name,
      p.email AS user_email,
      al.entity_type,
      al.entity_id,
      al.entity_name,
      al.action,
      al.summary,
      al.metadata,
      al.created_at
    FROM public.audit_logs al
    LEFT JOIN public.profiles p ON p.user_id = al.user_id
    WHERE auth.uid() IS NOT NULL
      AND (
        public.has_role(auth.uid(), 'super_admin')
        OR (
          al.tenant_id = public.get_user_tenant(auth.uid())
          AND (
            public.is_tenant_admin(auth.uid(), al.tenant_id)
            OR public.has_permission(auth.uid(), 'audit_logs')
          )
        )
      )
      AND (p_user_id IS NULL OR al.user_id = p_user_id)
      AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
      AND (p_action IS NULL OR al.action = p_action)
      AND (p_from_date IS NULL OR al.created_at >= p_from_date::timestamptz)
      AND (
        p_to_date IS NULL
        OR al.created_at < ((p_to_date + 1)::timestamptz)
      )
      AND (
        p_search IS NULL
        OR BTRIM(p_search) = ''
        OR al.summary ILIKE '%' || BTRIM(p_search) || '%'
        OR COALESCE(al.entity_name, '') ILIKE '%' || BTRIM(p_search) || '%'
        OR COALESCE(p.full_name, '') ILIKE '%' || BTRIM(p_search) || '%'
        OR COALESCE(p.username, '') ILIKE '%' || BTRIM(p_search) || '%'
        OR COALESCE(p.email, '') ILIKE '%' || BTRIM(p_search) || '%'
      )
  )
  SELECT
    scoped_logs.*,
    COUNT(*) OVER() AS total_count
  FROM scoped_logs
  ORDER BY scoped_logs.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
