import type { PlanKind, StudyKey, TodoItem } from '@/lib/supabase/types';
import { splitStudy, type ModuleStudy } from '@/lib/scholarship/study';
import { uniModuleByKey } from '@/lib/uni/modules';
import type { PriorityKey, Rules } from '@/lib/rules';
import { freeGaps, type DayView, type Gap } from '@/lib/schedule/day';
import type { Learned } from '@/lib/schedule/learn';
import { minutesOfDay, minutesToHM } from '@/lib/utils/dates';

// Fills a day's free time around the fixed blocks, in the order the rules give
// (exams/coursework, trading, BotCouncil, gym, language by default). Anything
// that doesn't fit is returned as `unplaced` so the EA can ask before dropping it.

export type Demand = { title: string; kind: PlanKind; minutes: number; priority: PriorityKey | 'task'; todo_id?: string; module_key?: StudyKey };
export type Proposed = { title: string; kind: PlanKind; start: string; end: string; todo_id?: string; module_key?: StudyKey };
export type PlanResult = { items: Proposed[]; unplaced: { title: string; minutes: number }[] };

const MIN_CHUNK = 30;

/** Where an activity prefers to sit (London time), tried before any other gap. */
const PREFERRED: Partial<Record<PlanKind, Gap>> = {
  trading: { start: 12 * 60, end: 17 * 60 }, // London open into New York
};

export type PlanContext = {
  day: DayView;
  rules: Rules;
  todos: TodoItem[];
  /** Gym sessions already done or planned this week, not counting this day. */
  gymSessionsThisWeek: number;
  /** Don't plan before this (minutes since midnight); use the current time for today. */
  fromMin?: number;
  /** Per-module deadlines and recent study, to share study time out (Scholarship). */
  study?: ModuleStudy[];
  /** Title of the next language module, used to label the language block. */
  languageTitle?: string;
  /** Hours each activity actually gets done in, and gets missed in (Phase 4). */
  learned?: Learned;
};

export function demandsFor({ day, rules, todos, gymSessionsThisWeek, fromMin = 0, study = [], languageTitle }: PlanContext): Demand[] {
  // Done blocks and blocks still ahead count; a planned block whose time has passed was missed,
  // so its work is still owed and gets planned again.
  const live = day.plan.filter((p) => p.status === 'done' || (p.status === 'planned' && minutesOfDay(p.end_time) > fromMin));
  const already = (kind: PlanKind) =>
    live.filter((p) => p.kind === kind).reduce((t, p) => t + minutesOfDay(p.end_time) - minutesOfDay(p.start_time), 0);
  const plannedTodo = new Set(live.map((p) => p.todo_id).filter(Boolean));

  const out: Demand[] = [];
  const rest = day.isRestDay;
  const academic = todos
    .filter((t) => !t.completed && (t.category === 'exams' || t.category === 'coursework') && !plannedTodo.has(t.id))
    .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999') || a.priority - b.priority);

  for (const key of rules.priorities) {
    if (key === 'exams' || key === 'coursework') {
      for (const t of academic.filter((x) => x.category === key)) {
        // On a rest day only work that is due now gets planned.
        if (rest && !(t.due_at && t.due_at.slice(0, 10) <= day.date)) continue;
        const mod = t.module_key && t.module_key !== 'language' ? uniModuleByKey(t.module_key) : undefined;
        out.push({
          title: mod ? `${mod.short}: ${t.title}` : t.title,
          kind: key,
          minutes: t.estimate_min ?? 60,
          priority: key,
          todo_id: t.id,
          ...(t.module_key ? { module_key: t.module_key } : {}),
        });
      }
      if (key === 'coursework' && !rest) {
        const studied = already('study') + already('coursework') + already('exams') + out.filter((d) => d.priority === 'exams' || d.priority === 'coursework').reduce((s, d) => s + d.minutes, 0);
        const left = rules.targets.study_min - studied;
        if (left >= MIN_CHUNK) {
          const slots = splitStudy(study, left, day.date);
          if (slots.length === 0) out.push({ title: 'Uni study', kind: 'study', minutes: left, priority: 'coursework' });
          for (const sl of slots) out.push({ title: `Study: ${sl.short}`, kind: 'study', minutes: sl.minutes, priority: 'coursework', module_key: sl.key });
        }
      }
      continue;
    }
    if (rest) continue;
    if (key === 'trading') {
      if (!rules.trading_days.includes(day.dayOfWeek)) continue;
      push(out, 'Trading', 'trading', rules.targets.trading_min - already('trading'), key);
    } else if (key === 'botcouncil') {
      push(out, 'BotCouncil', 'botcouncil', rules.targets.botcouncil_min - already('botcouncil'), key);
    } else if (key === 'gym') {
      if (gymSessionsThisWeek >= rules.gym_sessions_per_week || already('gym') > 0) continue;
      push(out, 'Gym', 'gym', rules.targets.gym_min, key);
    } else if (key === 'language') {
      const minutes = rules.targets.language_min - already('language');
      if (minutes >= MIN_CHUNK) out.push({ title: languageTitle ? `Language: ${languageTitle}` : 'Language', kind: 'language', minutes, priority: key, module_key: 'language' });
    }
  }

  // Plain to-dos due today with a size get a slot after everything the rules rank.
  for (const t of day.due) {
    if (t.category !== 'task' || !t.estimate_min || plannedTodo.has(t.id)) continue;
    out.push({ title: t.title, kind: 'task', minutes: t.estimate_min, priority: 'task', todo_id: t.id });
  }
  return out;
}

