-- Persisted admin notifications for campaign response submissions
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response_id UUID REFERENCES public.feedback_responses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL DEFAULT 'campaign_response',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, response_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_created_at
  ON public.admin_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_unread
  ON public.admin_notifications (user_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own admin notifications" ON public.admin_notifications;
CREATE POLICY "Users can view own admin notifications"
ON public.admin_notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own admin notifications" ON public.admin_notifications;
CREATE POLICY "Users can update own admin notifications"
ON public.admin_notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own admin notifications" ON public.admin_notifications;
CREATE POLICY "Users can delete own admin notifications"
ON public.admin_notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_admin_notifications_for_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id UUID;
  v_company_id UUID;
  v_campaign_name TEXT;
  v_company_name TEXT;
BEGIN
  SELECT ccl.campaign_id, ccl.company_id, camp.name, comp.name
  INTO v_campaign_id, v_company_id, v_campaign_name, v_company_name
  FROM public.company_campaign_links ccl
  LEFT JOIN public.campaigns camp ON camp.id = ccl.campaign_id
  LEFT JOIN public.companies comp ON comp.id = ccl.company_id
  WHERE ccl.id = NEW.link_id;

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
    ur.user_id,
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
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'super_admin')
  ON CONFLICT (user_id, response_id, notification_type) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_admin_notifications_for_response ON public.feedback_responses;
CREATE TRIGGER trg_create_admin_notifications_for_response
AFTER INSERT ON public.feedback_responses
FOR EACH ROW
EXECUTE FUNCTION public.create_admin_notifications_for_response();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'admin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
  END IF;
END $$;
