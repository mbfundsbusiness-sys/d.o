import { describe, expect, it } from 'vitest';
import { splitStudy, studyScore, type ModuleStudy } from '@/lib/scholarship/study';

const TODAY = '2026-10-30';
const m = (key: ModuleStudy['key'], nextDue: string | null, recentMin: number): ModuleStudy => ({ key, short: key, nextDue, recentMin });

describe('study split', () => {
  it('ranks a sooner deadline higher', () => {
    expect(studyScore(m('maths', '2026-11-02', 60), TODAY)).toBeGreaterThan(studyScore(m('circuits', '2026-12-10', 60), TODAY));
  });

  it('ranks a module studied less this week higher', () => {
    expect(studyScore(m('maths', null, 0), TODAY)).toBeGreaterThan(studyScore(m('circuits', null, 240), TODAY));
  });

  it('gives a starved module a slot even when another deadline is close', () => {
    const slots = splitStudy([m('circuits', '2026-11-01', 120), m('maths', '2026-11-03', 120), m('engsci', null, 0)], 120, TODAY);
    expect(slots.map((s) => s.key)).toEqual(['circuits', 'engsci']);
    expect(slots.reduce((t, s) => t + s.minutes, 0)).toBe(120);
    expect(slots.every((s) => s.minutes >= 30)).toBe(true);
  });

  it('uses one module when there is under 90 minutes', () => {
    expect(splitStudy([m('circuits', null, 30), m('maths', null, 30)], 60, TODAY)).toHaveLength(1);
    expect(splitStudy([m('circuits', null, 30)], 20, TODAY)).toEqual([]);
  });

  it('over a week every module gets time', () => {
    const mods = [m('programming', null, 0), m('circuits', '2026-11-05', 0), m('maths', null, 0), m('engsci', null, 0)];
    const seen = new Set<string>();
    for (let d = 0; d < 7; d++) {
      for (const s of splitStudy(mods, 90, TODAY)) {
        seen.add(s.key);
        mods.find((x) => x.key === s.key)!.recentMin += s.minutes;
      }
    }
    expect(seen.size).toBe(4);
  });
});
