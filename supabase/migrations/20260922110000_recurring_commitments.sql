/*
# Dedication Optimiser — universal recurring commitments + auto-scheduler (1/6)

## Purpose
Replace "schedule is a one-by-one hand-typed table" with a real source of
truth: recurring_commitments describes things that need to happen regularly
(any module — trading, gym, language, course, reading, prayer, BotCouncil,
custom), and an auto-scheduler (lib/schedule/auto-scheduler.ts) turns those
into schedule_blocks rows, never touching anything the user placed by hand.

## New table

### recurring_commitments
One row per recurring thing a module wants scheduled. Not tied to a single
module by foreign key — activity_type is the same free-text convention
schedule_blocks already uses, now open to any module's own values (gym,
language, course, prayer, ...) rather than the original fixed list.
- id, user_id
- activity_type (text — which module this represents)
- label (text — display name for the generated blocks, e.g. "Push day")
- target_duration_min (integer)
- applies_days (smallint[] — 0=Sunday..6=Saturday)
- preferred_start_time (time, nullable — scheduler tries here first; null
  means "anywhere there's room")
- priority (integer, default 5 — higher goes first when slots are tight)
- active (boolean, default true — inactive commitments are ignored by the
  scheduler but kept around so re-activating doesn't lose the definition)
- created_at, updated_at

## Altered table

### schedule_blocks
- + source (text, check: 'auto' | 'manual', default 'manual' — existing
  hand-typed rows are correctly 'manual'; the auto-scheduler only ever
  inserts/deletes rows with source='auto')
- + commitment_id (nullable FK to recurring_commitments, cascade delete —
  traces which commitment produced an auto block, so deleting or changing a
  commitment can regenerate exactly the right rows)
- activity_type's CHECK constraint widened to accept every module's
  commitment type, not just the original trading/botcouncil/reading/custom

## Security
- RLS enabled on recurring_commitments, owner-scoped CRUD (TO authenticated).
*/

CREATE TABLE IF NOT EXISTS recurring_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  label text NOT NULL,
  target_duration_min integer NOT NULL,
  applies_days smallint[] NOT NULL DEFAULT '{}',
  preferred_start_time time,
  priority integer NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_commitments_duration_check CHECK (target_duration_min > 0)
);

ALTER TABLE recurring_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recurring_commitments" ON recurring_commitments;
CREATE POLICY "select_own_recurring_commitments" ON recurring_commitments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_recurring_commitments" ON recurring_commitments;
CREATE POLICY "insert_own_recurring_commitments" ON recurring_commitments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_recurring_commitments" ON recurring_commitments;
CREATE POLICY "update_own_recurring_commitments" ON recurring_commitments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_recurring_commitments" ON recurring_commitments;
CREATE POLICY "delete_own_recurring_commitments" ON recurring_commitments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS recurring_commitments_user_active_idx
  ON recurring_commitments (user_id, active);

DROP TRIGGER IF EXISTS touch_recurring_commitments ON recurring_commitments;
CREATE TRIGGER touch_recurring_commitments BEFORE UPDATE ON recurring_commitments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- schedule_blocks: track provenance so regeneration never clobbers manual edits
ALTER TABLE schedule_blocks ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_blocks_source_check') THEN
    ALTER TABLE schedule_blocks ADD CONSTRAINT schedule_blocks_source_check CHECK (source IN ('auto','manual'));
  END IF;
END $$;

ALTER TABLE schedule_blocks
  ADD COLUMN IF NOT EXISTS commitment_id uuid REFERENCES recurring_commitments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS schedule_blocks_commitment_idx ON schedule_blocks (commitment_id);
CREATE INDEX IF NOT EXISTS schedule_blocks_user_day_source_idx
  ON schedule_blocks (user_id, day_of_week, source);

-- Widen activity_type to cover every module, not just the original four
ALTER TABLE schedule_blocks DROP CONSTRAINT IF EXISTS schedule_blocks_activity_check;
ALTER TABLE schedule_blocks ADD CONSTRAINT schedule_blocks_activity_check
  CHECK (activity_type IN (
    'trading','botcouncil','reading','custom',
    'gym','language','course','prayer'
  ));
