-- Customizable page backdrop (the decorative colour wash behind the glass
-- panels) — synced across devices; the instant per-load application is
-- localStorage (see lib/backdrop.ts), this is just the source of truth.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS backdrop text NOT NULL DEFAULT 'aurora';
