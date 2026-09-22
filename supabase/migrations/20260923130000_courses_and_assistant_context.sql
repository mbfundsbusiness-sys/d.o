/*
# Dedication Optimiser — scheduling rework (5/6): manual courses + assistant context

## Purpose
1. courses: manually-logged external learning (a Skool.com course, a paid
   cohort, anything not run through this app's own AI). Completely separate
   from the Language module's AI-generated curriculum and from the
   AI-driven "Course" companion module (course_profiles/course_modules)
   built earlier — no AI touches this table, the user adds/updates it
   directly. Sessions against it use the existing universal timer
   ('course' ActivityKind, same course_sessions table the AI companion
   module already uses — time tracking doesn't care which kind of course).
2. No schema change needed for the assistant context extension itself
   (recurring_commitments, today's schedule, courses, wishlist_items all
   already exist and are just read) — this migration is (1) only.

## New table

### courses
- id, user_id
- title (text), platform (text, free text — e.g. "Skool.com", "Udemy")
- module_lesson (text, optional — where you are in it right now)
- progress_percent (integer 0-100, default 0)
- notes (text, optional)
- status (text, check: active|completed, default 'active')
- created_at, updated_at

## Security
- RLS enabled, owner-scoped CRUD (TO authenticated).
*/

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  platform text,
  module_lesson text,
  progress_percent integer NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_progress_check CHECK (progress_percent BETWEEN 0 AND 100),
  CONSTRAINT courses_status_check CHECK (status IN ('active','completed'))
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_courses" ON courses;
CREATE POLICY "select_own_courses" ON courses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_courses" ON courses;
CREATE POLICY "insert_own_courses" ON courses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_courses" ON courses;
CREATE POLICY "update_own_courses" ON courses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_courses" ON courses;
CREATE POLICY "delete_own_courses" ON courses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS courses_user_status_idx ON courses (user_id, status);

DROP TRIGGER IF EXISTS touch_courses ON courses;
CREATE TRIGGER touch_courses BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