function push(out: Demand[], title: string, kind: PlanKind, minutes: number, priority: PriorityKey) {
  if (minutes >= MIN_CHUNK) out.push({ title, kind, minutes, priority });
}

function take(gaps: Gap[], i: number, start: number, end: number): void {
  const g = gaps[i];
  const parts: Gap[] = [];
  if (start - g.start >= 15) parts.push({ start: g.start, end: start });
  if (g.end - end >= 15) parts.push({ start: end, end: g.end });
  gaps.splice(i, 1, ...parts);
}

/** Earliest start for `len` minutes inside a gap but outside `avoid`. */
function fitOutside(gaps: Gap[], len: number, avoid: Gap): { i: number; start: number } | null {
  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i];
    const segs: Gap[] = [
      { start: g.start, end: Math.min(g.end, avoid.start) },
      { start: Math.max(g.start, avoid.end), end: g.end },
    ];
    const seg = segs.find((x) => x.end - x.start >= len);
    if (seg) return { i, start: seg.start };
  }
  return null;
}

/**
 * Greedy placement: the preferred window first (learned, or the default for the
 * activity), then the earliest gap outside a learned "keeps getting missed"
 * window, then any earliest gap; splits into ≥30 min chunks if nothing fits whole.
 */
export function placeDemands(demands: Demand[], gapsIn: Gap[], bufferMin: number, learned?: Learned): PlanResult {
  const gaps = gapsIn.map((g) => ({ ...g }));
  const items: Proposed[] = [];
  const unplaced: PlanResult['unplaced'] = [];

  const emit = (d: Demand, start: number, end: number) =>
    items.push({
      title: d.title,
      kind: d.kind,
      start: minutesToHM(start),
      end: minutesToHM(end),
      ...(d.todo_id ? { todo_id: d.todo_id } : {}),
      ...(d.module_key ? { module_key: d.module_key } : {}),
    });

  for (const d of demands) {
    let left = d.minutes;
    const pref = learned?.prefer[d.kind] ?? PREFERRED[d.kind];
    const avoid = learned?.avoid[d.kind];
    // 1. one block, preferred window
    if (pref) {
      const i = gaps.findIndex((g) => Math.min(g.end, pref.end) - Math.max(g.start, pref.start) >= left);
      if (i !== -1) {
        const start = Math.max(gaps[i].start, pref.start);
        take(gaps, i, start - bufferMin, start + left + bufferMin);
        emit(d, start, start + left);
        continue;
      }
    }
    // 2. one block, earliest gap clear of the hours it keeps getting missed in
    if (avoid) {
      const fit = fitOutside(gaps, left, avoid);
      if (fit) {
        take(gaps, fit.i, fit.start, fit.start + left + bufferMin);
        emit(d, fit.start, fit.start + left);
        continue;
      }
    }
    // 3. one block, earliest gap
    const whole = gaps.findIndex((g) => g.end - g.start >= left);
    if (whole !== -1) {
      const start = gaps[whole].start;
      take(gaps, whole, start, start + left + bufferMin);
      emit(d, start, start + left);
      continue;
    }
    // 4. split across gaps
    for (let i = 0; i < gaps.length && left >= MIN_CHUNK; ) {
      const g = gaps[i];
      const len = Math.min(left, g.end - g.start);
      if (len < MIN_CHUNK) { i++; continue; }
      emit(d, g.start, g.start + len);
      left -= len;
      take(gaps, i, g.start, g.start + len + bufferMin);
    }
    if (left >= MIN_CHUNK) unplaced.push({ title: d.title, minutes: left });
  }
  items.sort((a, b) => a.start.localeCompare(b.start));
  return { items, unplaced };
}

export function planDay(ctx: PlanContext): PlanResult {
  const gaps = freeGaps(ctx.day, ctx.rules, ctx.fromMin ?? 0);
  return placeDemands(demandsFor(ctx), gaps, ctx.rules.buffer_min, ctx.learned);
}
