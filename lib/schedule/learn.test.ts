import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '@/lib/rules';
import { describePatterns, learnPatterns, type HistoryRow } from '@/lib/schedule/learn';
import { placeDemands } from '@/lib/schedule/planner';
import { computeLedger } from '@/lib/rewards/ledger';

const row = (plan_date: string, start: string, end: string, kind: HistoryRow['kind'], status: HistoryRow['status']): HistoryRow => ({
  plan_date, start_time: start, end_time: end, kind, status,
});
const TODAY = '2026-10-30';

// Gym: three evenings done, four mornings missed.
const gymHistory = [
  row('2026-10-20', '07:00', '07:45', 'gym', 'skipped'),
  row('2026-10-21', '07:00', '07:45', 'gym', 'planned'),
  row('2026-10-22', '07:30', '08:15', 'gym', 'skipped'),
  row('2026-10-23', '08:00', '08:45', 'gym', 'skipped'),
  row('2026-10-24', '19:00', '19:45', 'gym', 'done'),
  row('2026-10-25', '18:30', '19:15', 'gym', 'done'),
  row('2026-10-26', '19:30', '20:15', 'gym', 'done'),
];

describe('learning from completions', () => {
  it('prefers the window an activity gets done in and avoids the one it gets missed in', () => {
    const p = learnPatterns(gymHistory, new Set(), TODAY, 600);
    expect(p.prefer.gym).toEqual({ start: 18 * 60, end: 21 * 60 });
    expect(p.avoid.gym).toEqual({ start: 6 * 60, end: 9 * 60 });
    expect(p.byKind.gym).toEqual({ done: 3, total: 7 });
    expect(describePatterns(p)).toContain('gym goes best 18:00-21:00');
  });

  it('learns nothing from too little history, and never learns trading', () => {
    expect(learnPatterns(gymHistory.slice(0, 4), new Set(), TODAY, 600).prefer).toEqual({});
    const trading = gymHistory.map((r) => ({ ...r, kind: 'trading' as const }));
    expect(learnPatterns(trading, new Set(), TODAY, 600).prefer).toEqual({});
  });

  it("doesn't count blocks still ahead today", () => {
    const p = learnPatterns([row(TODAY, '19:00', '20:00', 'gym', 'planned')], new Set(), TODAY, 600);
    expect(p.byKind.gym).toBeUndefined();
  });

  it('compares shift days with other days', () => {
    const p = learnPatterns(gymHistory, new Set(['2026-10-20', '2026-10-21']), TODAY, 600);
    expect(p.shiftDays).toEqual({ done: 0, total: 2 });
    expect(p.otherDays).toEqual({ done: 3, total: 5 });
  });

  it('the planner uses what it learned', () => {
    const gaps = [{ start: 7 * 60, end: 22 * 60 }];
    const demand = [{ title: 'Gym', kind: 'gym' as const, minutes: 45, priority: 'gym' as const }];
    expect(placeDemands(demand, gaps, 10).items[0].start).toBe('07:00');
    const learned = learnPatterns(gymHistory, new Set(), TODAY, 600);
    expect(placeDemands(demand, gaps, 10, learned).items[0].start).toBe('18:00');
    // With only an avoid window, it goes in the earliest time clear of it.
    expect(placeDemands(demand, gaps, 10, { prefer: {}, avoid: learned.avoid }).items[0].start).toBe('09:00');
  });
});

describe('earned free time', () => {
  const rules = DEFAULT_RULES; // 20 min per hour done, 10 lost per hour missed, streak at 80%
  it('earns for done work, loses for missed work, and subtracts what was spent', () => {
    const rows = [
      row('2026-10-28', '10:00', '13:00', 'study', 'done'), // 3h -> 60
      row('2026-10-28', '14:00', '16:00', 'trading', 'skipped'), // 2h missed -> -20
      row('2026-10-29', '10:00', '11:30', 'botcouncil', 'done'), // 1.5h -> 30
      row('2026-10-29', '12:00', '13:00', 'gym', 'dropped'), // ignored
    ];
    const l = computeLedger(rows, [{ cost_min: 30 }], rules, TODAY, 600);
    expect(l.earnedMin).toBe(90);
    expect(l.penaltyMin).toBe(20);
    expect(l.spentMin).toBe(30);
    expect(l.balanceMin).toBe(40);
  });

  it('counts the streak back from yesterday, skipping days with no plan, and adds today once it qualifies', () => {
    const rows = [
      row('2026-10-25', '10:00', '11:00', 'study', 'skipped'), // breaks
      row('2026-10-26', '10:00', '11:00', 'study', 'done'),
      // 27th: nothing planned
      row('2026-10-28', '10:00', '11:00', 'study', 'done'),
      row('2026-10-29', '10:00', '11:00', 'study', 'done'),
      row(TODAY, '08:00', '09:00', 'study', 'done'),
      row(TODAY, '18:00', '19:00', 'gym', 'planned'),
    ];
    const l = computeLedger(rows, [], rules, TODAY, 600);
    expect(l.streak).toBe(3);
    expect(l.todayPct).toBe(50);
    expect(computeLedger(rows.slice(0, 5), [], rules, TODAY, 600).streak).toBe(4);
  });

  it("future blocks today don't cost anything yet", () => {
    const l = computeLedger([row(TODAY, '18:00', '19:00', 'gym', 'planned')], [], rules, TODAY, 600);
    expect(l.penaltyMin).toBe(0);
  });
});
