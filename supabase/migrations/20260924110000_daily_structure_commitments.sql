/*
# Daily structure: fixed work / learning blocks + logging reminder

- recurring_commitments.fixed: when true the auto-scheduler places the block at
  exactly preferred_start_time even if it overlaps prayer or other blocks
  (e.g. Dhuhr inside the trading block, Isha after the 20:00 reminder).
- Seeds (idempotent, by label) for the single user, all 7 days:
  Work Block 1 12:00-14:00 (trading), Learning Block 14:30-16:00,
  Work Block 2 19:15-20:15 (BotCouncil), Daily Logging Reminder 20:00.
- Marks the existing Wake time commitment fixed.
*/

ALTER TABLE recurring_commitments ADD COLUMN IF NOT EXISTS fixed boolean NOT NULL DEFAULT false;

UPDATE recurring_commitments SET fixed = true WHERE label = 'Wake time';

INSERT INTO recurring_commitments (user_id, activity_type, label, target_duration_min, applies_days, preferred_start_time, priority, active, fixed)
SELECT u.id, v.activity_type, v.label, v.dur, '{0,1,2,3,4,5,6}', v.start_time::time, 9, true, true
FROM (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) u
CROSS JOIN (VALUES
  ('trading',    'Work Block 1 (Trading Focus)',                 120, '12:00'),
  ('course',     'Learning Block (Cybersecurity / Economic Logic)', 90, '14:30'),
  ('botcouncil', 'Work Block 2 (BotCouncil Maintenance)',         60, '19:15'),
  ('custom',     'Daily Logging Reminder',                        15, '20:00')
) AS v(activity_type, label, dur, start_time)
WHERE NOT EXISTS (
  SELECT 1 FROM recurring_commitments rc WHERE rc.user_id = u.id AND rc.label = v.label
);
