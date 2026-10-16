import { supabase, type WorkShift } from '@/lib/supabase/client';
import { addDaysISO, todayISO } from '@/lib/utils/dates';

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

/** Shifts from `fromISO` to `toISO` inclusive. Returns [] (never throws) so callers degrade gracefully. */
export async function fetchShifts(fromISO: string, toISO: string): Promise<WorkShift[]> {
  const { data, error } = await supabase
    .from('work_shifts')
    .select('*')
    .gte('shift_date', fromISO)
    .lte('shift_date', toISO)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) return [];
  return (data ?? []) as WorkShift[];
}

/** Today's and the next `daysAhead` days of shifts. */
export function fetchUpcomingShifts(daysAhead = 14): Promise<WorkShift[]> {
  const today = todayISO();
  return fetchShifts(today, addDaysISO(today, daysAhead));
}

/** Validates a start/end pair typed as "HH:MM". Returns an error message or null. */
export function validateShiftTimes(start: string, end: string): string | null {
  const re = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!re.test(start) || !re.test(end)) return 'Use 24-hour times like 07:30';
  if (end <= start) return 'End must be after start (shifts cannot cross midnight)';
  return null;
}
