/*
# BotCouncil timer sessions
Universal-timer session table for the 'botcouncil' activity kind.
- id, user_id, started_at, ended_at, duration_min, note, created_at
RLS enabled, owner-scoped CRUD (TO authenticated).
*/

CREATE TABLE IF NOT EXISTS botcouncil_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_min numeric(10,2),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE botcouncil_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_botcouncil_sessions" ON botcouncil_sessions;
CREATE POLICY "select_own_botcouncil_sessions" ON botcouncil_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_botcouncil_sessions" ON botcouncil_sessions;
CREATE POLICY "insert_own_botcouncil_sessions" ON botcouncil_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_botcouncil_sessions" ON botcouncil_sessions;
CREATE POLICY "update_own_botcouncil_sessions" ON botcouncil_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_botcouncil_sessions" ON botcouncil_sessions;
CREATE POLICY "delete_own_botcouncil_sessions" ON botcouncil_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS botcouncil_sessions_user_started_idx
  ON botcouncil_sessions (user_id, started_at DESC);
