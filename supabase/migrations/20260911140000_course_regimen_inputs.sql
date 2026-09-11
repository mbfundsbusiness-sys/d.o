/*
# Dedication Optimiser — Cybersecurity/course module, manual input infrastructure

## Purpose
1. A generic "course" module (mirrors the language tutor pattern) so any course
   the user is taking — cybersecurity or otherwise — gets an AI-assisted
   curriculum, module content, and a tutor chat, grounded in a syllabus/notes
   the user pastes in themselves.
2. Manual-input infrastructure the user asked for across existing modules:
   - Gym: a flag distinguishing a hand-written week plan from an AI one
     (gym_plans already supports arbitrary content_json, no new table needed).
   - Prayer: user-settable prayer times (stored on user_settings, never fetched
     externally).
   - Reading: bookmarks — a line/quote + page number to return to.
   - Trading: a chart screenshot attached at trade closure (storage bucket).

## New tables
### course_profiles
One row per (user, course_name). Free-text syllabus/notes ground the AI in
the user's actual course content instead of inventing one.
- id, user_id, course_name, syllabus (text, optional), goal (text, optional),
  ai_summary (text, optional), created_at
- UNIQUE (user_id, course_name)

### course_modules
Same shape as language_modules, generic content_json instead of focus areas.
- id, user_id, course_name, module_number, title, content_json, completed,
  created_at, completed_at

### course_tutor_messages
- id, user_id, module_id, role, content, created_at

### course_sessions
Universal-timer session table for the 'course' activity kind.
- id, user_id, started_at, ended_at, duration_min, course_name, note, created_at

### reading_highlights
A line/quote worth returning to, with the page it's on.
- id, user_id, material_id (nullable FK to reading_materials, set null on delete),
  title (denormalized book title), quote_text, page_number, created_at

## Altered tables
- gym_plans: + is_manual boolean default false (hand-written vs AI-generated week)
- user_settings: + prayer_times jsonb default '{}' (e.g. {"fajr":"05:15", ...})
- trading_sessions: + screenshot_url text (chart at trade closure)

## Storage
- New public bucket `trading-screenshots`, RLS-scoped so each user can only
  read/write/delete objects under their own `${user_id}/...` prefix.

## Security
- RLS enabled on all new tables, owner-scoped CRUD (TO authenticated).
*/

-- Course profile (syllabus/notes the AI grounds curriculum generation in)
CREATE TABLE IF NOT EXISTS course_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  syllabus text,
  goal text,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_name)
);

ALTER TABLE course_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_course_profiles" ON course_profiles;
CREATE POLICY "select_own_course_profiles" ON course_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_course_profiles" ON course_profiles;
CREATE POLICY "insert_own_course_profiles" ON course_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_course_profiles" ON course_profiles;
CREATE POLICY "update_own_course_profiles" ON course_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_course_profiles" ON course_profiles;
CREATE POLICY "delete_own_course_profiles" ON course_profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Course modules
CREATE TABLE IF NOT EXISTS course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  module_number integer NOT NULL,
  title text NOT NULL,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_course_modules" ON course_modules;
CREATE POLICY "select_own_course_modules" ON course_modules FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_course_modules" ON course_modules;
CREATE POLICY "insert_own_course_modules" ON course_modules FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_course_modules" ON course_modules;
CREATE POLICY "update_own_course_modules" ON course_modules FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_course_modules" ON course_modules;
CREATE POLICY "delete_own_course_modules" ON course_modules FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS course_modules_user_course_idx
  ON course_modules (user_id, course_name, module_number);

-- Course tutor chat
CREATE TABLE IF NOT EXISTS course_tutor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_tutor_messages_role_check CHECK (role IN ('user','assistant'))
);

ALTER TABLE course_tutor_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_course_tutor_messages" ON course_tutor_messages;
CREATE POLICY "select_own_course_tutor_messages" ON course_tutor_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_course_tutor_messages" ON course_tutor_messages;
CREATE POLICY "insert_own_course_tutor_messages" ON course_tutor_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_course_tutor_messages" ON course_tutor_messages;
CREATE POLICY "delete_own_course_tutor_messages" ON course_tutor_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS course_tutor_messages_module_idx
  ON course_tutor_messages (module_id, created_at ASC);

-- Course sessions (universal timer)
CREATE TABLE IF NOT EXISTS course_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_min numeric(10,2),
  course_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE course_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_course_sessions" ON course_sessions;
CREATE POLICY "select_own_course_sessions" ON course_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_course_sessions" ON course_sessions;
CREATE POLICY "insert_own_course_sessions" ON course_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_course_sessions" ON course_sessions;
CREATE POLICY "update_own_course_sessions" ON course_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_course_sessions" ON course_sessions;
CREATE POLICY "delete_own_course_sessions" ON course_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS course_sessions_user_started_idx
  ON course_sessions (user_id, started_at DESC);

-- Reading highlights (line + page to come back to)
CREATE TABLE IF NOT EXISTS reading_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id uuid REFERENCES reading_materials(id) ON DELETE SET NULL,
  title text NOT NULL,
  quote_text text NOT NULL,
  page_number integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reading_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reading_highlights" ON reading_highlights;
CREATE POLICY "select_own_reading_highlights" ON reading_highlights FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_reading_highlights" ON reading_highlights;
CREATE POLICY "insert_own_reading_highlights" ON reading_highlights FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_reading_highlights" ON reading_highlights;
CREATE POLICY "update_own_reading_highlights" ON reading_highlights FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_reading_highlights" ON reading_highlights;
CREATE POLICY "delete_own_reading_highlights" ON reading_highlights FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS reading_highlights_user_created_idx
  ON reading_highlights (user_id, created_at DESC);

-- Gym: distinguish hand-written weeks from AI-generated ones
ALTER TABLE gym_plans ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;

-- Prayer: user-settable times, stored only here (never fetched externally)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS prayer_times jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Trading: chart screenshot at trade closure
ALTER TABLE trading_sessions ADD COLUMN IF NOT EXISTS screenshot_url text;

-- Storage bucket for trade-closure chart screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('trading-screenshots', 'trading-screenshots', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "select_own_trading_screenshots" ON storage.objects;
CREATE POLICY "select_own_trading_screenshots" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'trading-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "insert_own_trading_screenshots" ON storage.objects;
CREATE POLICY "insert_own_trading_screenshots" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'trading-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "delete_own_trading_screenshots" ON storage.objects;
CREATE POLICY "delete_own_trading_screenshots" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'trading-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text
  );
