import type { RecurringCommitment } from '@/lib/supabase/client';
import { minutesOfDay, londonNow } from '@/lib/utils/dates';

/**
 * Pure day planner (no database access) — the placement rules behind
 * lib/schedule/auto-scheduler.ts, kept separate so they can be unit tested.
 *
 * Days with no active university lecture are planned exactly as before:
 * fixed commitments pinned, preferred start if free, otherwise first open gap.
 *
 * Days with an active lecture (a `category = 'university'` commitment, which is
 * fixed + priority 10):
 *  1. lectures and other pinned fixed items (wake time, logging reminder) go
 *     down first and never move;
 *  2. other commitments (gym etc.) keep their preferred time unless it collides
 *     with a lecture, in which case they move to just after that lecture;
 *  3. work and learning targets are poured into the remaining free windows —
 *     work first — split where needed, never into a chunk under 45 minutes,
 *     and whatever does not fit is reported as a shortfall.
 */

export const DAY_WINDOW_START = 9 * 60; // 09:00 — wake time
export const DAY_WINDOW_END = 23 * 60;
const GAP_STEP_MIN = 5;

export const LECTURE_CATEGORY = 'university';
export const LECTURE_BUFFER_MIN = 15; // clear gap either side of a lecture (travel, changeover)
export const MIN_SPLIT_CHUNK_MIN = 45;
export const LUNCH_MIN = 30;
// Flexible work/learning on lecture days stops at the fixed 20:00 daily logging reminder.
export const FLEX_DAY_END = 20 * 60;

export type Window = { startMin: number; endMin: number };
export type FlexCategory = 'work' | 'learning';

/** Commitment fields the planner reads. New columns are optional so pre-migration rows still work. */
export type PlannerCommitment = Pick<
  RecurringCommitment,
  'id' | 'activity_type' | 'label' | 'target_duration_min' | 'applies_days' | 'preferred_start_time' | 'priority' | 'fixed'
> & {
  category?: string | null;
  effective_from?: string | null;
  effective_until?: string | null;
  location?: string | null;
};

export type PlannedBlock = {
  commitment: PlannerCommitment;
  label: string;
  startMin: number;
  endMin: number;
};

export type Shortfall = { category: FlexCategory; targetMin: number; scheduledMin: number; missingMin: number };

export type PrayerLectureFlag = {
  prayer: string;
  prayerStartMin: number;
  prayerEndMin: number;
  lecture: string;
  note: string;
};

export type DayPlan = {
  placed: PlannedBlock[];
  skipped: { commitment: PlannerCommitment; reason: string }[];
  /** Work/learning minutes that did not fit around lectures. Empty on days without a lecture. */
  shortfalls: Shortfall[];
  /** Prayers that fall inside a lecture — left where they are, flagged for display only. */
  prayerFlags: PrayerLectureFlag[];
  hasLectures: boolean;
};

export type PlanDayInput = {
  dayOfWeek: number;
  /** YYYY-MM-DD this plan is for; drives effective_from / effective_until. */
  dateISO: string;
  commitments: PlannerCommitment[];
  /** Manual blocks the scheduler must route around. */
  manual: (Window & { label?: string })[];
  /** Prayer blocks already on the day (never moved, never deleted). */
  prayers: (Window & { label: string })[];
};

const EXCLUDED_ACTIVITY_TYPES = ['prayer'];

function overlaps(a: Window, b: Window): boolean {
  return a.startMin < b.endMin && a.endMin > b.startMin;
}

export function categoryOf(c: Pick<PlannerCommitment, 'category' | 'activity_type'>): string | null {
  if (c.category) return c.category;
  switch (c.activity_type) {
    case 'trading':
    case 'botcouncil':
      return 'work';
    case 'course':
    case 'language':
    case 'reading':
      return 'learning';
    case 'gym':
      return 'fitness';
    case 'prayer':
      return 'prayer';
    default:
      return null;
  }
}

export function isLecture(c: PlannerCommitment): boolean {
  return categoryOf(c) === LECTURE_CATEGORY;
}

