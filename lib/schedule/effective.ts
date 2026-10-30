import type { ScheduleBlock, UserSettings, WorkShift } from '@/lib/supabase/types';
import { minutesOfDay, minutesToHM, fmtHM } from '@/lib/utils/dates';

export type EffectiveBlock = {
  id: string;
  label: string;
  activity_type: ScheduleBlock['activity_type'];
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  startMin: number;
  endMin: number;
  /** true for the derived Friday Jummah block and dated shifts (not weekly-template rows). */
  derived: boolean;
  /** 'shift' for a dated work shift. */
  kind?: 'shift';
  /** Set when this block overlaps a work shift today (the shift wins; the block is shown as clashing). */
  clashesWith?: string;
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
  dayOfWeek: number,
  /** Work shifts that fall on THIS date (callers filter by date). Shifts are fixed and win clashes. */
  shifts: WorkShift[] = [],
  /** Real prayer times for this date; replace the template's fixed prayer times when given. */
  prayerTimes: Partial<Record<string, string>> = {}
): EffectiveBlock[] {
  const merged = effectiveTemplateBlocks(blocks, settings, dayOfWeek)
    .map((b) => {
      const real = b.activity_type === 'prayer' ? prayerTimes[b.label.toLowerCase()] : undefined;
      if (!real) return b;
      const startMin = minutesOfDay(real);
      const endMin = startMin + (b.endMin - b.startMin);
      return { ...b, startMin, endMin, start_time: minutesToHM(startMin), end_time: minutesToHM(endMin) };
    })
    .sort((a, b) => a.startMin - b.startMin);
  if (shifts.length === 0) return moveWakeEarlier(merged, []);

  const shiftBlocks = shifts.map<EffectiveBlock>((sh) => ({
    id: `shift-${sh.id}`,
    label: sh.title,
    activity_type: 'custom',
    start_time: fmtHM(sh.start_time),
    end_time: fmtHM(sh.end_time),
    startMin: minutesOfDay(sh.start_time),
    endMin: minutesOfDay(sh.end_time),
    derived: true,
    kind: 'shift',
  }));

  // Template blocks that overlap a shift are kept (so a lecture on a work day is
  // still visible) but flagged. Prayers are never flagged — they are fixed by the sun.
  const flagged = merged.map((b) => {
    if (b.activity_type === 'prayer' || b.activity_type === 'trading' || isWake(b)) return b; // trading can run during a shift; wake moves before it
    const hit = shiftBlocks.find((sh) => b.startMin < sh.endMin && b.endMin > sh.startMin);
    return hit ? { ...b, clashesWith: hit.label } : b;
  });
  return moveWakeEarlier([...flagged, ...shiftBlocks], shiftBlocks).sort((a, b) => a.startMin - b.startMin);
}

/** Wake this long before the day's first lecture or shift (e.g. 09:30 lecture -> 07:30). */
export const WAKE_LEAD_MIN = 120;
export const SHIFT_WAKE_LEAD_MIN = 60;
const isWake = (b: EffectiveBlock) => /^wake/i.test(b.label);
const isLecture = (b: EffectiveBlock) => /^uni lecture/i.test(b.label);

/**
 * The template wake time (09:00) is only a default. When a lecture or shift starts
 * early, the wake block moves earlier so the schedule never says to wake after the
 * day has already started. It never moves later than the template.
 */
function moveWakeEarlier(blocks: EffectiveBlock[], shiftBlocks: EffectiveBlock[]): EffectiveBlock[] {
  const wake = blocks.find(isWake);
  if (!wake) return blocks;
  // Wake 2h before the first lecture, or 1h before a DPD shift — whichever is earlier.
  const candidates = [
    ...blocks.filter(isLecture).map((b) => b.startMin - WAKE_LEAD_MIN),
    ...shiftBlocks.map((b) => b.startMin - SHIFT_WAKE_LEAD_MIN),
  ];
  if (candidates.length === 0) return blocks;
  const target = Math.max(0, Math.min(...candidates));
  if (target >= wake.startMin) return blocks;
  const dur = wake.endMin - wake.startMin;
  return blocks
    .map((b) =>
      b === wake
        ? { ...b, startMin: target, endMin: target + dur, start_time: minutesToHM(target), end_time: minutesToHM(target + dur) }
        : b
    )
    .sort((a, b) => a.startMin - b.startMin);
}

function effectiveTemplateBlocks(
  blocks: ScheduleBlock[],
  settings: UserSettings | null,
  dayOfWeek: number
): EffectiveBlock[] {
  const dayBlocks = blocks
    .filter((b) => b.day_of_week === dayOfWeek && !b.archived_at)
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
