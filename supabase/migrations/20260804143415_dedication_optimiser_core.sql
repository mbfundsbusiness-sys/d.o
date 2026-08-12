/*
# Dedication Optimiser — core schema (v1)

## Purpose
Single-user life-OS app. Tracks daily discipline anchors and job applications.
Core principle: nothing resets silently — every log entry is a timestamped row,
never a boolean that overwrites. Streaks and history are derived from persisted rows.

## New Tables

### anchor_logs
Append-only daily discipline log. One row per entry (not per day) so the user
can log multiple times and history is never overwritten.
- `id` (uuid, pk)
- `user_id` (uuid, owner, defaults to auth.uid())
- `log_date` (date, the day the log represents — defaults to today UTC)
- `wake_time` (text, free-form e.g. "06:40")
- `applications_sent` (int, number of job applications sent that day)
- `trading_in_plan` (boolean, whether trading stayed within plan)
- `botcouncil_checked` (boolean, whether BotCouncil maintenance was done)
- `note` (text, optional free-form reflection)
- `created_at` (timestamptz)

### job_applications
Job application tracker with status pipeline and follow-up flagging.
- `id` (uuid, pk)
- `user_id` (uuid, owner, defaults to auth.uid())
- `company` (text, not null)
- `role` (text, not null)
- `location` (text, e.g. "London" or "Reading")
- `url` (text, optional link to posting)
- `status` (text, pipeline: researching | applied | phone_screen | interview | offer | rejected | withdrawn)
- `applied_date` (date, the day the application was submitted)
- `follow_up_sent` (boolean, whether a follow-up has been sent)
- `note` (text, optional)
- `created_at` (timestamptz)
- `updated_at` (timestamptz, auto-updated via trigger)

## Security
- RLS enabled on both tables.
- Owner-scoped CRUD: authenticated users can only access their own rows.
- `user_id` defaults to `auth.uid()` so inserts omitting it still satisfy WITH CHECK.

## Notes
1. `anchor_logs` is intentionally append-only — an UPDATE policy is provided for
   correcting mistakes (e.g. wrong wake time).
2. `job_applications.updated_at` is maintained by a trigger so follow-up
   flagging and pipeline changes always carry an accurate last-touched time.
3. Follow-up flagging at 5 working days is computed in the frontend from
   `applied_date` + `status`, not stored as a column — it is derived data.
*/

CREATE TABLE IF NOT EXISTS anchor_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  wake_time text,
  applications_sent integer NOT NULL DEFAULT 0,
  trading_in_plan boolean NOT NULL DEFAULT false,
  botcouncil_checked boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE anchor_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_anchor_logs" ON anchor_logs;
CREATE POLICY "select_own_anchor_logs" ON anchor_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_anchor_logs" ON anchor_logs;
CREATE POLICY "insert_own_anchor_logs" ON anchor_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_anchor_logs" ON anchor_logs;
CREATE POLICY "update_own_anchor_logs" ON anchor_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_anchor_logs" ON anchor_logs;
CREATE POLICY "delete_own_anchor_logs" ON anchor_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS anchor_logs_user_log_date_idx
  ON anchor_logs (user_id, log_date DESC);

CREATE TABLE IF NOT EXISTS job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company text NOT NULL,
  role text NOT NULL,
  location text,
  url text,
  status text NOT NULL DEFAULT 'researching',
  applied_date date,
  follow_up_sent boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_applications_status_check
    CHECK (status IN ('researching','applied','phone_screen','interview','offer','rejected','withdrawn'))
);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_job_applications" ON job_applications;
CREATE POLICY "select_own_job_applications" ON job_applications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_job_applications" ON job_applications;
CREATE POLICY "insert_own_job_applications" ON job_applications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_job_applications" ON job_applications;
CREATE POLICY "update_own_job_applications" ON job_applications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_job_applications" ON job_applications;
CREATE POLICY "delete_own_job_applications" ON job_applications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS job_applications_user_status_idx
  ON job_applications (user_id, status);

CREATE INDEX IF NOT EXISTS job_applications_user_applied_date_idx
  ON job_applications (user_id, applied_date DESC);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_applications_touch_updated_at ON job_applications;
CREATE TRIGGER job_applications_touch_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();
