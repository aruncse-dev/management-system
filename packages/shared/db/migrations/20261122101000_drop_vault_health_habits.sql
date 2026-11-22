-- Remove the Vault Health & Habits modules.
--
-- The UI, API actions, DB helpers and Drizzle definitions were removed in the
-- same change. On 2026-11-22 all five tables held 0 rows, so nothing is lost.
-- Destructive: apply only after the code change is deployed.

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
