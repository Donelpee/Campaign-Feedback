-- Ensure the known Modupe profile is surfaced consistently in audit log filters.

WITH modupe_profile AS (
  SELECT p.user_id
  FROM public.profiles p
  WHERE lower(COALESCE(p.full_name, '')) = 'modupe'
     OR lower(COALESCE(p.username, '')) = 'modupe'
     OR lower(split_part(COALESCE(p.email, ''), '@', 1)) = 'modupe'
  ORDER BY
    CASE
      WHEN lower(COALESCE(p.full_name, '')) = 'modupe' THEN 0
      WHEN lower(COALESCE(p.username, '')) = 'modupe' THEN 1
      ELSE 2
    END,
    p.created_at ASC
  LIMIT 1
)
UPDATE public.profiles p
SET full_name = 'Modupe'
FROM modupe_profile mp
WHERE p.user_id = mp.user_id
  AND COALESCE(NULLIF(BTRIM(p.full_name), ''), '') <> 'Modupe';

WITH modupe_profile AS (
  SELECT p.user_id
  FROM public.profiles p
  WHERE lower(COALESCE(p.full_name, '')) = 'modupe'
     OR lower(COALESCE(p.username, '')) = 'modupe'
     OR lower(split_part(COALESCE(p.email, ''), '@', 1)) = 'modupe'
  ORDER BY
    CASE
      WHEN lower(COALESCE(p.full_name, '')) = 'modupe' THEN 0
      WHEN lower(COALESCE(p.username, '')) = 'modupe' THEN 1
      ELSE 2
    END,
    p.created_at ASC
  LIMIT 1
),
beryl_company AS (
  SELECT c.id
  FROM public.companies c
  WHERE c.name = 'Beryl Consulting'
  LIMIT 1
)
UPDATE public.audit_logs al
SET user_id = mp.user_id
FROM modupe_profile mp, beryl_company bc
WHERE al.entity_type = 'company'
  AND al.entity_id = bc.id
  AND al.action = 'update'
  AND COALESCE(al.metadata -> 'changed_fields', '[]'::jsonb) ? 'created_by_user_id'
  AND al.user_id IS DISTINCT FROM mp.user_id;
