ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS default_creation_mode text NOT NULL DEFAULT 'guided_buddy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_settings_default_creation_mode_check'
  ) THEN
    ALTER TABLE public.user_settings
    ADD CONSTRAINT user_settings_default_creation_mode_check
    CHECK (
      default_creation_mode IN (
        'guided_buddy',
        'quick_start',
        'template_story',
        'conversation_builder'
      )
    );
  END IF;
END $$;
