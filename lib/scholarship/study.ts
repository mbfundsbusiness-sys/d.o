import type { UniModuleKey } from '@/lib/uni/modules';
import { addDaysISO } from '@/lib/utils/dates';

// "Sooner modules get priority, but all modules get hours."
// Each day's study time goes to the modules with the highest score: a module
// with a deadline coming up scores higher, and a module that has had a lot of
// study this week scores lower. A module with no study at all in the last week
// always gets a slot, so nothing is starved however far off its deadline is.

export type ModuleStudy = {
  key: UniModuleKey;
  short: string;
  /** Next coursework/exam due date (YYYY-MM-DD), if any. */
  nextDue: string | null;
  /** Minutes studied (done blocks) in the last 7 days. */
  recentMin: number;
};

export type StudySlot = { key: UniModuleKey; short: string; minutes: number };

const MIN_CHUNK = 30;

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO + 'T00:00:00Z') - Date.parse(fromISO + 'T00:00:00Z')) / 86_400_000);
}

export function studyScore(m: ModuleStudy, today: string): number {
  const urgency = m.nextDue ? 1 + 21 / Math.max(1, daysBetween(today, m.nextDue)) : 1;
  return urgency / (1 + m.recentMin / 60);
}

/** Splits `totalMin` of study across at most two modules (one if under an hour). */
export function splitStudy(modules: ModuleStudy[], totalMin: number, today: string): StudySlot[] {
  if (modules.length === 0 || totalMin < MIN_CHUNK) return [];
  const ranked = [...modules].sort((a, b) => studyScore(b, today) - studyScore(a, today) || a.key.localeCompare(b.key));
  const slots = totalMin >= 2 * MIN_CHUNK + 30 ? 2 : 1;
  let picks = ranked.slice(0, slots);
  const starved = ranked.find((m) => m.recentMin === 0 && !picks.includes(m));
  if (starved) picks = slots === 1 ? [picks[0].recentMin === 0 ? picks[0] : starved] : [picks[0], starved];

  if (picks.length === 1) return [{ key: picks[0].key, short: picks[0].short, minutes: totalMin }];
  const [a, b] = picks;
  const sa = studyScore(a, today);
  const sb = studyScore(b, today);
  let first = Math.round(((totalMin * sa) / (sa + sb)) / 15) * 15;
  first = Math.min(totalMin - MIN_CHUNK, Math.max(MIN_CHUNK, first));
  return [
    { key: a.key, short: a.short, minutes: first },
    { key: b.key, short: b.short, minutes: totalMin - first },
  ];
}

/** The date range ("last 7 days") study minutes are counted over, inclusive. */
export function recentWindow(today: string): { from: string; to: string } {
  return { from: addDaysISO(today, -6), to: today };
}
