/*
# Dedication Optimiser — Language learning path (Phase 1: curriculum hierarchy)

## Purpose
Phase 1 of the Duolingo-style language learning system requested: a real
Course → Unit → Module → Lesson hierarchy backing the learning-path UI,
built on top of the existing language tables rather than replacing them.

Mapping onto the existing schema (to avoid a destructive rewrite):
- "Course"  = language_assessments (already one row per user+language)
- "Unit"    = new lang_units table
- "Module"  = new lang_lesson_groups table (a container of lessons within a unit)
- "Lesson"  = existing language_modules rows (individually generated/completed
              teach+practice units) — unchanged in shape, just gains a parent
- "Skill"   = the existing focus_area column on each lesson (vocabulary,
              grammar, listening, speaking, reading) — mastery-per-skill
              scoring is a later phase, not built here

Later phases (adaptive question engine, XP, hearts, spaced repetition,
mastery scoring, checkpoints, review hub) build on top of this structure —
none of that is implemented in this migration.

## New tables

### lang_units
- id, user_id, language, unit_number, title, description, created_at
- UNIQUE (user_id, language, unit_number)

### lang_lesson_groups ("Module" in the spec's terminology)
- id, user_id, language, unit_id, group_number, title, description, created_at
- UNIQUE (unit_id, group_number)

## Altered tables
- language_modules: + lesson_group_id (nullable FK to lang_lesson_groups,
  ON DELETE SET NULL so a lesson never silently disappears if its group is
  removed)

## Backfill
Every existing (user_id, language) pair with lessons but no unit yet gets a
single "Unit 1 / Module 1" created, and all of its existing lessons attached
to it. This is an honest bootstrap, not a fabricated curriculum — going
forward, new lessons roll into new modules/units as each fills up (see
lib/language/hierarchy.ts).

## Security
- RLS enabled on both new tables, owner-scoped CRUD (TO authenticated).
*/

CREATE TABLE IF NOT EXISTS lang_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL,
  unit_number integer NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, language, unit_number)
);

ALTER TABLE lang_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lang_units" ON lang_units;
CREATE POLICY "select_own_lang_units" ON lang_units FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_lang_units" ON lang_units;
CREATE POLICY "insert_own_lang_units" ON lang_units FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_lang_units" ON lang_units;
CREATE POLICY "update_own_lang_units" ON lang_units FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_lang_units" ON lang_units;
CREATE POLICY "delete_own_lang_units" ON lang_units FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS lang_units_user_language_idx
  ON lang_units (user_id, language, unit_number);

CREATE TABLE IF NOT EXISTS lang_lesson_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL,
  unit_id uuid NOT NULL REFERENCES lang_units(id) ON DELETE CASCADE,
  group_number integer NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, group_number)
);

ALTER TABLE lang_lesson_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lang_lesson_groups" ON lang_lesson_groups;
CREATE POLICY "select_own_lang_lesson_groups" ON lang_lesson_groups FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_lang_lesson_groups" ON lang_lesson_groups;
CREATE POLICY "insert_own_lang_lesson_groups" ON lang_lesson_groups FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_lang_lesson_groups" ON lang_lesson_groups;
CREATE POLICY "update_own_lang_lesson_groups" ON lang_lesson_groups FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_lang_lesson_groups" ON lang_lesson_groups;
CREATE POLICY "delete_own_lang_lesson_groups" ON lang_lesson_groups FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS lang_lesson_groups_unit_idx
  ON lang_lesson_groups (unit_id, group_number);

-- Attach lessons to a module (lesson group)
ALTER TABLE language_modules
  ADD COLUMN IF NOT EXISTS lesson_group_id uuid REFERENCES lang_lesson_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS language_modules_lesson_group_idx
  ON language_modules (lesson_group_id);

-- Backfill: give every existing (user, language) with lessons a Unit 1 / Module 1
DO $$
DECLARE
  r RECORD;
  new_unit_id uuid;
  new_group_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id, language FROM language_modules WHERE lesson_group_id IS NULL
  LOOP
    INSERT INTO lang_units (user_id, language, unit_number, title)
    VALUES (r.user_id, r.language, 1, 'Unit 1')
    ON CONFLICT (user_id, language, unit_number) DO UPDATE SET title = lang_units.title
    RETURNING id INTO new_unit_id;

    INSERT INTO lang_lesson_groups (user_id, language, unit_id, group_number, title)
    VALUES (r.user_id, r.language, new_unit_id, 1, 'Module 1')
    ON CONFLICT (unit_id, group_number) DO UPDATE SET title = lang_lesson_groups.title
    RETURNING id INTO new_group_id;

    UPDATE language_modules
    SET lesson_group_id = new_group_id
    WHERE user_id = r.user_id AND language = r.language AND lesson_group_id IS NULL;
  END LOOP;
END $$;
