import type { Rules } from '@/lib/rules';
import { resolvedRows, type HistoryRow } from '@/lib/schedule/learn';
import { addDaysISO, minutesOfDay } from '@/lib/utils/dates';

// Free time is earned. Every planned block that gets done adds free-time
// minutes; every one that's missed takes some away; rewards are bought with
// the balance. The streak counts days where most of the plan got done.

export type Ledger = {
  earnedMin: number;
  penaltyMin: number;
  spentMin: number;
  balanceMin: number;
  todayEarnedMin: number;
  /** Share of today's plan done so far (null when nothing is planned). */
  todayPct: number | null;
  /** Days in a row (ending yesterday, or today once it qualifies) at or above rules.rewards.streak_pct. */
  streak: number;
};

const len = (r: HistoryRow) => minutesOfDay(r.end_time) - minutesOfDay(r.start_time);

export function computeLedger(rows: HistoryRow[], spent: { cost_min: number }[], rules: Rules, today: string, nowMin: number): Ledger {
  const { earn_per_hour, miss_penalty_per_hour, streak_pct } = rules.rewards;
  const live = rows.filter((r) => r.status !== 'dropped' && r.plan_date <= today);
  const resolved = resolvedRows(live, today, nowMin);
  const doneMin = (rs: HistoryRow[]) => rs.filter((r) => r.status === 'done').reduce((t, r) => t + len(r), 0);
  const missedMin = resolved.filter((r) => r.status !== 'done').reduce((t, r) => t + len(r), 0);

  const earnedMin = Math.round((doneMin(live) * earn_per_hour) / 60);
  const penaltyMin = Math.round((missedMin * miss_penalty_per_hour) / 60);
  const spentMin = spent.reduce((t, s) => t + s.cost_min, 0);

  const byDay = new Map<string, HistoryRow[]>();
  for (const r of live) byDay.set(r.plan_date, [...(byDay.get(r.plan_date) ?? []), r]);
  const dayPct = (d: string) => {
    const rs = byDay.get(d);
    return rs && rs.length ? (rs.filter((r) => r.status === 'done').length / rs.length) * 100 : null;
  };

  // Days with nothing planned neither extend nor break the streak.
  let streak = 0;
  const oldest = [...byDay.keys()].sort()[0] ?? today;
  for (let d = addDaysISO(today, -1); d >= oldest; d = addDaysISO(d, -1)) {
    const p = dayPct(d);
    if (p === null) continue;
    if (p < streak_pct) break;
    streak++;
  }
  const todayPct = dayPct(today);
  if (todayPct !== null && todayPct >= streak_pct) streak++;

  return {
    earnedMin,
    penaltyMin,
    spentMin,
    balanceMin: earnedMin - penaltyMin - spentMin,
    todayEarnedMin: Math.round((doneMin(byDay.get(today) ?? []) * earn_per_hour) / 60),
    todayPct: todayPct === null ? null : Math.round(todayPct),
    streak,
  };
}

export const fmtMin = (m: number) => {
  const sign = m < 0 ? '-' : '';
  const a = Math.abs(m);
  return a >= 60 ? `${sign}${Math.floor(a / 60)}h${a % 60 ? ` ${a % 60}m` : ''}` : `${sign}${a}m`;
};

export function describeLedger(l: Ledger): string {
  return `Free time: ${fmtMin(l.balanceMin)} banked (earned ${fmtMin(l.earnedMin)}, lost ${fmtMin(l.penaltyMin)} to missed blocks, spent ${fmtMin(l.spentMin)}). Today: ${fmtMin(l.todayEarnedMin)} earned, ${l.todayPct ?? 0}% of plan done. Streak: ${l.streak} day${l.streak === 1 ? '' : 's'}.`;
}
