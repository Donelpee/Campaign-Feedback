-- Campaign distribution and reminder infrastructure

CREATE TABLE IF NOT EXISTS public.campaign_distribution_settings (
  campaign_id UUID PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE,
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_interval_days INTEGER NOT NULL DEFAULT 3 CHECK (reminder_interval_days > 0),
  max_reminders INTEGER NOT NULL DEFAULT 2 CHECK (max_reminders >= 0),
  send_on_create BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_email_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'opened', 'responded')),
  last_sent_at TIMESTAMP WITH TIME ZONE,
  reminder_count INTEGER NOT NULL DEFAULT 0 CHECK (reminder_count >= 0),
  last_reminder_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, email)
);

ALTER TABLE public.campaign_distribution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_email_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Section users can view distribution settings" ON public.campaign_distribution_settings;
CREATE POLICY "Section users can view distribution settings"
ON public.campaign_distribution_settings
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'overview')
  OR public.has_permission(auth.uid(), 'links')
);

DROP POLICY IF EXISTS "Section users can manage distribution settings" ON public.campaign_distribution_settings;
CREATE POLICY "Section users can manage distribution settings"
ON public.campaign_distribution_settings
FOR ALL
TO authenticated
USING (public.has_permission(auth.uid(), 'links'))
WITH CHECK (public.has_permission(auth.uid(), 'links'));

DROP POLICY IF EXISTS "Section users can view campaign recipients" ON public.campaign_email_recipients;
CREATE POLICY "Section users can view campaign recipients"
ON public.campaign_email_recipients
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'overview')
  OR public.has_permission(auth.uid(), 'links')
);

DROP POLICY IF EXISTS "Section users can manage campaign recipients" ON public.campaign_email_recipients;
CREATE POLICY "Section users can manage campaign recipients"
ON public.campaign_email_recipients
FOR ALL
TO authenticated
USING (public.has_permission(auth.uid(), 'links'))
WITH CHECK (public.has_permission(auth.uid(), 'links'));

CREATE OR REPLACE FUNCTION public.update_campaign_distribution_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_campaign_distribution_settings_updated_at ON public.campaign_distribution_settings;
CREATE TRIGGER update_campaign_distribution_settings_updated_at
BEFORE UPDATE ON public.campaign_distribution_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_campaign_distribution_updated_at();
