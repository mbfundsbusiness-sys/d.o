/*
# Dedication Optimiser — Ghostwriter Module

## Purpose
AI lyric co-writing assistant that builds a picture of the user's style from
their own past lyrics and reference tracks (described in text — no audio
upload/analysis in this pass), then helps write new songs through an
iterative chat, mirroring the language tutor chat pattern.

## New Tables

### ghostwriter_style_lyrics
Past songs the user pastes in so the AI can learn their voice — themes,
rhyme patterns, vocabulary, structure.
- id, user_id
- title (text)
- lyrics_text (text)
- notes (text, optional — e.g. "early stuff", "more commercial")
- created_at

### ghostwriter_references
Reference tracks described in text (artist/track/sound) — stands in for
audio analysis: the user describes the mood/genre/production they're
chasing and the AI reasons about it from that description.
- id, user_id
- artist (text, optional)
- track (text, optional)
- description (text — sound, mood, tempo, genre, production notes)
- created_at

### ghostwriter_songs
A song in progress or finished — the working lyrics document.
- id, user_id
- title (text)
- status (text, check: draft/finished)
- brief (text, optional — topic/mood/direction for this song)
- lyrics_text (text, default '')
- created_at, updated_at

### ghostwriter_chat_messages
Co-writing chat tied to a song, same shape as the language tutor chat.
- id, user_id, song_id
- role (text, check: user/assistant)
- content (text)
- created_at

## Security
- RLS enabled on all tables, owner-scoped CRUD.
*/

-- Past lyrics (style profile)
CREATE TABLE IF NOT EXISTS ghostwriter_style_lyrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  lyrics_text text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ghostwriter_style_lyrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ghostwriter_style_lyrics" ON ghostwriter_style_lyrics;
CREATE POLICY "select_own_ghostwriter_style_lyrics" ON ghostwriter_style_lyrics FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ghostwriter_style_lyrics" ON ghostwriter_style_lyrics;
CREATE POLICY "insert_own_ghostwriter_style_lyrics" ON ghostwriter_style_lyrics FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ghostwriter_style_lyrics" ON ghostwriter_style_lyrics;
CREATE POLICY "update_own_ghostwriter_style_lyrics" ON ghostwriter_style_lyrics FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ghostwriter_style_lyrics" ON ghostwriter_style_lyrics;
CREATE POLICY "delete_own_ghostwriter_style_lyrics" ON ghostwriter_style_lyrics FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Reference tracks (sound/mood, described in text)
CREATE TABLE IF NOT EXISTS ghostwriter_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  artist text,
  track text,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ghostwriter_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ghostwriter_references" ON ghostwriter_references;
CREATE POLICY "select_own_ghostwriter_references" ON ghostwriter_references FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ghostwriter_references" ON ghostwriter_references;
CREATE POLICY "insert_own_ghostwriter_references" ON ghostwriter_references FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ghostwriter_references" ON ghostwriter_references;
CREATE POLICY "update_own_ghostwriter_references" ON ghostwriter_references FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ghostwriter_references" ON ghostwriter_references;
CREATE POLICY "delete_own_ghostwriter_references" ON ghostwriter_references FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Songs
CREATE TABLE IF NOT EXISTS ghostwriter_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  brief text,
  lyrics_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghostwriter_songs_status_check CHECK (status IN ('draft','finished'))
);

ALTER TABLE ghostwriter_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ghostwriter_songs" ON ghostwriter_songs;
CREATE POLICY "select_own_ghostwriter_songs" ON ghostwriter_songs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ghostwriter_songs" ON ghostwriter_songs;
CREATE POLICY "insert_own_ghostwriter_songs" ON ghostwriter_songs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ghostwriter_songs" ON ghostwriter_songs;
CREATE POLICY "update_own_ghostwriter_songs" ON ghostwriter_songs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ghostwriter_songs" ON ghostwriter_songs;
CREATE POLICY "delete_own_ghostwriter_songs" ON ghostwriter_songs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ghostwriter_songs_user_updated_idx
  ON ghostwriter_songs (user_id, updated_at DESC);

-- Co-writing chat messages
CREATE TABLE IF NOT EXISTS ghostwriter_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES ghostwriter_songs(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghostwriter_chat_messages_role_check CHECK (role IN ('user','assistant'))
);

ALTER TABLE ghostwriter_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ghostwriter_chat_messages" ON ghostwriter_chat_messages;
CREATE POLICY "select_own_ghostwriter_chat_messages" ON ghostwriter_chat_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ghostwriter_chat_messages" ON ghostwriter_chat_messages;
CREATE POLICY "insert_own_ghostwriter_chat_messages" ON ghostwriter_chat_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ghostwriter_chat_messages" ON ghostwriter_chat_messages;
CREATE POLICY "delete_own_ghostwriter_chat_messages" ON ghostwriter_chat_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ghostwriter_chat_messages_song_idx
  ON ghostwriter_chat_messages (song_id, created_at ASC);
