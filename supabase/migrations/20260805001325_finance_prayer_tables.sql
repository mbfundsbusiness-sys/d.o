/*
# Dedication Optimiser — Finance + Prayer

## New Tables

### finance_entries
Quick finance logging with AI auto-categorisation.
- id, user_id
- entry_date (date, default today)
- amount (numeric(10,2), always positive — direction is in the type)
- type (text, check: in / out)
- category (text, AI-assigned short label)
- note (text, optional user note)
- ai_categorised (boolean, default true — false if user overrides)
- created_at

### prayer_logs
Daily prayer completion logging. Five prayers per day.
- id, user_id
- log_date (date, default today)
- prayer_name (text, check: fajr/dhuhr/asr/maghrib/isha)
- completed (boolean, default false)
- completed_at (timestamptz, nullable)
- UNIQUE (user_id, log_date, prayer_name)
*/

-- Finance entries
CREATE TABLE IF NOT EXISTS finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC'::text))::date,
  amount numeric(10,2) NOT NULL,
  type text NOT NULL,
  category text NOT NULL DEFAULT 'uncategorised',
  note text,
  ai_categorised boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_entries_type_check CHECK (type IN ('in','out'))
);

ALTER TABLE finance_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_finance_entries" ON finance_entries;
CREATE POLICY "select_own_finance_entries" ON finance_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_finance_entries" ON finance_entries;
CREATE POLICY "insert_own_finance_entries" ON finance_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_finance_entries" ON finance_entries;
CREATE POLICY "update_own_finance_entries" ON finance_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_finance_entries" ON finance_entries;
CREATE POLICY "delete_own_finance_entries" ON finance_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS finance_entries_user_date_idx
  ON finance_entries (user_id, entry_date DESC);

-- Prayer logs
CREATE TABLE IF NOT EXISTS prayer_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC'::text))::date,
  prayer_name text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prayer_logs_prayer_name_check
    CHECK (prayer_name IN ('fajr','dhuhr','asr','maghrib','isha')),
  UNIQUE (user_id, log_date, prayer_name)
);

ALTER TABLE prayer_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_prayer_logs" ON prayer_logs;
CREATE POLICY "select_own_prayer_logs" ON prayer_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_prayer_logs" ON prayer_logs;
CREATE POLICY "insert_own_prayer_logs" ON prayer_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_prayer_logs" ON prayer_logs;
CREATE POLICY "update_own_prayer_logs" ON prayer_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_prayer_logs" ON prayer_logs;
CREATE POLICY "delete_own_prayer_logs" ON prayer_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS prayer_logs_user_date_idx
  ON prayer_logs (user_id, log_date DESC);
