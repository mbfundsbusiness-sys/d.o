/*
# University enrolment — fixed commitments, term dates, soft-delete, lecture seed

## Reuses (no new concepts)
- recurring_commitments already stores everything a weekly lecture needs, in a
  DST-safe form: applies_days (weekday numbers), preferred_start_time (local
  Europe/London wall-clock `time`), target_duration_min. No UTC offsets stored.
  `fixed` (pinned, immovable) and `priority` (10 = placed first) already exist
  and are reused instead of adding is_fixed / a second priority column.

## Added
recurring_commitments
- category text            — 'university' | 'work' | 'learning' | 'fitness' | ... (free text, NULL = legacy/unclassified)
- effective_from date      — first local date the commitment applies (default: today, London)
- effective_until date     — last local date it applies; NULL = open-ended.
                             Set it at end of term, e.g.
                               UPDATE recurring_commitments SET effective_until = '2026-12-18'
                               WHERE category = 'university';
                             (clear it with = NULL; the generator skips lectures outside the range)
- location text            — optional (room / building)
schedule_blocks
- archived_at timestamptz, archived_reason text — soft delete; every reader ignores archived rows

## Data
- Backfills category on existing commitments from activity_type (only where NULL).
- Seeds the 4 lectures (fixed, priority 10, category 'university'), upserted on
  the natural key (user_id, label) via a partial unique index — safe to re-run.
  A re-run refreshes day/time/duration but never overwrites effective_from/until/location.

## Persona
The AI persona/system prompt lives in code (app/api/assistant/route.ts), not the DB,
so nothing to migrate for it.

## Rollback
See the ROLLBACK section at the bottom (commented out — run deliberately).
*/

ALTER TABLE recurring_commitments ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE recurring_commitments
  ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/London')::date);
ALTER TABLE recurring_commitments ADD COLUMN IF NOT EXISTS effective_until date;
ALTER TABLE recurring_commitments ADD COLUMN IF NOT EXISTS location text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_commitments_effective_range_check') THEN
    ALTER TABLE recurring_commitments ADD CONSTRAINT recurring_commitments_effective_range_check
      CHECK (effective_until IS NULL OR effective_until >= effective_from);
  END IF;
END $$;

ALTER TABLE schedule_blocks ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE schedule_blocks ADD COLUMN IF NOT EXISTS archived_reason text;
CREATE INDEX IF NOT EXISTS schedule_blocks_active_idx ON schedule_blocks (user_id, day_of_week) WHERE archived_at IS NULL;

-- Classify existing commitments (only where not already set)
UPDATE recurring_commitments SET category = CASE
  WHEN activity_type IN ('trading', 'botcouncil') THEN 'work'
  WHEN activity_type IN ('course', 'language', 'reading') THEN 'learning'
  WHEN activity_type = 'gym' THEN 'fitness'
  WHEN activity_type = 'prayer' THEN 'prayer'
END
WHERE category IS NULL AND activity_type IN ('trading', 'botcouncil', 'course', 'language', 'reading', 'gym', 'prayer');

-- Natural key for lectures
CREATE UNIQUE INDEX IF NOT EXISTS recurring_commitments_university_key
  ON recurring_commitments (user_id, label) WHERE category = 'university';

-- Seed lectures (single-user app: first auth user, same convention as earlier seeds)
INSERT INTO recurring_commitments
  (user_id, activity_type, label, target_duration_min, applies_days, preferred_start_time, priority, active, fixed, category)
SELECT u.id, 'custom', v.label, v.dur, v.days::smallint[], v.start_time::time, 10, true, true, 'university'
FROM (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) u
CROSS JOIN (VALUES
  ('Uni Lecture: Programming & Software / Engineering Software',                    60,  '{1}', '12:00'),
  ('Uni Lecture: Electronic Circuits & Audio Electronics',                          90,  '{4}', '09:30'),
  ('Uni Lecture: Mathematics for Engineering 1 & Quantitative Tools for Audio',     90,  '{4}', '12:00'),
  ('Uni Lecture: Engineering Science (ELE)',                                        180, '{4}', '14:00')
) AS v(label, dur, days, start_time)
ON CONFLICT (user_id, label) WHERE category = 'university' DO UPDATE SET
  target_duration_min  = EXCLUDED.target_duration_min,
  applies_days         = EXCLUDED.applies_days,
  preferred_start_time = EXCLUDED.preferred_start_time,
  priority             = 10,
  fixed                = true,
  active               = true;

/*
-- ROLLBACK (run manually, in this order) ------------------------------------
-- Lecture-generated blocks go with their commitments (FK ON DELETE CASCADE).
DELETE FROM recurring_commitments WHERE category = 'university';
DROP INDEX IF EXISTS recurring_commitments_university_key;
DROP INDEX IF EXISTS schedule_blocks_active_idx;
ALTER TABLE schedule_blocks DROP COLUMN IF EXISTS archived_reason;
ALTER TABLE schedule_blocks DROP COLUMN IF EXISTS archived_at;
ALTER TABLE recurring_commitments DROP CONSTRAINT IF EXISTS recurring_commitments_effective_range_check;
ALTER TABLE recurring_commitments DROP COLUMN IF EXISTS location;
ALTER TABLE recurring_commitments DROP COLUMN IF EXISTS effective_until;
ALTER TABLE recurring_commitments DROP COLUMN IF EXISTS effective_from;
ALTER TABLE recurring_commitments DROP COLUMN IF EXISTS category;
-- NOTE: do the cleanup revert (20261005110000) FIRST if it was applied, or archived
-- blocks stay hidden/lost when archived_at is dropped.
*/