export function isFlexCategory(c: PlannerCommitment): boolean {
  const cat = categoryOf(c);
  return cat === 'work' || cat === 'learning';
}

export function isEffectiveOn(c: PlannerCommitment, dateISO: string): boolean {
  if (c.effective_from && dateISO < c.effective_from) return false;
  if (c.effective_until && dateISO > c.effective_until) return false;
  return true;
}

/** Next calendar date (London, today included) that falls on `dayOfWeek`, as YYYY-MM-DD. */
export function nextDateForWeekday(dayOfWeek: number, now = londonNow()): string {
  const [y, m, d] = now.dateISO.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + ((dayOfWeek - now.dayOfWeek + 7) % 7));
  return base.toISOString().slice(0, 10);
}

function windowOf(c: PlannerCommitment, startMin?: number): Window {
  const s = startMin ?? minutesOfDay(c.preferred_start_time as string);
  return { startMin: s, endMin: s + c.target_duration_min };
}

function findOpenSlot(durationMin: number, occupied: Window[], endLimit = DAY_WINDOW_END): Window | null {
  for (let start = DAY_WINDOW_START; start + durationMin <= endLimit; start += GAP_STEP_MIN) {
    const candidate = { startMin: start, endMin: start + durationMin };
    if (!occupied.some((w) => overlaps(candidate, w))) return candidate;
  }
  return null;
}

/** Free gaps inside [from, to] once `blocked` is removed, in chronological order. */
function freeWindows(from: number, to: number, blocked: Window[]): Window[] {
  const sorted = [...blocked].sort((a, b) => a.startMin - b.startMin);
  const out: Window[] = [];
  let cursor = from;
  for (const w of sorted) {
    if (w.endMin <= cursor) continue;
    if (w.startMin >= to) break;
    if (w.startMin > cursor) out.push({ startMin: cursor, endMin: Math.min(w.startMin, to) });
    cursor = Math.max(cursor, w.endMin);
  }
  if (cursor < to) out.push({ startMin: cursor, endMin: to });
  return out;
}

/**
 * Pour `durationMin` into `windows` (consumed in place), chronologically.
 * Chunks are at least MIN_SPLIT_CHUNK_MIN; a split avoids leaving a smaller
 * remainder when there is room later to place it.
 */
function pour(durationMin: number, windows: Window[]): Window[] {
  const chunks: Window[] = [];
  let remaining = durationMin;
  windows.forEach((w, i) => {
    if (remaining <= 0) return;
    const len = w.endMin - w.startMin;
    let take = Math.min(remaining, len);
    const leftover = remaining - take;
    if (leftover > 0 && leftover < MIN_SPLIT_CHUNK_MIN) {
      // Only hold back to keep the remainder viable if a later window can actually take it.
      const laterRoom = windows.slice(i + 1).some((x) => x.endMin - x.startMin >= MIN_SPLIT_CHUNK_MIN);
      if (laterRoom) take = remaining - MIN_SPLIT_CHUNK_MIN;
    }
    if (take <= 0 || (take < MIN_SPLIT_CHUNK_MIN && durationMin >= MIN_SPLIT_CHUNK_MIN)) return;
    chunks.push({ startMin: w.startMin, endMin: w.startMin + take });
    w.startMin += take;
    remaining -= take;
  });
  return chunks;
}

