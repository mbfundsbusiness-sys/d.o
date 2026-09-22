/*
# Dedication Optimiser — To-do list

## Purpose
Short-term, one-off tasks that are too minor to belong in the weekly
Schedule (a recurring routine) but still need a "don't forget" reminder.
Each item can optionally carry a due date/time; when set, it feeds into the
same in-app alert system as schedule blocks and prayer times — a banner
15 minutes before and at the due time, while the app is open.

## New table

### todo_items
- id, user_id
- title (text)
- notes (text, optional)
- due_at (timestamptz, optional — no due time means no alert, just a plain
  to-do)
- completed (boolean, default false), completed_at (timestamptz, nullable)
- created_at

## Security
- RLS enabled, owner-scoped CRUD (TO authenticated).
*/

CREATE TABLE IF NOT EXISTS todo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  due_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_todo_items" ON todo_items;
CREATE POLICY "select_own_todo_items" ON todo_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_todo_items" ON todo_items;
CREATE POLICY "insert_own_todo_items" ON todo_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_todo_items" ON todo_items;
CREATE POLICY "update_own_todo_items" ON todo_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_todo_items" ON todo_items;
CREATE POLICY "delete_own_todo_items" ON todo_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS todo_items_user_due_idx
  ON todo_items (user_id, completed, due_at);
