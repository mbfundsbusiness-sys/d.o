import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, type Rules } from '@/lib/rules';
import { assembleDay, freeGaps, wakeFor } from '@/lib/schedule/day';
import { planDay } from '@/lib/schedule/planner';
import type { ScheduleBlock, TodoItem, WorkShift } from '@/lib/supabase/types';

const block = (label: string, day: number, start: string, end: string, activity_type: ScheduleBlock['activity_type'] = 'custom'): ScheduleBlock => ({
  id: `${label}-${day}`, user_id: 'u', day_of_week: day, activity_type, start_time: start, end_time: end, label,
  source: 'manual', commitment_id: null, archived_at: null, archived_reason: null, created_at: '', updated_at: '',
});
const shift = (date: string, start: string, end: string): WorkShift => ({
  id: 's1', user_id: 'u', shift_date: date, start_time: start, end_time: end, title: 'DPD', note: null,
  actual_start: null, actual_end: null, drops: null, rate_per_drop: null, created_at: '', updated_at: '',
});
const todo = (over: Partial<TodoItem>): TodoItem => ({
  id: 't1', user_id: 'u', title: 'Lab report', notes: null, due_at: null, completed: false, completed_at: null,
  category: 'coursework', priority: 3, estimate_min: 120, module_key: null, created_at: '', ...over,
});

const THU = '2026-10-29'; // Thursday: three lectures
const TUE = '2026-10-27';
const blocks = [
  block('Wake time', 4, '09:00', '09:15'),
  block('Wake time', 2, '09:00', '09:15'),
  block('Uni Lecture: Electronic Circuits', 4, '09:30', '11:00'),
  block('Uni Lecture: Mathematics', 4, '12:00', '13:30'),
  block('Uni Lecture: Engineering Science', 4, '14:00', '17:00'),
  block('Dhuhr', 2, '12:45', '13:00', 'prayer'),
];

function day(date: string, rules: Rules = DEFAULT_RULES, extra: Partial<Parameters<typeof assembleDay>[0]> = {}) {
  return assembleDay({ date, blocks, settings: null, shifts: [], prayerTimes: {}, plan: [], todos: [], ...extra }, rules);
}

describe('wake', () => {
  it('moves earlier for an early lecture, never later', () => {
    expect(wakeFor(DEFAULT_RULES, [9 * 60 + 30], [])).toBe(7 * 60 + 30);
    expect(wakeFor(DEFAULT_RULES, [14 * 60], [])).toBe(9 * 60);
    expect(day(THU).wake).toBe('07:30');
  });
  it('follows a changed rule', () => {
    const rules = { ...DEFAULT_RULES, wake: { ...DEFAULT_RULES.wake, shift_lead_min: 90 } };
    expect(day(TUE, rules, { shifts: [shift(TUE, '07:00', '15:00')] }).wake).toBe('05:30');
  });
});

describe('planner', () => {
  it('never overlaps fixed blocks and stops at wind-down', () => {
    const d = day(THU);
    const { items } = planDay({ day: d, rules: DEFAULT_RULES, todos: [], gymSessionsThisWeek: 0 });
    const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    for (const it of items) {
      for (const f of d.fixed.filter((x) => x.kind !== 'wake')) {
        expect(toMin(it.start) < f.endMin && toMin(it.end) > f.startMin).toBe(false);
      }
      expect(toMin(it.end)).toBeLessThanOrEqual(22 * 60 + 30);
    }
  });

  it('puts coursework before trading, BotCouncil, gym and language', () => {
    const d = day(TUE);
    const { items } = planDay({ day: d, rules: DEFAULT_RULES, todos: [todo({})], gymSessionsThisWeek: 0 });
    const order = items.map((i) => i.kind);
    expect(order[0]).toBe('coursework');
    expect(items.find((i) => i.kind === 'coursework')?.todo_id).toBe('t1');
    expect(order).toEqual(expect.arrayContaining(['trading', 'botcouncil', 'gym', 'language']));
  });

  it('reports what does not fit instead of dropping it silently', () => {
    const rules: Rules = { ...DEFAULT_RULES, wind_down: '12:00' };
    const { unplaced } = planDay({ day: day(TUE, rules), rules, todos: [], gymSessionsThisWeek: 0 });
    expect(unplaced.length).toBeGreaterThan(0);
  });

  it('plans no flexible work on a rest day', () => {
    const rules: Rules = { ...DEFAULT_RULES, rest_days: [2] };
    const { items } = planDay({ day: day(TUE, rules), rules, todos: [todo({})], gymSessionsThisWeek: 0 });
    expect(items).toEqual([]);
  });

  it('skips gym once the weekly target is met, and trading off market days', () => {
    const sun = '2026-11-01';
    const { items } = planDay({ day: day(sun), rules: DEFAULT_RULES, todos: [], gymSessionsThisWeek: 3 });
    expect(items.some((i) => i.kind === 'gym' || i.kind === 'trading')).toBe(false);
  });

  it('works around a shift', () => {
    const d = day(TUE, DEFAULT_RULES, { shifts: [shift(TUE, '07:00', '15:00')] });
    const gaps = freeGaps(d, DEFAULT_RULES);
    expect(gaps.every((g) => g.start >= 15 * 60 || g.end <= 7 * 60)).toBe(true);
  });

  it('re-plans work whose block was missed', () => {
    const missed = { id: 'm', user_id: 'u', plan_date: TUE, start_time: '10:00', end_time: '11:00', title: 'BotCouncil', kind: 'botcouncil' as const,
      status: 'planned' as const, source: 'ea' as const, todo_id: null, module_key: null, note: null, done_at: null, created_at: '', updated_at: '' };
    const d = day(TUE, DEFAULT_RULES, { plan: [missed] });
    const later = planDay({ day: d, rules: DEFAULT_RULES, todos: [], gymSessionsThisWeek: 0, fromMin: 12 * 60 });
    expect(later.items.some((i) => i.kind === 'botcouncil')).toBe(true);
    const before = planDay({ day: d, rules: DEFAULT_RULES, todos: [], gymSessionsThisWeek: 0, fromMin: 9 * 60 });
    expect(before.items.some((i) => i.kind === 'botcouncil')).toBe(false);
  });
});
