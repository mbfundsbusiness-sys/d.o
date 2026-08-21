/*
# Dedication Optimiser — activity sessions + assistant conversations (v2)

## Purpose
Adds tables for the universal activity timer (trading, gym, language, job search)
and AI assistant conversation persistence. The activity timer pattern: a row is
created with started_at on "Start", then ended_at + duration_min are written on
"Complete". Reopening the app detects a row with started_at but NULL ended_at
and resumes the live timer.

This migration replaces two earlier same-day migrations that both created these
tables with `CREATE TABLE IF NOT EXISTS` — the second silently no-op'd against
the first because the tables already existed, so `duration_min` never actually
became `numeric(10,2)` and `assistant_conversations.role` never got its CHECK
constraint. Squashed into one migration with the intended final schema.

## New Tables

### trading_sessions
- `id` (uuid, pk)
- `user_id` (uuid, owner, defaults to auth.uid())
- `started_at` (timestamptz, when the session began — written immediately on Start)
- `ended_at` (timestamptz, when the session completed — NULL means still running)
- `duration_min` (numeric(10,2), fractional minutes — NULL until completed)
- `in_plan` (boolean, whether the trading session stayed within plan)
- `note` (text, optional)
- `created_at` (timestamptz)

### gym_sessions
- `id` (uuid, pk)
- `user_id` (uuid, owner)
- `started_at` (timestamptz)
- `ended_at` (timestamptz, nullable)
- `duration_min` (numeric(10,2), nullable)
- `workout_type` (text, e.g. "Push", "Pull", "Legs", "Cardio")
- `note` (text, optional)
- `created_at` (timestamptz)

### language_sessions
- `id` (uuid, pk)
- `user_id` (uuid, owner)
- `started_at` (timestamptz)
- `ended_at` (timestamptz, nullable)
- `duration_min` (numeric(10,2), nullable)
- `language` (text, the language being studied — free text, user picks/types)
- `activity_type` (text, vocabulary | grammar | listening | speaking | reading)
- `note` (text, optional)
- `created_at` (timestamptz)

### job_search_sessions
- `id` (uuid, pk)
- `user_id` (uuid, owner)
- `started_at` (timestamptz)
- `ended_at` (timestamptz, nullable)
- `duration_min` (numeric(10,2), nullable)
- `note` (text, optional)
- `created_at` (timestamptz)

### assistant_conversations
Stores full AI assistant chat history. Each row is one message in a conversation.
- `id` (uuid, pk)
- `user_id` (uuid, owner)
- `role` (text, check: 'user' | 'assistant')
- `content` (text, the message content)
- `created_at` (timestamptz)

## Security
- RLS enabled on all new tables.
- Owner-scoped CRUD: authenticated users can only access their own rows.
- `user_id` defaults to `auth.uid()` so inserts omitting it still satisfy WITH CHECK.

## Notes
1. All session tables share the same timer pattern: insert with started_at on
   Start, update with ended_at + duration_min on Complete.
2. duration_min is numeric(10,2) to match what the frontend timer
   (lib/timer/context.tsx) actually computes and writes: fractional minutes
   rounded to 2 decimal places.
3. The universal activity timer reads any of these tables to detect a running
   session (ended_at IS NULL) and resume.
4. activity_type on language_sessions is CHECK-constrained to the 5 valid values.
5. assistant_conversations.role is CHECK-constrained to 'user' | 'assistant'.
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
