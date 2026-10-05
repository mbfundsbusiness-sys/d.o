import { describe, it, expect } from 'vitest';
import { planDay, nextDateForWeekday, formatMinutes, type PlannerCommitment, type DayPlan } from '@/lib/schedule/planner';

const ALL = [0, 1, 2, 3, 4, 5, 6];
let n = 0;
function c(p: Partial<PlannerCommitment> & Pick<PlannerCommitment, 'label' | 'activity_type' | 'target_duration_min'>): PlannerCommitment {
  return { id: `c${++n}`, applies_days: ALL, preferred_start_time: null, priority: 5, fixed: false, ...p };
}

// The daily structure as seeded by 20260924110000_daily_structure_commitments.sql (+ gym).
const wake = c({ label: 'Wake time', activity_type: 'custom', target_duration_min: 15, preferred_start_time: '09:00', priority: 10, fixed: true });
const work1 = c({ label: 'Work Block 1', activity_type: 'trading', target_duration_min: 120, preferred_start_time: '12:00', priority: 9, fixed: true });
const learn = c({ label: 'Learning Block', activity_type: 'course', target_duration_min: 90, preferred_start_time: '14:30', priority: 9, fixed: true });
const work2 = c({ label: 'Work Block 2', activity_type: 'botcouncil', target_duration_min: 60, preferred_start_time: '19:15', priority: 9, fixed: true });
const reminder = c({ label: 'Daily Logging Reminder', activity_type: 'custom', target_duration_min: 15, preferred_start_time: '20:00', priority: 9, fixed: true });
const gym = c({ label: 'Gym session', activity_type: 'gym', target_duration_min: 60, preferred_start_time: '16:00' });

const lecture = (label: string, day: number, start: string, mins: number, extra: Partial<PlannerCommitment> = {}) =>
  c({ label, activity_type: 'custom', category: 'university', target_duration_min: mins, applies_days: [day], preferred_start_time: start, priority: 10, fixed: true, ...extra });

const monLecture = lecture('Uni Lecture: Programming', 1, '12:00', 60);
const thuLectures = [
  lecture('Uni Lecture: Circuits', 4, '09:30', 90),
  lecture('Uni Lecture: Maths', 4, '12:00', 90),
  lecture('Uni Lecture: Eng Science', 4, '14:00', 180),
];
const base = [wake, work1, learn, work2, reminder, gym];

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const at = (plan: DayPlan, label: string) => plan.placed.filter((p) => p.commitment.label === label || p.label.startsWith(label));
const minutes = (plan: DayPlan, label: string) => at(plan, label).reduce((a, p) => a + p.endMin - p.startMin, 0);
const input = (dayOfWeek: number, dateISO: string, commitments: PlannerCommitment[], prayers: { label: string; startMin: number; endMin: number }[] = []) =>
  ({ dayOfWeek, dateISO, commitments, manual: [], prayers });

