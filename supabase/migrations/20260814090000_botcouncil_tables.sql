/*
# Dedication Optimiser — BotCouncil maintenance tracking

## Purpose
Replaces the single `botcouncil_checked` checkbox that used to live inside
daily anchor logs with a dedicated tracking surface: a health-check log
(cron/deployment status) and a simple maintenance task list.

## Changes to existing tables

### anchor_logs
- Drops `botcouncil_checked` — BotCouncil now has its own log (see below),
  so it's no longer part of the daily anchor set.

## New Tables

### botcouncil_checks
Append-only health-check log. One row per check performed.
- `id` (uuid, pk)
- `user_id` (uuid, owner, defaults to auth.uid())
- `status` (text, check: 'healthy' | 'issue')
- `note` (text, optional — what was checked / what broke)
- `checked_at` (timestamptz, when the check was performed — defaults to now)
- `created_at` (timestamptz)

### botcouncil_tasks
Simple maintenance task list (not recurring/scheduled — just add, complete,
delete as needed).
- `id` (uuid, pk)
- `user_id` (uuid, owner)
- `title` (text, not null)
- `completed` (boolean, default false)
- `completed_at` (timestamptz, nullable)
- `created_at` (timestamptz)

## Security
- RLS enabled on both new tables, owner-scoped CRUD.
- `user_id` defaults to `auth.uid()` so inserts omitting it still satisfy WITH CHECK.
*/

-- Drop the old anchor-log checkbox field
ALTER TABLE anchor_logs DROP COLUMN IF EXISTS botcouncil_checked;

-- BotCouncil health-check log
CREATE TABLE IF NOT EXISTS botcouncil_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT botcouncil_checks_status_check CHECK (status IN ('healthy','issue'))
);

ALTER TABLE botcouncil_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_botcouncil_checks" ON botcouncil_checks;
CREATE POLICY "select_own_botcouncil_checks" ON botcouncil_checks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_botcouncil_checks" ON botcouncil_checks;
CREATE POLICY "insert_own_botcouncil_checks" ON botcouncil_checks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_botcouncil_checks" ON botcouncil_checks;
CREATE POLICY "update_own_botcouncil_checks" ON botcouncil_checks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_botcouncil_checks" ON botcouncil_checks;
CREATE POLICY "delete_own_botcouncil_checks" ON botcouncil_checks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS botcouncil_checks_user_checked_idx
  ON botcouncil_checks (user_id, checked_at DESC);

-- BotCouncil maintenance task list
CREATE TABLE IF NOT EXISTS botcouncil_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE botcouncil_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_botcouncil_tasks" ON botcouncil_tasks;
CREATE POLICY "select_own_botcouncil_tasks" ON botcouncil_tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_botcouncil_tasks" ON botcouncil_tasks;
CREATE POLICY "insert_own_botcouncil_tasks" ON botcouncil_tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_botcouncil_tasks" ON botcouncil_tasks;
CREATE POLICY "update_own_botcouncil_tasks" ON botcouncil_tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_botcouncil_tasks" ON botcouncil_tasks;
CREATE POLICY "delete_own_botcouncil_tasks" ON botcouncil_tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS botcouncil_tasks_user_completed_idx
  ON botcouncil_tasks (user_id, completed, created_at DESC);
