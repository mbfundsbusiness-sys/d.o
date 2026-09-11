/*
# Dedication Optimiser — Language learning path (Phase 4: mastery + spaced repetition)

## Purpose
Phase 4: each completed lesson ("concept", in the spec's terms — the
granularity we actually have) gets a real memory state instead of being
considered "done" forever once first passed. Mastery is built up only
through successful review over time, on an increasing interval schedule,
and knocked back down on a failed review — never just from finishing a
lesson once.

## New table

### lang_concept_mastery
One row per (user, lesson). Created the first time a lesson is passed;
updated every time it's reviewed again later.
- id, user_id, lesson_id (FK language_modules, cascade delete)
- mastery (0-100, default 0)
- successful_recalls (integer, default 0 — successful spaced reviews so far)
- interval_days (integer, default 1 — the current spaced-repetition interval)
- last_reviewed_at, next_review_at (timestamptz)
- created_at, updated_at
- UNIQUE (user_id, lesson_id)

## Security
- RLS enabled, owner-scoped CRUD (TO authenticated).
*/

CREATE TABLE IF NOT EXISTS lang_concept_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES language_modules(id) ON DELETE CASCADE,
  mastery numeric(5,2) NOT NULL DEFAULT 0,
  successful_recalls integer NOT NULL DEFAULT 0,
  interval_days integer NOT NULL DEFAULT 1,
  last_reviewed_at timestamptz NOT NULL DEFAULT now(),
  next_review_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id),
  CONSTRAINT lang_concept_mastery_range_check CHECK (mastery BETWEEN 0 AND 100)
);

ALTER TABLE lang_concept_mastery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lang_concept_mastery" ON lang_concept_mastery;
CREATE POLICY "select_own_lang_concept_mastery" ON lang_concept_mastery FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_lang_concept_mastery" ON lang_concept_mastery;
CREATE POLICY "insert_own_lang_concept_mastery" ON lang_concept_mastery FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_lang_concept_mastery" ON lang_concept_mastery;
CREATE POLICY "update_own_lang_concept_mastery" ON lang_concept_mastery FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_lang_concept_mastery" ON lang_concept_mastery;
CREATE POLICY "delete_own_lang_concept_mastery" ON lang_concept_mastery FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS lang_concept_mastery_due_idx
  ON lang_concept_mastery (user_id, next_review_at);

DROP TRIGGER IF EXISTS touch_lang_concept_mastery ON lang_concept_mastery;
CREATE TRIGGER touch_lang_concept_mastery BEFORE UPDATE ON lang_concept_mastery
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