export function planDay(input: PlanDayInput): DayPlan {
  const { dayOfWeek, dateISO, manual, prayers } = input;
  const commitments = input.commitments.filter(
    (c) =>
      (c.applies_days ?? []).includes(dayOfWeek) &&
      !EXCLUDED_ACTIVITY_TYPES.includes(c.activity_type) &&
      isEffectiveOn(c, dateISO)
  );

  const lectures = commitments.filter((c) => isLecture(c) && c.preferred_start_time);
  const hasLectures = lectures.length > 0;
  const lectureWindows = lectures.map((l) => ({ commitment: l, win: windowOf(l) }));

  const plan: DayPlan = { placed: [], skipped: [], shortfalls: [], prayerFlags: [], hasLectures };
  const prayerWins: Window[] = prayers.map((w) => ({ startMin: w.startMin, endMin: w.endMin }));
  // Everything except prayer; prayer is layered on separately where it should be respected.
  const fixedOcc: Window[] = manual.map((w) => ({ startMin: w.startMin, endMin: w.endMin }));
  const occupied: Window[] = [...fixedOcc, ...prayerWins];
  const place = (commitment: PlannerCommitment, slot: Window, label = commitment.label) => {
    occupied.push(slot);
    fixedOcc.push(slot);
    plan.placed.push({ commitment, label, startMin: slot.startMin, endMin: slot.endMin });
  };

  const flex = hasLectures ? commitments.filter((c) => !isLecture(c) && isFlexCategory(c)) : [];
  const flexIds = new Set(flex.map((c) => c.id));
  const rest = commitments.filter((c) => !flexIds.has(c.id));

  // Lectures first, then the remaining fixed items, then everything else by priority.
  const ordered = [...rest].sort(
    (a, b) =>
      Number(isLecture(b)) - Number(isLecture(a)) ||
      Number(!!b.fixed) - Number(!!a.fixed)
  );

  const buffered = lectureWindows.map(({ win }) => ({
    startMin: win.startMin - LECTURE_BUFFER_MIN,
    endMin: win.endMin + LECTURE_BUFFER_MIN,
  }));

  for (const c of ordered) {
    let slot: Window | null = null;

    if (c.fixed && c.preferred_start_time) {
      slot = windowOf(c);
    } else if (c.preferred_start_time) {
      let candidate = windowOf(c);
      // Collides with a lecture: move to just after it (e.g. Thursday gym 16:00 -> 17:15).
      for (const { win } of lectureWindows.sort((a, b) => a.win.startMin - b.win.startMin)) {
        if (overlaps(candidate, { startMin: win.startMin - LECTURE_BUFFER_MIN, endMin: win.endMin + LECTURE_BUFFER_MIN })) {
          candidate = windowOf(c, win.endMin + LECTURE_BUFFER_MIN);
        }
      }
      const moved = candidate.startMin !== minutesOfDay(c.preferred_start_time);
      // A moved block ignores prayer (prayer is flagged/prayed around, not scheduled around);
      // an unmoved one keeps the original "only if free" rule.
      const against = moved ? fixedOcc : occupied;
      if (!against.some((w) => overlaps(candidate, w)) && candidate.endMin <= DAY_WINDOW_END) slot = candidate;
    }

    if (!slot) slot = findOpenSlot(c.target_duration_min, [...occupied, ...buffered]);

    if (!slot) {
      plan.skipped.push({ commitment: c, reason: 'No open slot long enough today' });
      continue;
    }
    place(c, slot);
  }

  if (hasLectures) {
    // Lunch: 13:00, or 13:30 if a lecture is in the way. Reserved, not a block.
    const lunch = [13 * 60, 13 * 60 + 30]
      .map((s) => ({ startMin: s, endMin: s + LUNCH_MIN }))
      .find((w) => !lectureWindows.some(({ win }) => overlaps(w, win)));
    const blocked = [...occupied, ...buffered, ...(lunch ? [lunch] : [])];
    const windows = freeWindows(DAY_WINDOW_START, FLEX_DAY_END, blocked);

    for (const category of ['work', 'learning'] as FlexCategory[]) {
      const group = flex
        .filter((c) => categoryOf(c) === category)
        .sort((a, b) => b.priority - a.priority || (a.preferred_start_time ?? '').localeCompare(b.preferred_start_time ?? ''));
      let targetMin = 0;
      let scheduledMin = 0;
      for (const c of group) {
        targetMin += c.target_duration_min;
        const chunks = pour(c.target_duration_min, windows);
        chunks.forEach((chunk, i) => {
          place(c, chunk, chunks.length > 1 ? `${c.label} (${i + 1}/${chunks.length})` : c.label);
          scheduledMin += chunk.endMin - chunk.startMin;
        });
        if (scheduledMin < targetMin && chunks.length === 0) {
          plan.skipped.push({ commitment: c, reason: 'No free window around lectures' });
        }
      }
      if (targetMin > 0 && scheduledMin < targetMin) {
        plan.shortfalls.push({ category, targetMin, scheduledMin, missingMin: targetMin - scheduledMin });
      }
    }

    plan.prayerFlags = flagPrayersInLectures(
      prayers,
      lectureWindows.map(({ commitment, win }) => ({ label: commitment.label, ...win }))
    );
  }

  plan.placed.sort((a, b) => a.startMin - b.startMin);
  return plan;
}

