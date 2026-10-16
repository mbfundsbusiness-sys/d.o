/*
# Dedication Optimiser — dated work shifts (DPD)

## Purpose
The job is rotating/variable shifts, so it cannot live in the weekly
template (schedule_blocks / recurring_commitments are keyed by day-of-week
and repeat forever). Shifts are one-off, date-specific rows instead.

## New table

### work_shifts
- id, user_id
- shift_date (date, London calendar date)
- start_time / end_time (time, London wall-clock; end must be after start —
  shifts do not cross midnight)
- title (text — default 'DPD Hounslow West TW3 TW4', free to edit per shift)
- note (text, optional)
- created_at, updated_at

## Security
- RLS enabled, owner-scoped CRUD (TO authenticated), same pattern as todo_items.

## Notes
- Pure addition: no existing table is altered or dropped.
- Job-search data (job_applications, job_search_sessions, anchor_logs.applications_sent)
  is deliberately left in place; the app simply stops using it.
*/

CREATE TABLE IF NOT EXISTS work_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  title text NOT NULL DEFAULT 'DPD Hounslow West TW3 TW4',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_shifts_time_order CHECK (end_time > start_time)
);

ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_work_shifts" ON work_shifts;
CREATE POLICY "select_own_work_shifts" ON work_shifts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_work_shifts" ON work_shifts;
CREATE POLICY "insert_own_work_shifts" ON work_shifts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_work_shifts" ON work_shifts;
CREATE POLICY "update_own_work_shifts" ON work_shifts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_work_shifts" ON work_shifts;
CREATE POLICY "delete_own_work_shifts" ON work_shifts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS work_shifts_user_date_idx ON work_shifts (user_id, shift_date);

DROP TRIGGER IF EXISTS touch_work_shifts ON work_shifts;
CREATE TRIGGER touch_work_shifts BEFORE UPDATE ON work_shifts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Rollback:
--   DROP TABLE IF EXISTS work_shifts;
