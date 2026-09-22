import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecurringCommitment, ScheduleBlock } from '@/lib/supabase/client';
import { minutesOfDay, minutesToHM } from '@/lib/utils/dates';

// The window the scheduler will place blocks within on any given day.
const DAY_WINDOW_START = 6 * 60; // 06:00
const DAY_WINDOW_END = 23 * 60; // 23:00
const GAP_STEP_MIN = 5; // granularity when scanning for an open gap

type Window = { startMin: number; endMin: number };

function overlaps(a: Window, b: Window): boolean {
  return a.startMin < b.endMin && a.endMin > b.startMin;
}

function findOpenSlot(durationMin: number, occupied: Window[]): Window | null {
  const sorted = [...occupied].sort((a, b) => a.startMin - b.startMin);
  for (let start = DAY_WINDOW_START; start + durationMin <= DAY_WINDOW_END; start += GAP_STEP_MIN) {
    const candidate: Window = { startMin: start, endMin: start + durationMin };
    if (!sorted.some((w) => overlaps(candidate, w))) return candidate;
  }
  return null;
}

export type SchedulerResult = {
  placed: { commitment: RecurringCommitment; startMin: number; endMin: number }[];
  skipped: { commitment: RecurringCommitment; reason: string }[];
};

/**
 * Regenerates every 'auto' schedule_blocks row for one day-of-week, from
 * scratch, based on currently-active recurring_commitments that apply to
 * that day. Manual rows (source='manual') are never read, moved, or
 * deleted — they're simply treated as pre-occupied windows the scheduler
 * has to work around.
 */
export async function regenerateAutoBlocksForDay(
  supabase: SupabaseClient,
  userId: string,
  dayOfWeek: number
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

  const existing = (existingRes.data ?? []) as ScheduleBlock[];
  const allCommitments = (commitmentsRes.data ?? []) as RecurringCommitment[];
  const commitments = allCommitments.filter((c) => (c.applies_days ?? []).includes(dayOfWeek));

  const manualBlocks = existing.filter((b) => b.source === 'manual');
  const autoBlockIds = existing.filter((b) => b.source === 'auto').map((b) => b.id);

  // Clear this day's auto rows — regenerated fresh below. Manual rows untouched.
  if (autoBlockIds.length > 0) {
    await supabase.from('schedule_blocks').delete().in('id', autoBlockIds);
  }

  const occupied: Window[] = manualBlocks.map((b) => ({
    startMin: minutesOfDay(b.start_time),
    endMin: minutesOfDay(b.end_time),
  }));

  const result: SchedulerResult = { placed: [], skipped: [] };
  const inserts: Record<string, unknown>[] = [];

  for (const commitment of commitments) {
    let slot: Window | null = null;

    if (commitment.preferred_start_time) {
      const startMin = minutesOfDay(commitment.preferred_start_time);
      const candidate: Window = { startMin, endMin: startMin + commitment.target_duration_min };
      if (!occupied.some((w) => overlaps(candidate, w)) && candidate.endMin <= DAY_WINDOW_END) {
        slot = candidate;
      }
    }

    if (!slot) {
      slot = findOpenSlot(commitment.target_duration_min, occupied);
    }

    if (!slot) {
      result.skipped.push({ commitment, reason: 'No open slot long enough today' });
      continue;
    }

    occupied.push(slot);
    result.placed.push({ commitment, startMin: slot.startMin, endMin: slot.endMin });
    inserts.push({
      user_id: userId,
      day_of_week: dayOfWeek,
      activity_type: commitment.activity_type,
      start_time: minutesToHM(slot.startMin),
      end_time: minutesToHM(slot.endMin),
      label: commitment.label,
      source: 'auto',
      commitment_id: commitment.id,
    });
  }

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
  };
}
