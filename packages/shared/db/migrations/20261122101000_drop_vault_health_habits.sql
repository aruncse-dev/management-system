-- Remove the Vault Health & Habits modules.
--
-- The UI, API actions, DB helpers and Drizzle definitions were removed in the
-- same change. On 2026-11-22 all five tables held 0 rows, so nothing is lost.
--
-- APPLIED to production (Neon project soft-brook-60356295) on 2026-11-22, at
-- the owner's request, after the code removal was deployed (#40). Verified
-- afterwards: the five tables are gone, one org's vault menu lost "health" and
-- "habits", and no other table's row count changed.

DROP TABLE IF EXISTS vault_habit_logs;
DROP TABLE IF EXISTS vault_habits;
DROP TABLE IF EXISTS vault_medications;
DROP TABLE IF EXISTS vault_illnesses;
DROP TABLE IF EXISTS vault_health_vitals;

-- Drop the retired menu slugs from any org that had them enabled.
UPDATE organizations
SET enabled_menus = jsonb_set(
  enabled_menus,
  '{vault}',
  COALESCE(
    (SELECT jsonb_agg(m) FROM jsonb_array_elements(enabled_menus->'vault') m
      WHERE m #>> '{}' NOT IN ('health', 'habits')),
    '[]'::jsonb
  )
)
WHERE jsonb_typeof(enabled_menus->'vault') = 'array';
