import { addDaysISO, dayStreak, londonDateISO, todayISO } from '@/lib/utils/dates';

/**
 * The daily-goal streak. A day counts when ALL of these happened (London date):
 *   - wake time logged
 *   - >= 60 min of BotCouncil work (timer sessions; NOT university, NOT the DPD job)
 *   - >= 60 min of learning (language + course + reading timer sessions; NOT university)
 *   - >= 30 min of gym
 * Trading is deliberately not part of it (markets are Mon–Fri only).
 *
 * Pure module: no database access, so it is unit-testable. Fetching lives in
 * lib/streaks/use-goal-streak.ts.
 */
export type Goals = { workMin: number; learningMin: number; gymMin: number };
export const GOALS: Goals = { workMin: 60, learningMin: 60, gymMin: 30 };
/** Work shift (DPD) day: reduced minimum so the streak survives long shifts. */
export const SHIFT_DAY_GOALS: Goals = { workMin: 30, learningMin: 30, gymMin: 20 };
/** Lecture day: lectures themselves are study, so the flexible targets are lighter. */
export const LECTURE_DAY_GOALS: Goals = { workMin: 45, learningMin: 30, gymMin: 30 };

/** Which goals apply on a date. A shift wins over a lecture. */
export function goalsFor(date: string, ctx: { shiftDates?: ReadonlySet<string>; lectureDows?: ReadonlySet<number> } = {}): Goals {
  if (ctx.shiftDates?.has(date)) return SHIFT_DAY_GOALS;
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (ctx.lectureDows?.has(dow)) return LECTURE_DAY_GOALS;
  return GOALS;
}

export type SessionRow = { started_at: string; duration_min: number | null };
export type AnchorRow = { log_date: string; wake_time: string | null };

export type DayTotals = {
  wakeLogged: boolean;
  workMin: number;
  learningMin: number;
  gymMin: number;
};

export type GoalInputs = {
  anchorLogs: AnchorRow[];
  botcouncil: SessionRow[];
  learning: SessionRow[];
  gym: SessionRow[];
  /** YYYY-MM-DD dates that have a work shift. */
  shiftDates?: string[];
  /** Days of week (0=Sun) that have a university lecture. */
  lectureDows?: number[];
};

export type GoalStreak = {
  current: number;
  longest: number;
  today: DayTotals;
  todayQualifies: boolean;
  /** Targets in force today (reduced on shift / lecture days). */
  todayGoals: Goals;
  /** Qualifying days among the last 30 calendar days (including today). */
  qualifyingLast30: number;
};

export const EMPTY_TOTALS: DayTotals = { wakeLogged: false, workMin: 0, learningMin: 0, gymMin: 0 };

export function dayQualifies(t: DayTotals, g: Goals = GOALS): boolean {
  return t.wakeLogged && t.workMin >= g.workMin && t.learningMin >= g.learningMin && t.gymMin >= g.gymMin;
}

export function buildDayTotals(input: GoalInputs): Map<string, DayTotals> {
  const days = new Map<string, DayTotals>();
  const at = (date: string): DayTotals => {
    let t = days.get(date);
    if (!t) {
      t = { ...EMPTY_TOTALS };
      days.set(date, t);
    }
    return t;
  };
  for (const l of input.anchorLogs) {
    if (l.wake_time) at(l.log_date).wakeLogged = true;
  }
  const add = (rows: SessionRow[], key: 'workMin' | 'learningMin' | 'gymMin') => {
    for (const r of rows) {
      const mins = Number(r.duration_min ?? 0);
      if (mins > 0) at(londonDateISO(r.started_at))[key] += mins;
    }
  };
  add(input.botcouncil, 'workMin');
  add(input.learning, 'learningMin');
  add(input.gym, 'gymMin');
  return days;
}

export function qualifyingDays(
  days: Map<string, DayTotals>,
  ctx: { shiftDates?: ReadonlySet<string>; lectureDows?: ReadonlySet<number> } = {}
): Set<string> {
  const out = new Set<string>();
  days.forEach((t, date) => {
    if (dayQualifies(t, goalsFor(date, ctx))) out.add(date);
  });
  return out;
}

export function longestStreak(days: ReadonlySet<string>): number {
  const sorted = Array.from(days).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && addDaysISO(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return longest;
}

export function summariseGoals(input: GoalInputs, today: string = todayISO()): GoalStreak {
  const totals = buildDayTotals(input);
  const ctx = { shiftDates: new Set(input.shiftDates ?? []), lectureDows: new Set(input.lectureDows ?? []) };
  const qualifying = qualifyingDays(totals, ctx);
  // Sundays are rest days: they never break (or need to earn) the streak.
  for (let i = 0; i < 400; i++) {
    const d = addDaysISO(today, -i);
    const [y, m, dd] = d.split('-').map(Number);
    if (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() === 0) qualifying.add(d);
  }
  const todayGoals = goalsFor(today, ctx);
  let last30 = 0;
  for (let i = 0; i < 30; i++) if (qualifying.has(addDaysISO(today, -i))) last30++;
  const todayTotals = totals.get(today) ?? { ...EMPTY_TOTALS };
  return {
    current: dayStreak(qualifying, today),
    longest: longestStreak(qualifying),
    today: todayTotals,
    todayQualifies: qualifying.has(today),
    todayGoals,
    qualifyingLast30: last30,
  };
}
