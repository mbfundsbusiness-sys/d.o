/*
# Dedication Optimiser — v2: activity sessions + assistant

## Purpose
Adds tables for the universal activity timer (trading, gym, language, job search),
the language learning module, and the AI assistant conversation history.

## New Tables

### trading_sessions
Tracks trading discipline sessions via the universal timer.
- id, user_id (owner, default auth.uid())
- started_at (timestamptz, when the timer started)
- ended_at (timestamptz, nullable, when completed)
- duration_min (numeric, nullable, calculated on complete)
- in_plan (boolean, default false — did trading stay in plan)
- note (text, optional)
- created_at

### gym_sessions
Tracks gym workouts via the universal timer.
- id, user_id, started_at, ended_at, duration_min
- workout_type (text, optional — e.g. "Push", "Pull", "Legs", "Cardio")
- note, created_at

### language_sessions
Tracks language learning sessions via the universal timer.
- id, user_id, started_at, ended_at, duration_min
- language (text, not null — user picks/types the language)
- activity_type (text, check: vocabulary/grammar/listening/speaking/reading)
- note, created_at

### job_search_sessions
Tracks focused job-search work blocks via the universal timer.
- id, user_id, started_at, ended_at, duration_min
- note, created_at

### assistant_conversations
Stores full AI assistant chat history. Append-only.
- id, user_id
- role (text, check: user/assistant)
- content (text, the message)
- created_at

## Security
- RLS enabled on all new tables.
- Owner-scoped CRUD: authenticated users can only access their own rows.
- user_id defaults to auth.uid() on all tables.

## Notes
1. All session tables share the same timer pattern: started_at on create,
   ended_at + duration_min on complete.
2. duration_min is numeric(10,2) to allow fractional minutes from short sessions.
3. The universal timer detects "running" sessions by querying for rows where
   ended_at IS NULL, ordered by started_at DESC.
*/

-- Trading sessions
CREATE TABLE IF NOT EXISTS trading_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_min numeric(10,2),
  in_plan boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trading_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_trading_sessions" ON trading_sessions;
CREATE POLICY "select_own_trading_sessions" ON trading_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_trading_sessions" ON trading_sessions;
CREATE POLICY "insert_own_trading_sessions" ON trading_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_trading_sessions" ON trading_sessions;
CREATE POLICY "update_own_trading_sessions" ON trading_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_trading_sessions" ON trading_sessions;
CREATE POLICY "delete_own_trading_sessions" ON trading_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS trading_sessions_user_started_idx
  ON trading_sessions (user_id, started_at DESC);

-- Gym sessions
CREATE TABLE IF NOT EXISTS gym_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_min numeric(10,2),
  workout_type text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_gym_sessions" ON gym_sessions;
CREATE POLICY "select_own_gym_sessions" ON gym_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_gym_sessions" ON gym_sessions;
CREATE POLICY "insert_own_gym_sessions" ON gym_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_gym_sessions" ON gym_sessions;
CREATE POLICY "update_own_gym_sessions" ON gym_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_gym_sessions" ON gym_sessions;
CREATE POLICY "delete_own_gym_sessions" ON gym_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS gym_sessions_user_started_idx
  ON gym_sessions (user_id, started_at DESC);

-- Language sessions
CREATE TABLE IF NOT EXISTS language_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_min numeric(10,2),
  language text NOT NULL,
  activity_type text NOT NULL DEFAULT 'vocabulary',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT language_sessions_activity_type_check
    CHECK (activity_type IN ('vocabulary','grammar','listening','speaking','reading'))
);

ALTER TABLE language_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_language_sessions" ON language_sessions;
CREATE POLICY "select_own_language_sessions" ON language_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_language_sessions" ON language_sessions;
CREATE POLICY "insert_own_language_sessions" ON language_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_language_sessions" ON language_sessions;
CREATE POLICY "update_own_language_sessions" ON language_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_language_sessions" ON language_sessions;
CREATE POLICY "delete_own_language_sessions" ON language_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS language_sessions_user_started_idx
  ON language_sessions (user_id, started_at DESC);

-- Job search sessions
CREATE TABLE IF NOT EXISTS job_search_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_min numeric(10,2),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_search_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_job_search_sessions" ON job_search_sessions;
CREATE POLICY "select_own_job_search_sessions" ON job_search_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_job_search_sessions" ON job_search_sessions;
CREATE POLICY "insert_own_job_search_sessions" ON job_search_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_job_search_sessions" ON job_search_sessions;
CREATE POLICY "update_own_job_search_sessions" ON job_search_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_job_search_sessions" ON job_search_sessions;
CREATE POLICY "delete_own_job_search_sessions" ON job_search_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS job_search_sessions_user_started_idx
  ON job_search_sessions (user_id, started_at DESC);

-- Assistant conversations
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_conversations_role_check
    CHECK (role IN ('user','assistant'))
);

ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_assistant_conversations" ON assistant_conversations;
CREATE POLICY "select_own_assistant_conversations" ON assistant_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_assistant_conversations" ON assistant_conversations;
CREATE POLICY "insert_own_assistant_conversations" ON assistant_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_assistant_conversations" ON assistant_conversations;
CREATE POLICY "update_own_assistant_conversations" ON assistant_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_assistant_conversations" ON assistant_conversations;
CREATE POLICY "delete_own_assistant_conversations" ON assistant_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS assistant_conversations_user_created_idx
  ON assistant_conversations (user_id, created_at DESC);
