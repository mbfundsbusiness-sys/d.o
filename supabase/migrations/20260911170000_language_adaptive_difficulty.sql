/*
# Dedication Optimiser — Language learning path (Phase 3: adaptive difficulty)

## Purpose
Phase 3 of the Duolingo-style language learning system: a real per-skill
ability estimate that actually drives question difficulty within a lesson,
replacing Phase 2's fixed upfront batch of 8 questions with sequential
generation — each question's difficulty is chosen from the learner's recent
performance and stored ability, not fixed in advance.

## New table

### lang_skill_ability
One row per (user, language, focus_area). A 0-100 estimate, nudged after
every answer (lang_question_attempts) — never reset by lesson completion,
since it reflects the skill, not a single lesson's outcome.
- id, user_id, language, focus_area, ability (0-100, default 50), updated_at
- UNIQUE (user_id, language, focus_area)

## Security
- RLS enabled, owner-scoped CRUD (TO authenticated).
*/

CREATE TABLE IF NOT EXISTS lang_skill_ability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL,
  focus_area text NOT NULL,
  ability numeric(5,2) NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, language, focus_area),
  CONSTRAINT lang_skill_ability_range_check CHECK (ability BETWEEN 0 AND 100)
);

ALTER TABLE lang_skill_ability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lang_skill_ability" ON lang_skill_ability;
CREATE POLICY "select_own_lang_skill_ability" ON lang_skill_ability FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_lang_skill_ability" ON lang_skill_ability;
CREATE POLICY "insert_own_lang_skill_ability" ON lang_skill_ability FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_lang_skill_ability" ON lang_skill_ability;
CREATE POLICY "update_own_lang_skill_ability" ON lang_skill_ability FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_lang_skill_ability" ON lang_skill_ability;
CREATE POLICY "delete_own_lang_skill_ability" ON lang_skill_ability FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS lang_skill_ability_user_idx
  ON lang_skill_ability (user_id, language, focus_area);
