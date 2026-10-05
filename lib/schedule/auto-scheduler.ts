import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecurringCommitment, ScheduleBlock } from '@/lib/supabase/client';
import { minutesOfDay, minutesToHM } from '@/lib/utils/dates';
import {
  planDay,
  nextDateForWeekday,
  type PrayerLectureFlag,
  type Shortfall,
  type PlannerCommitment,
} from '@/lib/schedule/planner';

export type SchedulerResult = {
  placed: { commitment: RecurringCommitment; startMin: number; endMin: number }[];
  skipped: { commitment: RecurringCommitment; reason: string }[];
  /** Per-day work/learning that did not fit around lectures (visible in the Schedule UI). */
  shortfalls: { dayOfWeek: number; shortfall: Shortfall }[];
  /** Prayers that fall inside a lecture (left untouched; shown as "pray before/after"). */
  prayerFlags: { dayOfWeek: number; flag: PrayerLectureFlag }[];
};

// Prayer is registered as recurring_commitments (for visibility — see
// lib/prayer/schedule-sync.ts) but its blocks are never placed by this
// generic gap-finder: exact externally-calculated times aren't something
// to negotiate against other commitments. It has its own regeneration path
// (syncPrayerSchedule) and is excluded here in both directions — this
// scheduler must never delete prayer's blocks, and must never try to place
// a prayer commitment itself, or the two regenerators fight over the day.
const EXCLUDED_ACTIVITY_TYPES = ['prayer'];

/**
 * Regenerates every 'auto' schedule_blocks row for one day-of-week (except
 * prayer's, see above), from scratch, based on currently-active
 * recurring_commitments that apply to that day. Manual rows
 * (source='manual') are never read, moved, or deleted — they're simply
 * treated as pre-occupied windows the scheduler has to work around.
 */
export async function regenerateAutoBlocksForDay(
  supabase: SupabaseClient,
  userId: string,
  dayOfWeek: number,
  /** Local date the weekly template is evaluated for (effective_from/until). Defaults to the next such weekday. */
  dateISO: string = nextDateForWeekday(dayOfWeek)
): Promise<SchedulerResult> {
  const [existingRes, commitmentsRes] = await Promise.all([
    supabase.from('schedule_blocks').select('*').eq('user_id', userId).eq('day_of_week', dayOfWeek),
    supabase
      .from('recurring_commitments')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('priority', { ascending: false }),
  ]);

  // Archived (soft-deleted) rows are history: not occupied, not regenerated, not deleted.
  const existing = ((existingRes.data ?? []) as ScheduleBlock[]).filter((b) => !b.archived_at);
  const commitments = (commitmentsRes.data ?? []) as RecurringCommitment[];
  const byId = new Map(commitments.map((c) => [c.id, c]));

  const manualBlocks = existing.filter((b) => b.source === 'manual');
  const autoBlockIds = existing
    .filter((b) => b.source === 'auto' && !EXCLUDED_ACTIVITY_TYPES.includes(b.activity_type))
    .map((b) => b.id);

  // Clear this day's auto rows (excluding prayer's) — regenerated fresh
  // below. Manual rows, and prayer's independently-managed rows, untouched.
  if (autoBlockIds.length > 0) {
    await supabase.from('schedule_blocks').delete().in('id', autoBlockIds);
  }

  // Prayer's own auto blocks still occupy real time on the day — the
  // generic scheduler must route around them same as a manual block would.
  const prayerBlocks = existing.filter((b) => b.source === 'auto' && b.activity_type === 'prayer');

  const plan = planDay({
    dayOfWeek,
    dateISO,
    commitments: commitments as PlannerCommitment[],
    manual: manualBlocks.map((b) => ({
      startMin: minutesOfDay(b.start_time),
      endMin: minutesOfDay(b.end_time),
    })),
    prayers: prayerBlocks.map((b) => ({
      label: b.label,
      startMin: minutesOfDay(b.start_time),
      endMin: minutesOfDay(b.end_time),
    })),
  });

  const result: SchedulerResult = {
    placed: plan.placed.map((p) => ({
      commitment: byId.get(p.commitment.id) as RecurringCommitment,
      startMin: p.startMin,
      endMin: p.endMin,
    })),
    skipped: plan.skipped.map((s) => ({ commitment: byId.get(s.commitment.id) as RecurringCommitment, reason: s.reason })),
    shortfalls: plan.shortfalls.map((shortfall) => ({ dayOfWeek, shortfall })),
    prayerFlags: plan.prayerFlags.map((flag) => ({ dayOfWeek, flag })),
  };

  const inserts = plan.placed.map((p) => ({
    user_id: userId,
    day_of_week: dayOfWeek,
    activity_type: p.commitment.activity_type,
    start_time: minutesToHM(p.startMin),
    end_time: minutesToHM(p.endMin),
    label: p.label,
    source: 'auto',
    commitment_id: p.commitment.id,
  }));

  if (inserts.length > 0) {
    await supabase.from('schedule_blocks').insert(inserts);
  }

  return result;
}

/** Regenerates several days at once (e.g. every day a commitment applies to, after it changes). */
export async function regenerateAutoBlocksForDays(
  supabase: SupabaseClient,
  userId: string,
  daysOfWeek: number[]
): Promise<SchedulerResult> {
  const unique = Array.from(new Set(daysOfWeek));
  const results = await Promise.all(unique.map((d) => regenerateAutoBlocksForDay(supabase, userId, d)));
  return {
    placed: results.flatMap((r) => r.placed),
    skipped: results.flatMap((r) => r.skipped),
    shortfalls: results.flatMap((r) => r.shortfalls),
    prayerFlags: results.flatMap((r) => r.prayerFlags),
  };
}
