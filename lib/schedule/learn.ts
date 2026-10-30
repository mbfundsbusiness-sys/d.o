import type { PlanItem, PlanKind } from '@/lib/supabase/types';
import type { Gap } from '@/lib/schedule/day';
import { minutesOfDay, minutesToHM } from '@/lib/utils/dates';

// The schedule learns from what actually gets done. Over the last few weeks of
// plan history it finds, per activity, the time of day it gets done most (the
// planner tries there first) and the time it keeps getting missed (the planner
// avoids it). It also compares shift days with other days, for the EA to raise.
// Trading follows the markets and deadline work follows urgency, so neither is learned.

export type HistoryRow = Pick<PlanItem, 'plan_date' | 'start_time' | 'end_time' | 'kind' | 'status'>;
export type Rate = { done: number; total: number };
export type Learned = { prefer: Partial<Record<PlanKind, Gap>>; avoid: Partial<Record<PlanKind, Gap>> };
export type Patterns = Learned & {
  byKind: Partial<Record<PlanKind, Rate>>;
  shiftDays: Rate;
  otherDays: Rate;
};

export const LEARN_DAYS = 28;
export const LEARNABLE: PlanKind[] = ['study', 'botcouncil', 'gym', 'language'];
/** Three-hour windows of the waking day. */
export const WINDOWS: Gap[] = [6, 9, 12, 15, 18, 21].map((h) => ({ start: h * 60, end: (h + 3) * 60 }));

const MIN_KIND = 6; // blocks of a kind before anything is learned about it
const MIN_WINDOW = 3; // blocks in a window before it can be preferred or avoided

/** Blocks whose outcome is known: done or skipped, or still "planned" after their time passed. Dropped ones don't count. */
export function resolvedRows(rows: HistoryRow[], today: string, nowMin: number): HistoryRow[] {
  return rows.filter(
    (r) =>
      r.status === 'done' ||
      r.status === 'skipped' ||
      (r.status === 'planned' && (r.plan_date < today || (r.plan_date === today && minutesOfDay(r.end_time) <= nowMin)))
  );
}

const rate = (rows: HistoryRow[]): Rate => ({ done: rows.filter((r) => r.status === 'done').length, total: rows.length });
const pct = (r: Rate) => (r.total ? r.done / r.total : 0);

export function learnPatterns(rows: HistoryRow[], shiftDates: ReadonlySet<string>, today: string, nowMin: number): Patterns {
  const resolved = resolvedRows(rows, today, nowMin);
  const out: Patterns = {
    prefer: {},
    avoid: {},
    byKind: {},
    shiftDays: rate(resolved.filter((r) => shiftDates.has(r.plan_date))),
    otherDays: rate(resolved.filter((r) => !shiftDates.has(r.plan_date))),
  };
  for (const r of resolved) {
    const k = (out.byKind[r.kind] ??= { done: 0, total: 0 });
    k.total++;
    if (r.status === 'done') k.done++;
  }

  for (const kind of LEARNABLE) {
    const mine = resolved.filter((r) => r.kind === kind);
    if (mine.length < MIN_KIND) continue;
    const overall = pct(rate(mine));
    const windows = WINDOWS.map((w) => {
      const inside = mine.filter((r) => {
        const s = minutesOfDay(r.start_time);
        return s >= w.start && s < w.end;
      });
      return { w, r: rate(inside) };
    }).filter((x) => x.r.total >= MIN_WINDOW);
    if (windows.length === 0) continue;

    const best = [...windows].sort((a, b) => pct(b.r) - pct(a.r) || b.r.total - a.r.total)[0];
    if (pct(best.r) >= 0.6 && pct(best.r) - overall >= 0.15) out.prefer[kind] = best.w;

    const worst = [...windows].sort((a, b) => pct(a.r) - pct(b.r) || b.r.total - a.r.total)[0];
    if (worst !== best && pct(worst.r) <= 0.34 && overall - pct(worst.r) >= 0.15) out.avoid[kind] = worst.w;
  }
  return out;
}

const span = (g: Gap) => `${minutesToHM(g.start)}-${minutesToHM(g.end)}`;
const showRate = (r: Rate) => `${r.done}/${r.total} (${Math.round(pct(r) * 100)}%)`;

/** Plain-language summary for the EA and the review. */
export function describePatterns(p: Patterns): string {
  const kinds = Object.entries(p.byKind) as [PlanKind, Rate][];
  if (kinds.length === 0) return `No plan history yet (learning starts once blocks get marked done or missed).`;
  const lines = [`Done vs planned, last ${LEARN_DAYS} days: ${kinds.map(([k, r]) => `${k} ${showRate(r)}`).join(', ')}.`];
  if (p.shiftDays.total >= 4) lines.push(`Shift days: ${showRate(p.shiftDays)} done; other days: ${showRate(p.otherDays)}.`);
  const prefer = Object.entries(p.prefer).map(([k, g]) => `${k} goes best ${span(g!)}`);
  const avoid = Object.entries(p.avoid).map(([k, g]) => `${k} keeps getting missed ${span(g!)}`);
  if (prefer.length || avoid.length) lines.push(`Learned (the planner uses this): ${[...prefer, ...avoid].join('; ')}.`);
  return lines.join('\n');
}
