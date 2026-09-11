/*
# Dedication Optimiser — Reading module, weekly Schedule, and user settings

## Purpose
Adds the Reading module (same pattern as the other modules — a session table
driven by the universal timer, plus a reading list), a user-defined weekly
schedule (`schedule_blocks`), and a per-user settings row (`user_settings`)
holding the editable Jummah time used to derive the Friday midday block.

## New Tables

### reading_sessions
Universal-timer session table (same shape as language_sessions): a row is
created with started_at on Start, then ended_at + duration_min on Complete.
- id, user_id (owner, defaults to auth.uid())
- started_at (timestamptz), ended_at (timestamptz, NULL = running)
- duration_min (numeric(10,2), NULL until completed)
- title (text, book / material being read)
- pages (integer, pages covered — optional)
- note (text, optional)
- created_at

### reading_materials
The reading list / currently-reading view.
- id, user_id (owner)
- title (text), author (text, optional)
- status (text, check: reading | completed | queued)
- total_pages (integer, optional), current_page (integer, default 0)
- created_at, updated_at (touch trigger)

### schedule_blocks
User-defined recurring weekly schedule. Starts empty — the app never seeds it.
- id, user_id (owner)
- day_of_week (smallint 0-6, 0 = Sunday)
- activity_type (text, check: trading | botcouncil | reading | custom)
- start_time (time), end_time (time)
- label (text)
- created_at, updated_at (touch trigger)

### user_settings
One row per user (upsert on user_id).
- id, user_id (owner, unique)
- timezone (text, default 'Europe/London')
- jummah_time (time, nullable — no default; user sets it in Settings)
- jummah_duration_min (integer, default 60)
- created_at, updated_at (touch trigger)

## Security
- RLS enabled on all tables, owner-scoped CRUD (TO authenticated).
- user_id defaults to auth.uid() so inserts omitting it still satisfy WITH CHECK.
*/

-- Reading sessions
CREATE TABLE IF NOT EXISTS reading_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_min numeric(10,2),
  title text,
  pages integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reading_sessions" ON reading_sessions;
CREATE POLICY "select_own_reading_sessions" ON reading_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_reading_sessions" ON reading_sessions;
CREATE POLICY "insert_own_reading_sessions" ON reading_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_reading_sessions" ON reading_sessions;
CREATE POLICY "update_own_reading_sessions" ON reading_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_reading_sessions" ON reading_sessions;
CREATE POLICY "delete_own_reading_sessions" ON reading_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS reading_sessions_user_started_idx
  ON reading_sessions (user_id, started_at DESC);

-- Reading materials (reading list)
CREATE TABLE IF NOT EXISTS reading_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  status text NOT NULL DEFAULT 'reading',
  total_pages integer,
  current_page integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reading_materials_status_check
    CHECK (status IN ('reading','completed','queued'))
);

ALTER TABLE reading_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reading_materials" ON reading_materials;
CREATE POLICY "select_own_reading_materials" ON reading_materials FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_reading_materials" ON reading_materials;
CREATE POLICY "insert_own_reading_materials" ON reading_materials FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_reading_materials" ON reading_materials;
CREATE POLICY "update_own_reading_materials" ON reading_materials FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_reading_materials" ON reading_materials;
CREATE POLICY "delete_own_reading_materials" ON reading_materials FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS reading_materials_user_status_idx
  ON reading_materials (user_id, status);

DROP TRIGGER IF EXISTS touch_reading_materials ON reading_materials;
CREATE TRIGGER touch_reading_materials BEFORE UPDATE ON reading_materials
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Weekly schedule blocks
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  activity_type text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_blocks_day_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT schedule_blocks_activity_check
    CHECK (activity_type IN ('trading','botcouncil','reading','custom'))
);

ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_schedule_blocks" ON schedule_blocks;
CREATE POLICY "select_own_schedule_blocks" ON schedule_blocks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_schedule_blocks" ON schedule_blocks;
CREATE POLICY "insert_own_schedule_blocks" ON schedule_blocks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_schedule_blocks" ON schedule_blocks;
CREATE POLICY "update_own_schedule_blocks" ON schedule_blocks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_schedule_blocks" ON schedule_blocks;
CREATE POLICY "delete_own_schedule_blocks" ON schedule_blocks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS schedule_blocks_user_day_idx
  ON schedule_blocks (user_id, day_of_week, start_time);

DROP TRIGGER IF EXISTS touch_schedule_blocks ON schedule_blocks;
CREATE TRIGGER touch_schedule_blocks BEFORE UPDATE ON schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Per-user settings
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Europe/London',
  jummah_time time,
  jummah_duration_min integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user_settings" ON user_settings;
CREATE POLICY "select_own_user_settings" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_user_settings" ON user_settings;
CREATE POLICY "insert_own_user_settings" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_user_settings" ON user_settings;
CREATE POLICY "update_own_user_settings" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_user_settings" ON user_settings;
CREATE POLICY "delete_own_user_settings" ON user_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS touch_user_settings ON user_settings;
CREATE TRIGGER touch_user_settings BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
