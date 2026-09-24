/*
# Roadmap status + 9:00am wake commitment

- user_settings.employment_status: informational label shown on the Roadmap.
  Deliberately NOT read by any phase logic (phases are manual).
- Seeds a daily "Wake time" recurring commitment at 09:00 for the (single) user
  so the auto-scheduler plans around it. Idempotent.
*/

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'Agency work (interim)';

INSERT INTO recurring_commitments (user_id, activity_type, label, target_duration_min, applies_days, preferred_start_time, priority, active)
SELECT u.id, 'custom', 'Wake time', 15, '{0,1,2,3,4,5,6}', '09:00', 10, true
FROM (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) u
WHERE NOT EXISTS (
  SELECT 1 FROM recurring_commitments rc WHERE rc.user_id = u.id AND rc.label = 'Wake time'
);
