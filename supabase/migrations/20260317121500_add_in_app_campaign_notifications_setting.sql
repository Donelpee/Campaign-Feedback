-- Add per-user in-app campaign response notification preference
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS in_app_campaign_notifications BOOLEAN NOT NULL DEFAULT true;
