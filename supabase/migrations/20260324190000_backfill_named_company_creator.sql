-- Targeted profile/company corrections from confirmed business context.

UPDATE public.profiles
SET full_name = 'Adewale'
WHERE username = 'lawaladewale_3ca078'
  AND COALESCE(NULLIF(BTRIM(full_name), ''), '') <> 'Adewale';

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
UPDATE public.companies c
SET
  created_by_user_id = mp.user_id,
  updated_by_user_id = COALESCE(c.updated_by_user_id, mp.user_id)
FROM modupe_profile mp
WHERE c.name = 'Beryl Consulting';
