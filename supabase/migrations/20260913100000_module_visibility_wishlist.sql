/*
# Dedication Optimiser — module visibility toggle + Wishlist

## Purpose
1. Let the user hide nav modules they don't use (Settings > Modules),
   without deleting any of that module's data — just a display preference.
2. A Wishlist module: items the user wants to purchase, with optional price,
   link, priority, and a purchased toggle.

## Altered tables
- user_settings: + hidden_modules jsonb default '[]' (array of href strings)

## New table
### wishlist_items
- id, user_id
- title, url (optional), price (numeric, optional), priority (text, check:
  low/medium/high), notes (optional), purchased (boolean, default false),
  purchased_at (timestamptz, nullable), created_at

## Security
- RLS enabled, owner-scoped CRUD (TO authenticated).
*/

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS hidden_modules jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text,
  price numeric(10,2),
  priority text NOT NULL DEFAULT 'medium',
  notes text,
  purchased boolean NOT NULL DEFAULT false,
  purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wishlist_items_priority_check CHECK (priority IN ('low','medium','high'))
);

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wishlist_items" ON wishlist_items;
CREATE POLICY "select_own_wishlist_items" ON wishlist_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wishlist_items" ON wishlist_items;
CREATE POLICY "insert_own_wishlist_items" ON wishlist_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wishlist_items" ON wishlist_items;
CREATE POLICY "update_own_wishlist_items" ON wishlist_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wishlist_items" ON wishlist_items;
CREATE POLICY "delete_own_wishlist_items" ON wishlist_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS wishlist_items_user_purchased_idx
  ON wishlist_items (user_id, purchased, created_at DESC);
