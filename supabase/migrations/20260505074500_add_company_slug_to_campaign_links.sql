-- Store a stable company slug snapshot on each generated campaign link.
-- This keeps published feedback URLs consistent even if the company name changes later.

ALTER TABLE public.company_campaign_links
ADD COLUMN IF NOT EXISTS company_slug TEXT;

