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
  // Walk calendar dates as strings (London) — toISOString() on a local-midnight
  // Date shifts back a day in BST and made bank holidays miss their match.
  let cursor = londonDateISO(from);
  const end = londonDateISO(to);

  while (cursor < end) {
    const day = new Date(cursor + 'T00:00:00Z').getUTCDay();
    const isWeekend = day === 0 || day === 6;
    const isHoliday = bankHolidays.has(cursor);
    if (!isWeekend && !isHoliday) {
      count++;
    }
    cursor = addDaysISO(cursor, 1);
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
    goodFriday.setUTCDate(easter.getUTCDate() - 2);
    const easterMonday = new Date(easter);
    easterMonday.setUTCDate(easter.getUTCDate() + 1);
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
  while (d.getUTCDay() !== 1) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function lastMondayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  while (d.getUTCDay() !== 1) {
    d.setUTCDate(d.getUTCDate() - 1);
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

/** Today's calendar date in Europe/London (YYYY-MM-DD) — not the UTC date, which is wrong 00:00–01:00 in summer. */
export function todayISO(): string {
  return londonNow().dateISO;
}

/** Europe/London calendar date (YYYY-MM-DD) of an instant (Date, ISO timestamp or epoch ms). */
export function londonDateISO(d: Date | string | number = new Date()): string {
  return londonNow(new Date(d)).dateISO;
}

/** Pure calendar arithmetic on a YYYY-MM-DD string (no timezone/DST involvement). */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/**
 * Consecutive-day streak over a set of YYYY-MM-DD dates. Active if `today` is
 * in the set, or (so an unfinished today doesn't zero it) if yesterday is.
 */
export function dayStreak(days: ReadonlySet<string>, today: string = todayISO()): number {
  let cursor = days.has(today) ? today : addDaysISO(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDaysISO(cursor, -1);
  }
  return n;
}

// --- Europe/London wall-clock helpers ---
// These are the single source of truth for "what day/time is it in London",
// independent of the device timezone.

const LONDON_TZ = 'Europe/London';

export type LondonNow = {
  /** ISO date string YYYY-MM-DD in London */
  dateISO: string;
  /** 0 = Sunday ... 6 = Saturday, in London */
  dayOfWeek: number;
  hour: number;
  minute: number;
  /** minutes since midnight London time */
  minutesOfDay: number;
};

export function londonNow(d: Date = new Date()): LondonNow {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0; // some environments emit "24" for midnight
  const minute = parseInt(get('minute'), 10);

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = weekdayMap[get('weekday')] ?? 0;

  return {
    dateISO: `${year}-${month}-${day}`,
    dayOfWeek,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
  };
}

/** "13:30" | "13:30:00" -> 810 (minutes since midnight). */
export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}

/** Trim a postgres `time` value ("13:30:00") to "13:30". */
export function fmtHM(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return `${(h ?? '00').padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`;
}

/** minutes since midnight -> "13:30". */
export function minutesToHM(mins: number): string {
  const clamped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
