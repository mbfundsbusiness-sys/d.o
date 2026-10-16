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
export const GOALS = { workMin: 60, learningMin: 60, gymMin: 30 } as const;

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
};

export type GoalStreak = {
  current: number;
  longest: number;
  today: DayTotals;
  todayQualifies: boolean;
  /** Qualifying days among the last 30 calendar days (including today). */
  qualifyingLast30: number;
};

export const EMPTY_TOTALS: DayTotals = { wakeLogged: false, workMin: 0, learningMin: 0, gymMin: 0 };

export function dayQualifies(t: DayTotals): boolean {
  return t.wakeLogged && t.workMin >= GOALS.workMin && t.learningMin >= GOALS.learningMin && t.gymMin >= GOALS.gymMin;
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

export function qualifyingDays(days: Map<string, DayTotals>): Set<string> {
  const out = new Set<string>();
  days.forEach((t, date) => {
    if (dayQualifies(t)) out.add(date);
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
  const qualifying = qualifyingDays(totals);
  let last30 = 0;
  for (let i = 0; i < 30; i++) if (qualifying.has(addDaysISO(today, -i))) last30++;
  const todayTotals = totals.get(today) ?? { ...EMPTY_TOTALS };
  return {
    current: dayStreak(qualifying, today),
    longest: longestStreak(qualifying),
    today: todayTotals,
    todayQualifies: dayQualifies(todayTotals),
    qualifyingLast30: last30,
  };
}
