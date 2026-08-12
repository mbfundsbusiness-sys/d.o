/**
 * Count working days (Mon–Fri, excluding UK bank holidays) between two dates.
 * Returns the number of working days from `from` to `to`, inclusive of `from`,
 * exclusive of `to` — i.e. if from === to, returns 0.
 */
export function workingDaysBetween(from: Date, to: Date): number {
  if (from >= to) return 0;

  // Simplified UK bank holiday list (fixed-date ones are easy; the rest are
  // approximated by their known dates for the next few years).
  const bankHolidays = getUKBankHolidays(from.getFullYear(), to.getFullYear());

  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  while (cursor < to) {
    const day = cursor.getDay();
    const dateStr = cursor.toISOString().slice(0, 10);
    const isWeekend = day === 0 || day === 6;
    const isHoliday = bankHolidays.has(dateStr);
    if (!isWeekend && !isHoliday) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function getUKBankHolidays(
  startYear: number,
  endYear: number
): Set<string> {
  const holidays = new Set<string>();
  for (let year = startYear; year <= endYear; year++) {
    // New Year's Day (or next working day)
    holidays.add(formatHoliday(year, 1, 1));
    // Good Friday & Easter Monday — approximated with known dates
    const easter = computeEaster(year);
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    holidays.add(goodFriday.toISOString().slice(0, 10));
    holidays.add(easterMonday.toISOString().slice(0, 10));
    // Early May Bank Holiday (first Monday of May)
    holidays.add(firstMondayOfMonth(year, 4));
    // Spring Bank Holiday (last Monday of May)
    holidays.add(lastMondayOfMonth(year, 4));
    // Summer Bank Holiday (last Monday of August)
    holidays.add(lastMondayOfMonth(year, 7));
    // Christmas Day
    holidays.add(formatHoliday(year, 12, 25));
    // Boxing Day
    holidays.add(formatHoliday(year, 12, 26));
  }
  return holidays;
}

function formatHoliday(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function firstMondayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 1));
  while (d.getDay() !== 1) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function lastMondayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  while (d.getDay() !== 1) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

// Gauss's algorithm for Easter (Western)
function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateUK(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
