import type { ScheduleBlock, UserSettings } from '@/lib/supabase/client';
import { minutesOfDay, minutesToHM, fmtHM } from '@/lib/utils/dates';

export type EffectiveBlock = {
  id: string;
  label: string;
  activity_type: ScheduleBlock['activity_type'];
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  startMin: number;
  endMin: number;
  /** true for the derived Friday Jummah block (not a real row). */
  derived: boolean;
};

const FRIDAY = 5;
// The "normal midday slot" the Jummah block replaces on Fridays.
const MIDDAY_WINDOW_START = 12 * 60 + 30; // 12:30
const MIDDAY_WINDOW_END = 13 * 60 + 30; // 13:30

function overlapsMidday(startMin: number, endMin: number): boolean {
  return startMin < MIDDAY_WINDOW_END && endMin > MIDDAY_WINDOW_START;
}

/**
 * Blocks for a given day-of-week, sorted by start time, with the Friday rule
 * applied: when it's Friday and a Jummah time is set, any block overlapping the
 * midday slot (~12:30–13:30) is removed and a derived Jummah block is spliced in.
 */
export function effectiveBlocksForDay(
  blocks: ScheduleBlock[],
  settings: UserSettings | null,
  dayOfWeek: number
): EffectiveBlock[] {
  const dayBlocks = blocks
    .filter((b) => b.day_of_week === dayOfWeek)
    .map<EffectiveBlock>((b) => ({
      id: b.id,
      label: b.label,
      activity_type: b.activity_type,
      start_time: fmtHM(b.start_time),
      end_time: fmtHM(b.end_time),
      startMin: minutesOfDay(b.start_time),
      endMin: minutesOfDay(b.end_time),
      derived: false,
    }));

  const jummah = settings?.jummah_time ?? null;

  if (dayOfWeek === FRIDAY && jummah) {
    const startMin = minutesOfDay(jummah);
    const durationMin = settings?.jummah_duration_min ?? 60;
    const endMin = startMin + durationMin;
    const kept = dayBlocks.filter((b) => !overlapsMidday(b.startMin, b.endMin));
    kept.push({
      id: 'jummah',
      label: 'Jummah',
      activity_type: 'custom',
      start_time: minutesToHM(startMin),
      end_time: minutesToHM(endMin),
      startMin,
      endMin,
      derived: true,
    });
    return kept.sort((a, b) => a.startMin - b.startMin);
  }

  return dayBlocks.sort((a, b) => a.startMin - b.startMin);
}

/** Whether it's Friday and the user still needs to set a Jummah time. */
export function needsJummahTime(
  settings: UserSettings | null,
  dayOfWeek: number
): boolean {
  return dayOfWeek === FRIDAY && !settings?.jummah_time;
}
