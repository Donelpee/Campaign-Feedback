CREATE TABLE IF NOT EXISTS public.system_health_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('frontend', 'edge_function')),
    area TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    route TEXT,
    status_code INTEGER,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    link_id UUID REFERENCES public.company_campaign_links(id) ON DELETE SET NULL,
    request_path TEXT,
    request_method TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_health_events_created_at
    ON public.system_health_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_events_area_created_at
    ON public.system_health_events (area, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_events_severity_created_at
    ON public.system_health_events (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_events_fingerprint_created_at
    ON public.system_health_events (fingerprint, created_at DESC);

ALTER TABLE public.system_health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view system health events" ON public.system_health_events;
CREATE POLICY "Admins can view system health events"
ON public.system_health_events
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.system_health_events;
