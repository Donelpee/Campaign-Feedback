-- Reset "views" counters in the app without deleting any data.
-- Views are tracked by public.company_campaign_links.access_count.

UPDATE public.company_campaign_links
SET access_count = 0;
