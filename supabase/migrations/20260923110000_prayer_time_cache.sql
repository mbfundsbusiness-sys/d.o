/*
# Dedication Optimiser — scheduling rework (3/6): calculated prayer times

## Purpose
Prayer stops being a manually-typed time and becomes a real registrant like
every other module: actual Fajr-Isha times are calculated for London via a
public calculation API (Aladhan, Moonsighting Committee method) once per
day and cached, then written as real schedule_blocks rows (source='auto',
15 min each) — the existing Friday Jummah override in
lib/schedule/effective.ts keeps working unchanged, now overriding a real
Dhuhr block instead of nothing.

## New table

### prayer_time_cache
Not user-specific — London prayer times are the same for every user, so
this is one row per calendar date, shared, read-only to clients.
- date (primary key)
- fajr, sunrise, dhuhr, asr, maghrib, isha (time)
- fetched_at (timestamptz)

## Security
- RLS enabled. Any authenticated user can SELECT (it's public astronomical
  data, not personal). No INSERT/UPDATE/DELETE policy for authenticated —
  only the service-role API route (/api/prayer/times) writes to it.
*/

CREATE TABLE IF NOT EXISTS prayer_time_cache (
  date date PRIMARY KEY,
  fajr time NOT NULL,
  sunrise time,
  dhuhr time NOT NULL,
  asr time NOT NULL,
  maghrib time NOT NULL,
  isha time NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prayer_time_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_prayer_time_cache" ON prayer_time_cache;
CREATE POLICY "select_prayer_time_cache" ON prayer_time_cache FOR SELECT
  TO authenticated USING (true);
