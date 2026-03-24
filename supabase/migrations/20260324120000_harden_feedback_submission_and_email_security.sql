-- Harden public feedback submission and email delivery abuse paths

CREATE TABLE IF NOT EXISTS public.feedback_submission_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_code TEXT NOT NULL,
  ip_fingerprint TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_submission_attempts_ip_attempted_at
  ON public.feedback_submission_attempts (ip_fingerprint, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_submission_attempts_code_attempted_at
  ON public.feedback_submission_attempts (link_code, attempted_at DESC);

ALTER TABLE public.feedback_submission_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feedback_response_email_events (
  response_id UUID PRIMARY KEY REFERENCES public.feedback_responses(id) ON DELETE CASCADE,
  link_code TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_feedback_response_email_events_processed_at
  ON public.feedback_response_email_events (processed_at, created_at DESC);

ALTER TABLE public.feedback_response_email_events ENABLE ROW LEVEL SECURITY;
