import type { PlanItem, ScheduleBlock, TodoItem, UserSettings, WorkShift } from '@/lib/supabase/types';
import type { Rules } from '@/lib/rules';
import { effectiveBlocksForDay } from '@/lib/schedule/effective';
import { fmtHM, minutesOfDay, minutesToHM } from '@/lib/utils/dates';

// A day = the fixed things (prayers, lectures, shifts, Jummah, wake) that nothing
// moves, plus the plan the EA lined up around them, plus to-dos due.

export type FixedKind = 'wake' | 'prayer' | 'lecture' | 'shift' | 'jummah' | 'other';

export type FixedBlock = { title: string; kind: FixedKind; start: string; end: string; startMin: number; endMin: number };

export type DayView = {
  date: string;
  dayOfWeek: number;
  isRestDay: boolean;
  wake: string;
  fixed: FixedBlock[];
  plan: PlanItem[];
  shifts: WorkShift[];
  /** Open to-dos due on this day or earlier. */
  due: TodoItem[];
};

export type DayInputs = {
  date: string;
  blocks: ScheduleBlock[];
  settings: UserSettings | null;
  shifts: WorkShift[];
  prayerTimes: Partial<Record<string, string>>;
  plan: PlanItem[];
  todos: TodoItem[];
};

const isLectureLabel = (label: string) => /^uni lecture/i.test(label);
const isWakeLabel = (label: string) => /^wake/i.test(label);

function dayOfWeekOf(dateISO: string): number {
  return new Date(dateISO + 'T00:00:00Z').getUTCDay();
}

/** Wake time from the rules: the default, or earlier when a lecture or shift starts early. Never later. */
export function wakeFor(rules: Rules, lectureStarts: number[], shiftStarts: number[]): number {
  const candidates = [
    minutesOfDay(rules.wake.default),
    ...lectureStarts.map((m) => m - rules.wake.lecture_lead_min),
    ...shiftStarts.map((m) => m - rules.wake.shift_lead_min),
  ];
  return Math.max(0, Math.min(...candidates));
}

export function assembleDay(input: DayInputs, rules: Rules): DayView {
  const dow = dayOfWeekOf(input.date);
  const shifts = input.shifts.filter((s) => s.shift_date === input.date);
  const blocks = effectiveBlocksForDay(input.blocks, input.settings, dow, shifts, input.prayerTimes);

  const fixed: FixedBlock[] = [];
  for (const b of blocks) {
    if (isWakeLabel(b.label)) continue; // recomputed from the rules below
    const kind: FixedKind =
      b.kind === 'shift' ? 'shift'
      : b.activity_type === 'prayer' ? 'prayer'
      : isLectureLabel(b.label) ? 'lecture'
      : b.id === 'jummah' || /^jummah/i.test(b.label) ? 'jummah'
      : 'other';
    fixed.push({ title: b.label, kind, start: b.start_time, end: b.end_time, startMin: b.startMin, endMin: b.endMin });
  }

  const wakeMin = wakeFor(
    rules,
    fixed.filter((f) => f.kind === 'lecture').map((f) => f.startMin),
    fixed.filter((f) => f.kind === 'shift').map((f) => f.startMin)
  );
  fixed.push({ title: 'Wake', kind: 'wake', start: minutesToHM(wakeMin), end: minutesToHM(wakeMin + 15), startMin: wakeMin, endMin: wakeMin + 15 });
  fixed.sort((a, b) => a.startMin - b.startMin);

  const due = input.todos
    .filter((t) => !t.completed && t.due_at && londonDate(t.due_at) <= input.date)
    .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''));

  return {
    date: input.date,
    dayOfWeek: dow,
    isRestDay: rules.rest_days.includes(dow),
    wake: minutesToHM(wakeMin),
    fixed,
    plan: input.plan
      .filter((p) => p.plan_date === input.date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    shifts,
    due,
  };
}

function londonDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(iso));
}

export type Gap = { start: number; end: number };

/**
 * Free time between wake (+30 min to get going) and wind-down, after fixed blocks
 * and live plan items, with `buffer_min` kept around each. `fromMin` cuts off the past.
 */
export function freeGaps(day: DayView, rules: Rules, fromMin = 0): Gap[] {
  const dayStart = Math.max(minutesOfDay(day.wake) + 30, fromMin);
  const dayEnd = minutesOfDay(rules.wind_down);
  if (dayEnd <= dayStart) return [];
  const pad = rules.buffer_min;
  const busy = [
    ...day.fixed.filter((f) => f.kind !== 'wake').map((f) => ({ start: f.startMin - pad, end: f.endMin + pad })),
    ...day.plan
      .filter((p) => p.status !== 'dropped' && p.status !== 'skipped')
      .map((p) => ({ start: minutesOfDay(p.start_time) - pad, end: minutesOfDay(p.end_time) + pad })),
  ].sort((a, b) => a.start - b.start);

  const gaps: Gap[] = [];
  let cursor = dayStart;
  for (const b of busy) {
    if (b.start > cursor) gaps.push({ start: cursor, end: Math.min(b.start, dayEnd) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= dayEnd) break;
  }
  if (cursor < dayEnd) gaps.push({ start: cursor, end: dayEnd });
  return gaps.filter((g) => g.end - g.start >= 15);
}

const STATUS_MARK: Record<PlanItem['status'], string> = { planned: ' ', done: 'x', skipped: '-', dropped: '~' };

/** Plain-text day for prompts. Plan items carry their id so tools can address them. */
export function describeDay(day: DayView, nowMin?: number): string {
  const lines: string[] = [];
  lines.push(`Date ${day.date}${day.isRestDay ? ' (rest day)' : ''}. Wake ${day.wake}.`);
  if (nowMin !== undefined) lines.push(`Time now ${minutesToHM(nowMin)}.`);
  lines.push('Fixed (cannot move):');
  for (const f of day.fixed) lines.push(`  ${f.start}-${f.end} ${f.title} [${f.kind}]`);
  lines.push(day.plan.length ? 'Plan ([x] done, [-] skipped, [~] dropped):' : 'Plan: nothing lined up yet.');
  for (const p of day.plan) {
    lines.push(`  [${STATUS_MARK[p.status]}] ${fmtHM(p.start_time)}-${fmtHM(p.end_time)} ${p.title} (${p.kind}) id=${p.id}`);
  }
  if (day.due.length) {
    lines.push('To-dos due today or overdue:');
    for (const t of day.due) lines.push(`  - ${t.title} (${t.category}) due ${t.due_at} id=${t.id}`);
  }
  return lines.join('\n');
}