describe('planDay', () => {
  it('Monday: lecture pinned, work/learning flex around it, everything fits', () => {
    const plan = planDay(input(1, '2026-10-05', [...base, monLecture, ...thuLectures]));
    const lec = at(plan, 'Uni Lecture: Programming')[0];
    expect([hm(lec.startMin), hm(lec.endMin)]).toEqual(['12:00', '13:00']);
    expect(plan.shortfalls).toEqual([]);
    expect(minutes(plan, 'Work Block 1') + minutes(plan, 'Work Block 2')).toBe(180);
    expect(minutes(plan, 'Learning Block')).toBe(90);
    // nothing but the lecture inside 11:45–13:30 (15m buffer before, lunch after)
    const clash = plan.placed.filter((p) => p !== lec && p.startMin < 13 * 60 + 30 && p.endMin > 11 * 60 + 45);
    expect(clash).toEqual([]);
    // every flexed chunk is >= 45 min
    for (const p of plan.placed.filter((x) => /Work|Learning/.test(x.label))) expect(p.endMin - p.startMin).toBeGreaterThanOrEqual(45);
    expect(hm(at(plan, 'Gym session')[0].startMin)).toBe('16:00');
    expect(hm(at(plan, 'Daily Logging Reminder')[0].startMin)).toBe('20:00');
  });

  it('Thursday: gym moves to 17:15, targets do not fit, shortfall reported (not overpacked)', () => {
    const plan = planDay(input(4, '2026-10-08', [...base, monLecture, ...thuLectures]));
    expect(plan.hasLectures).toBe(true);
    expect(hm(at(plan, 'Gym session')[0].startMin)).toBe('17:15');
    expect(hm(at(plan, 'Daily Logging Reminder')[0].startMin)).toBe('20:00');
    const lecs = plan.placed.filter((p) => p.commitment.category === 'university').map((p) => [hm(p.startMin), hm(p.endMin)]);
    expect(lecs).toEqual([['09:30', '11:00'], ['12:00', '13:30'], ['14:00', '17:00']]);
    // only the 18:15–20:00 window is usable (the 11:15–11:45 gap is under 45 min)
    const flexed = plan.placed.filter((p) => /Work|Learning/.test(p.label));
    for (const p of flexed) {
      expect(p.startMin).toBeGreaterThanOrEqual(18 * 60 + 15);
      expect(p.endMin).toBeLessThanOrEqual(20 * 60);
    }
    const work = plan.shortfalls.find((s) => s.category === 'work')!;
    const learning = plan.shortfalls.find((s) => s.category === 'learning')!;
    expect(work.scheduledMin).toBe(105);
    expect(work.missingMin).toBe(75);
    expect(learning.scheduledMin).toBe(0);
    expect(learning.missingMin).toBe(90);
    // work is prioritised over learning
    expect(minutes(plan, 'Learning Block')).toBe(0);
    // no overlaps among placed blocks other than allowed pinned ones
    const lectureEnd = 17 * 60;
    expect(at(plan, 'Gym session')[0].startMin - lectureEnd).toBe(15);
  });

  it('a normal free day is unchanged: full pinned blocks, no shortfall', () => {
    for (const dow of [2, 3, 5, 6, 0]) {
      const plan = planDay(input(dow, '2026-10-06', [...base, monLecture, ...thuLectures]));
      expect(plan.hasLectures).toBe(false);
      expect(plan.shortfalls).toEqual([]);
      const w1 = at(plan, 'Work Block 1')[0];
      expect([hm(w1.startMin), hm(w1.endMin)]).toEqual(['12:00', '14:00']);
      const l = at(plan, 'Learning Block')[0];
      expect([hm(l.startMin), hm(l.endMin)]).toEqual(['14:30', '16:00']);
      const w2 = at(plan, 'Work Block 2')[0];
      expect([hm(w2.startMin), hm(w2.endMin)]).toEqual(['19:15', '20:15']);
      expect(hm(at(plan, 'Gym session')[0].startMin)).toBe('16:00');
    }
  });

  it('flags a prayer that falls inside a lecture without moving it', () => {
    const dhuhr = { label: 'Dhuhr', startMin: 12 * 60 + 40, endMin: 12 * 60 + 55 };
    const asr = { label: 'Asr', startMin: 15 * 60 + 30, endMin: 15 * 60 + 45 };
    const plan = planDay(input(4, '2026-10-08', [...base, ...thuLectures], [dhuhr, asr]));
    expect(plan.prayerFlags.map((f) => f.prayer)).toEqual(['Dhuhr', 'Asr']);
    expect(plan.prayerFlags[0].note).toContain('pray before/after');
    expect(plan.prayerFlags[0].lecture).toBe('Uni Lecture: Maths');
    // prayers are never emitted as placed blocks (prayer sync owns them)
    expect(plan.placed.some((p) => p.commitment.label === 'Dhuhr')).toBe(false);
    // a prayer outside lectures is not flagged
    const maghrib = planDay(input(4, '2026-10-08', [...base, ...thuLectures], [{ label: 'Maghrib', startMin: 18 * 60 + 40, endMin: 18 * 60 + 55 }]));
    expect(maghrib.prayerFlags).toEqual([]);
  });

  it('a lecture past effective_until does not generate; the day reverts to normal', () => {
    const ended = thuLectures.map((l) => ({ ...l, effective_until: '2026-12-18' }));
    const during = planDay(input(4, '2026-12-17', [...base, ...ended]));
    expect(during.hasLectures).toBe(true);
    const after = planDay(input(4, '2027-01-14', [...base, ...ended]));
    expect(after.hasLectures).toBe(false);
    expect(after.placed.some((p) => p.commitment.category === 'university')).toBe(false);
    expect(after.shortfalls).toEqual([]);
    expect(hm(at(after, 'Work Block 1')[0].startMin)).toBe('12:00');
    expect(hm(at(after, 'Gym session')[0].startMin)).toBe('16:00');
    // and effective_from keeps lectures out before term starts
    const notYet = planDay(input(4, '2026-09-01', [...base, ...thuLectures.map((l) => ({ ...l, effective_from: '2026-10-05' }))]));
    expect(notYet.hasLectures).toBe(false);
  });
});

describe('helpers', () => {
  it('nextDateForWeekday returns the next matching London date, today included', () => {
    const now = { dateISO: '2026-10-05', dayOfWeek: 1, hour: 0, minute: 0, minutesOfDay: 0 };
    expect(nextDateForWeekday(1, now)).toBe('2026-10-05');
    expect(nextDateForWeekday(4, now)).toBe('2026-10-08');
    expect(nextDateForWeekday(0, now)).toBe('2026-10-11');
  });
  it('formats minutes', () => {
    expect(formatMinutes(75)).toBe('1h15');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(45)).toBe('45m');
  });
});
