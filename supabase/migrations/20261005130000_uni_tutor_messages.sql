/*
# Uni module AI tutors — chat history

One tutor per lecture module (programming / circuits / maths / engsci — see lib/uni/modules.ts).
Each module keeps its own conversation.

## New table
### uni_tutor_messages
- id, user_id
- module_key (text, check: programming|circuits|maths|engsci)
- role (text, check: user|assistant)
- content (text), created_at

## Security
RLS enabled, owner-scoped CRUD (TO authenticated).
*/

CREATE TABLE IF NOT EXISTS uni_tutor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uni_tutor_messages_module_check CHECK (module_key IN ('programming','circuits','maths','engsci')),
  CONSTRAINT uni_tutor_messages_role_check CHECK (role IN ('user','assistant'))
);

ALTER TABLE uni_tutor_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_uni_tutor_messages" ON uni_tutor_messages;
CREATE POLICY "select_own_uni_tutor_messages" ON uni_tutor_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_uni_tutor_messages" ON uni_tutor_messages;
CREATE POLICY "insert_own_uni_tutor_messages" ON uni_tutor_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_uni_tutor_messages" ON uni_tutor_messages;
CREATE POLICY "delete_own_uni_tutor_messages" ON uni_tutor_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS uni_tutor_messages_user_module_idx ON uni_tutor_messages (user_id, module_key, created_at);

/*
-- ROLLBACK
DROP TABLE IF EXISTS uni_tutor_messages;
*/