export function flagPrayersInLectures(
  prayers: (Window & { label: string })[],
  lectures: (Window & { label: string })[]
): PrayerLectureFlag[] {
  const flags: PrayerLectureFlag[] = [];
  for (const p of prayers) {
    const l = lectures.find((x) => overlaps(p, x));
    if (l) {
      flags.push({
        prayer: p.label,
        prayerStartMin: p.startMin,
        prayerEndMin: p.endMin,
        lecture: l.label,
        note: `${p.label} falls during lecture — pray before/after`,
      });
    }
  }
  return flags;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function describeShortfall(dayOfWeek: number, s: Shortfall): string {
  return `${DAY_SHORT[dayOfWeek]}: ${formatMinutes(s.missingMin)} of ${s.category} unscheduled`;
}

export type DayInsights = { hasLectures: boolean; shortfalls: Shortfall[]; prayerFlags: PrayerLectureFlag[] };

/**
 * Same shortfall / prayer-in-lecture facts as planDay, derived from what is
 * actually persisted in schedule_blocks — so the UI always reflects the real
 * schedule rather than whatever the last regenerate returned.
 */
export function dayInsights(
  commitments: PlannerCommitment[],
  blocks: { day_of_week: number; start_time: string; end_time: string; label: string; activity_type: string; commitment_id: string | null; archived_at?: string | null }[],
  dayOfWeek: number,
  dateISO: string
): DayInsights {
  const applicable = commitments.filter(
    (c) => (c.applies_days ?? []).includes(dayOfWeek) && isEffectiveOn(c, dateISO) && !EXCLUDED_ACTIVITY_TYPES.includes(c.activity_type)
  );
  const lectureCs = applicable.filter(isLecture);
  if (lectureCs.length === 0) return { hasLectures: false, shortfalls: [], prayerFlags: [] };

  const day = blocks.filter((b) => b.day_of_week === dayOfWeek && !b.archived_at);
  const len = (b: { start_time: string; end_time: string }) => minutesOfDay(b.end_time) - minutesOfDay(b.start_time);
  const shortfalls: Shortfall[] = [];
  for (const category of ['work', 'learning'] as FlexCategory[]) {
    const group = applicable.filter((c) => !isLecture(c) && categoryOf(c) === category);
    const ids = new Set(group.map((c) => c.id));
    const targetMin = group.reduce((a, c) => a + c.target_duration_min, 0);
    const scheduledMin = day.filter((b) => b.commitment_id && ids.has(b.commitment_id)).reduce((a, b) => a + len(b), 0);
    if (targetMin > scheduledMin) shortfalls.push({ category, targetMin, scheduledMin, missingMin: targetMin - scheduledMin });
  }

  const lectureIds = new Set(lectureCs.map((c) => c.id));
  const lectures = day
    .filter((b) => b.commitment_id && lectureIds.has(b.commitment_id))
    .map((b) => ({ label: b.label, startMin: minutesOfDay(b.start_time), endMin: minutesOfDay(b.end_time) }));
  const prayers = day
    .filter((b) => b.activity_type === 'prayer')
    .map((b) => ({ label: b.label, startMin: minutesOfDay(b.start_time), endMin: minutesOfDay(b.end_time) }));

  return { hasLectures: true, shortfalls, prayerFlags: flagPrayersInLectures(prayers, lectures) };
}
