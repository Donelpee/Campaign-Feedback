-- Add persisted admin appearance settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS dark_mode_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS color_theme TEXT NOT NULL DEFAULT 'ocean';

ALTER TABLE public.user_settings
DROP CONSTRAINT IF EXISTS user_settings_color_theme_check;

ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_color_theme_check
CHECK (color_theme IN ('ocean', 'meadow'));
