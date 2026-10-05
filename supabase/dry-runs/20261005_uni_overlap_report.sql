-- DRY RUN — read-only. Run in the Supabase SQL Editor AFTER 20261005100000_university_schedule.sql
-- and BEFORE 20261005110000_university_schedule_cleanup.sql. Changes nothing.
-- Paste the output back to review, then apply the cleanup.

-- A) Persisted schedule_blocks that the cleanup would archive:
--    work/learning blocks (trading, botcouncil, course, language, reading) overlapping an active lecture.
--    Gym, prayer and the 20:00 reminder (custom) are excluded by construction.
SELECT
  b.id                                       AS block_id,
  b.label                                    AS block_title,
  b.source,
  (ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[b.day_of_week + 1] AS day,
  b.activity_type,
  b.start_time || '–' || b.end_time          AS block_time,
  l.label                                    AS overlapping_lecture,
  l.preferred_start_time || '–' || (l.preferred_start_time + make_interval(mins => l.target_duration_min))::time AS lecture_time,
  greatest(b.start_time, l.preferred_start_time) || '–' ||
    least(b.end_time, (l.preferred_start_time + make_interval(mins => l.target_duration_min))::time) AS overlap
FROM schedule_blocks b
JOIN recurring_commitments l
  ON l.user_id = b.user_id
 AND l.category = 'university' AND l.active
 AND b.day_of_week = ANY (l.applies_days)
 AND (l.effective_until IS NULL OR l.effective_until >= (now() AT TIME ZONE 'Europe/London')::date)
WHERE b.archived_at IS NULL
  AND b.activity_type IN ('trading', 'botcouncil', 'course', 'language', 'reading')
  AND b.start_time < (l.preferred_start_time + make_interval(mins => l.target_duration_min))::time
  AND b.end_time   > l.preferred_start_time
ORDER BY b.day_of_week, b.start_time;

-- B) Same check at template level: which recurring work/learning commitments
--    pin a time that collides with a lecture (these are the ones the generator will now flex on those days).
SELECT
  c.id AS commitment_id, c.label AS commitment_title, c.category,
  (ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[d + 1] AS day,
  c.preferred_start_time || '–' || (c.preferred_start_time + make_interval(mins => c.target_duration_min))::time AS commitment_time,
  l.label AS overlapping_lecture,
  greatest(c.preferred_start_time, l.preferred_start_time) || '–' ||
    least((c.preferred_start_time + make_interval(mins => c.target_duration_min))::time,
          (l.preferred_start_time + make_interval(mins => l.target_duration_min))::time) AS overlap
FROM recurring_commitments c
JOIN recurring_commitments l ON l.user_id = c.user_id AND l.category = 'university' AND l.active
CROSS JOIN LATERAL unnest(c.applies_days) AS d
WHERE c.active AND c.category IN ('work', 'learning') AND c.preferred_start_time IS NOT NULL
  AND d = ANY (l.applies_days)
  AND c.preferred_start_time < (l.preferred_start_time + make_interval(mins => l.target_duration_min))::time
  AND (c.preferred_start_time + make_interval(mins => c.target_duration_min))::time > l.preferred_start_time
ORDER BY d, c.preferred_start_time;

-- C) Sanity: things the cleanup must NOT touch, and what is currently on Mon/Thu.
SELECT (ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[day_of_week + 1] AS day, activity_type, label, start_time, end_time, source
FROM schedule_blocks WHERE archived_at IS NULL AND day_of_week IN (1, 4) ORDER BY day_of_week, start_time;

-- D) The Thursday gym move relies on the Gym commitment having preferred_start_time = 16:00.
--    If this shows NULL, set it:  UPDATE recurring_commitments SET preferred_start_time = '16:00' WHERE activity_type = 'gym';
SELECT id, label, applies_days, preferred_start_time, target_duration_min FROM recurring_commitments WHERE activity_type = 'gym';
