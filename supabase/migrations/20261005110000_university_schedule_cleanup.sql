/*
# University schedule cleanup — soft-delete overlapping work/learning blocks

APPLY ONLY AFTER reviewing supabase/dry-runs/20261005_uni_overlap_report.sql (report A lists exactly these rows).

Archives (archived_at + archived_reason; nothing is deleted) every persisted
schedule_blocks row that is a work or learning block (activity_type trading /
botcouncil / course / language / reading) and overlaps an active lecture on the same weekday.

Never touched: gym, prayer, and the 20:00 Daily Logging Reminder (activity_type custom).
Recurring commitments themselves are NOT deactivated — Tue/Wed/Fri/Sat/Sun keep the full
3h work / 1.5h learning blocks. On lecture days the generator flexes them into the free
windows (lib/schedule/planner.ts); press "Regenerate week" on the Schedule page after this.

Idempotent: re-running archives nothing new (archived rows are skipped).
Revert: see bottom.
*/

UPDATE schedule_blocks b
SET archived_at = now(),
    archived_reason = 'uni-schedule-cleanup-20261005'
FROM recurring_commitments l
WHERE l.user_id = b.user_id
  AND l.category = 'university' AND l.active
  AND b.day_of_week = ANY (l.applies_days)
  AND (l.effective_until IS NULL OR l.effective_until >= (now() AT TIME ZONE 'Europe/London')::date)
  AND b.archived_at IS NULL
  AND b.activity_type IN ('trading', 'botcouncil', 'course', 'language', 'reading')
  AND b.start_time < (l.preferred_start_time + make_interval(mins => l.target_duration_min))::time
  AND b.end_time   > l.preferred_start_time;

/*
-- REVERT (restores exactly the rows archived above) --------------------------
UPDATE schedule_blocks
SET archived_at = NULL, archived_reason = NULL
WHERE archived_reason = 'uni-schedule-cleanup-20261005';
*/
