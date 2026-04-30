-- Fix campaign name uniqueness: enforce uniqueness per company, not globally.

-- Existing migration created a global unique index on campaigns(name),
-- which causes cross-company campaign names to be rejected.
DROP INDEX IF EXISTS public.campaigns_name_unique_idx;

-- Enforce uniqueness within the same company.
-- Note: company_id can be NULL; Postgres allows multiple NULLs under a UNIQUE index,
-- which is usually fine for "unnamed/not-scoped" rows.
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_company_id_name_unique_idx
ON public.campaigns (company_id, name);
