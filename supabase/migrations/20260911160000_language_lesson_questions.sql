/*
# Dedication Optimiser — Language learning path (Phase 2: lesson player)

## Purpose
Phase 2 of the Duolingo-style language learning system: a real
question-by-question lesson player backed by AI-generated questions and
server-side answer evaluation (the frontend never decides correctness —
per the spec's "AI question generation contract").

## New tables

### lang_questions
Questions generated for one lesson (a language_modules row). The
correct_answer/acceptable_answers/explanation columns are never sent to the
client directly — only through the sanitised generate-questions response
and the check-answer verdict.
- id, user_id, lesson_id (FK language_modules, cascade delete)
- question_type (check: multiple_choice | translation | fill_blank)
- prompt, options (jsonb array, multiple_choice only), correct_answer,
  acceptable_answers (jsonb array of alternate accepted strings),
  explanation, hint, difficulty (1-5), order_index, created_at

### lang_question_attempts
Every answer a learner submits, correct or not — the raw signal later
phases (mastery, spaced repetition) will read.
- id, user_id, question_id (FK lang_questions, cascade delete),
  lesson_id (denormalized FK language_modules, cascade delete),
  user_answer, is_correct, hint_used, created_at

## Security
- RLS enabled on both tables, owner-scoped CRUD (TO authenticated).
- In practice only the service-role API routes read/write correct_answer /
  acceptable_answers / explanation; RLS still applies as defense in depth
  if a client ever queries these tables directly.
*/

CREATE TABLE IF NOT EXISTS lang_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES language_modules(id) ON DELETE CASCADE,
  question_type text NOT NULL,
  prompt text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  acceptable_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text,
  hint text,
  difficulty smallint NOT NULL DEFAULT 2,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lang_questions_type_check
    CHECK (question_type IN ('multiple_choice','translation','fill_blank')),
  CONSTRAINT lang_questions_difficulty_check CHECK (difficulty BETWEEN 1 AND 5)
);

ALTER TABLE lang_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lang_questions" ON lang_questions;
CREATE POLICY "select_own_lang_questions" ON lang_questions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_lang_questions" ON lang_questions;
CREATE POLICY "insert_own_lang_questions" ON lang_questions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_lang_questions" ON lang_questions;
CREATE POLICY "delete_own_lang_questions" ON lang_questions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS lang_questions_lesson_idx
  ON lang_questions (lesson_id, order_index);

CREATE TABLE IF NOT EXISTS lang_question_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES lang_questions(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES language_modules(id) ON DELETE CASCADE,
  user_answer text,
  is_correct boolean NOT NULL,
  hint_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lang_question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lang_question_attempts" ON lang_question_attempts;
CREATE POLICY "select_own_lang_question_attempts" ON lang_question_attempts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_lang_question_attempts" ON lang_question_attempts;
CREATE POLICY "insert_own_lang_question_attempts" ON lang_question_attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS lang_question_attempts_lesson_idx
  ON lang_question_attempts (lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lang_question_attempts_user_idx
  ON lang_question_attempts (user_id, created_at DESC);
