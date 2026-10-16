import { describe, it, expect } from 'vitest';
import { GOALS, dayQualifies, longestStreak, summariseGoals, type GoalInputs } from './streaks';

const sess = (iso: string, min: number) => ({ started_at: iso, duration_min: min });
const empty: GoalInputs = { anchorLogs: [], botcouncil: [], learning: [], gym: [] };

// A complete day on `date` (London date), sessions placed at midday.
function fullDay(date: string): GoalInputs {
  return {
    anchorLogs: [{ log_date: date, wake_time: '07:00' }],
    botcouncil: [sess(`${date}T12:00:00Z`, GOALS.workMin)],
    learning: [sess(`${date}T13:00:00Z`, GOALS.learningMin)],
    gym: [sess(`${date}T16:00:00Z`, GOALS.gymMin)],
  };
}
const merge = (...xs: GoalInputs[]): GoalInputs => ({
  anchorLogs: xs.flatMap((x) => x.anchorLogs),
  botcouncil: xs.flatMap((x) => x.botcouncil),
  learning: xs.flatMap((x) => x.learning),
  gym: xs.flatMap((x) => x.gym),
});

describe('goal streak rule', () => {
  it('needs wake time + 60m BotCouncil + 60m learning + 30m gym', () => {
    expect(dayQualifies({ wakeLogged: true, workMin: 60, learningMin: 60, gymMin: 30 })).toBe(true);
    expect(dayQualifies({ wakeLogged: false, workMin: 60, learningMin: 60, gymMin: 30 })).toBe(false);
    expect(dayQualifies({ wakeLogged: true, workMin: 59, learningMin: 60, gymMin: 30 })).toBe(false);
    expect(dayQualifies({ wakeLogged: true, workMin: 60, learningMin: 59, gymMin: 30 })).toBe(false);
    expect(dayQualifies({ wakeLogged: true, workMin: 60, learningMin: 60, gymMin: 29 })).toBe(false);
  });

  it('adds up several sessions in a day', () => {
    const input: GoalInputs = {
      ...fullDay('2026-10-16'),
      botcouncil: [sess('2026-10-16T09:00:00Z', 30), sess('2026-10-16T14:00:00Z', 30)],
    };
    expect(summariseGoals(input, '2026-10-16').todayQualifies).toBe(true);
  });

  it('counts consecutive qualifying days, including today', () => {
    const input = merge(fullDay('2026-10-14'), fullDay('2026-10-15'), fullDay('2026-10-16'));
    const r = summariseGoals(input, '2026-10-16');
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
    expect(r.qualifyingLast30).toBe(3);
  });

  it("keeps yesterday's streak alive while today is unfinished", () => {
    const r = summariseGoals(merge(fullDay('2026-10-14'), fullDay('2026-10-15')), '2026-10-16');
    expect(r.current).toBe(2);
    expect(r.todayQualifies).toBe(false);
  });

  it('a missed day breaks the streak but keeps the longest', () => {
    const input = merge(fullDay('2026-10-10'), fullDay('2026-10-11'), fullDay('2026-10-12'), fullDay('2026-10-15'));
    const r = summariseGoals(input, '2026-10-16');
    expect(r.current).toBe(1);
    expect(r.longest).toBe(3);
  });

  it('files a 00:30 BST session on the London date, not the UTC date', () => {
    // 2026-10-15T23:30Z is 00:30 BST on the 16th
    const input: GoalInputs = {
      anchorLogs: [{ log_date: '2026-10-16', wake_time: '07:00' }],
      botcouncil: [sess('2026-10-15T23:30:00Z', 60)],
      learning: [sess('2026-10-16T12:00:00Z', 60)],
      gym: [sess('2026-10-16T16:00:00Z', 30)],
    };
    expect(summariseGoals(input, '2026-10-16').todayQualifies).toBe(true);
  });

  it('ignores running sessions with no duration, and empty history', () => {
    expect(summariseGoals(empty, '2026-10-16').current).toBe(0);
    const running = { ...fullDay('2026-10-16'), gym: [{ started_at: '2026-10-16T16:00:00Z', duration_min: null }] };
    expect(summariseGoals(running, '2026-10-16').todayQualifies).toBe(false);
  });

  it('longestStreak handles gaps and single days', () => {
    expect(longestStreak(new Set(['2026-10-01', '2026-10-02', '2026-10-04']))).toBe(2);
    expect(longestStreak(new Set())).toBe(0);
  });
});
