import type { WorkShift } from '@/lib/supabase/types';
import { addDaysISO } from '@/lib/utils/dates';

export const DEFAULT_SHIFT_TITLE = 'DPD Hounslow West TW3 TW4';

/** Shifts whose date is `dateISO`, earliest first. */
export function shiftsOn(shifts: WorkShift[], dateISO: string): WorkShift[] {
  return shifts
    .filter((s) => s.shift_date === dateISO)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/** Monday (YYYY-MM-DD) of the week containing `dateISO`. */
export function mondayOf(dateISO: string): string {
  const dow = new Date(dateISO + 'T00:00:00Z').getUTCDay(); // 0 = Sun
  return addDaysISO(dateISO, -((dow + 6) % 7));
}

/** The seven dates Mon..Sun starting at `mondayISO`. */
export function weekDates(mondayISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(mondayISO, i));
}

/** Validates a start/end pair typed as "HH:MM". Returns an error message or null. */
export function validateShiftTimes(start: string, end: string): string | null {
  const re = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!re.test(start) || !re.test(end)) return 'Use 24-hour times like 07:30';
  if (end <= start) return 'End must be after start (shifts cannot cross midnight)';
  return null;
}
