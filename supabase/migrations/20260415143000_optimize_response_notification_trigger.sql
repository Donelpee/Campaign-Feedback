-- Reduce synchronous write-path fanout on feedback response inserts.
-- The original trigger created in-app notifications for every admin and super admin,
-- including unrelated tenants. This both increased insert work and could over-notify.

CREATE INDEX IF NOT EXISTS idx_user_roles_role_user_id
  ON public.user_roles (role, user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_user_id
  ON public.profiles (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_in_app_campaign_notifications
  ON public.user_settings (user_id)
  WHERE in_app_campaign_notifications = true;

CREATE OR REPLACE FUNCTION public.create_admin_notifications_for_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id UUID := NEW.campaign_id;
  v_company_id UUID;
  v_campaign_name TEXT;
  v_company_name TEXT;
BEGIN
  SELECT
    COALESCE(camp.company_id, ccl.company_id),
    camp.name,
    comp.name
  INTO
    v_company_id,
    v_campaign_name,
    v_company_name
  FROM public.campaigns camp
  LEFT JOIN public.company_campaign_links ccl
    ON ccl.id = NEW.link_id
  LEFT JOIN public.companies comp
    ON comp.id = COALESCE(camp.company_id, ccl.company_id)
  WHERE camp.id = NEW.campaign_id;

  INSERT INTO public.admin_notifications (
    user_id,
    response_id,
    campaign_id,
    company_id,
    notification_type,
    title,
    message,
    metadata
  )
  SELECT
    eligible.user_id,
    NEW.id,
    v_campaign_id,
    v_company_id,
    'campaign_response',
    'New campaign response',
    COALESCE(v_campaign_name, 'Campaign') || ' - ' || COALESCE(v_company_name, 'Company'),
    jsonb_build_object(
      'campaign_name', v_campaign_name,
      'company_name', v_company_name,
      'link_id', NEW.link_id
    )
  FROM (
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    LEFT JOIN public.profiles p
      ON p.user_id = ur.user_id
    LEFT JOIN public.user_settings us
      ON us.user_id = ur.user_id
    WHERE ur.role IN ('admin', 'super_admin')
      AND COALESCE(us.in_app_campaign_notifications, true)
      AND (
        ur.role = 'super_admin'
        OR p.tenant_id = NEW.tenant_id
      )
  ) AS eligible
  ON CONFLICT (user_id, response_id, notification_type) DO NOTHING;

  RETURN NEW;
END;
$$;
