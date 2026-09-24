import type { SupabaseClient } from '@supabase/supabase-js';
import { regenerateAutoBlocksForDays } from '@/lib/schedule/auto-scheduler';

const ACTIVITY_TYPES = ['trading', 'botcouncil', 'reading', 'custom', 'gym', 'language', 'course', 'prayer'];
const ACTIONS_RE = /```actions\s*([\s\S]*?)```/i;

type Fields = {
  label?: string;
  activity_type?: string;
  duration_min?: number;
  days?: number[];
  start?: string | null;
  priority?: number;
  fixed?: boolean;
  active?: boolean;
};
type Action =
  | ({ op: 'add' } & Fields)
  | ({ op: 'update'; id: string } & Fields)
  | { op: 'delete'; id: string };

function validDays(d: unknown): d is number[] {
  return Array.isArray(d) && d.length > 0 && d.every((x) => Number.isInteger(x) && x >= 0 && x <= 6);
}
function validTime(t: unknown): t is string {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

function toRow(f: Fields): { row: Record<string, unknown>; error?: string } {
  const row: Record<string, unknown> = {};
  if (f.label !== undefined) {
    if (typeof f.label !== 'string' || !f.label.trim()) return { row, error: 'invalid label' };
    row.label = f.label.trim();
  }
  if (f.activity_type !== undefined) {
    if (!ACTIVITY_TYPES.includes(f.activity_type)) return { row, error: 'invalid activity_type' };
    row.activity_type = f.activity_type;
  }
  if (f.duration_min !== undefined) {
    if (!Number.isInteger(f.duration_min) || f.duration_min < 1 || f.duration_min > 720) return { row, error: 'invalid duration' };
    row.target_duration_min = f.duration_min;
  }
  if (f.days !== undefined) {
    if (!validDays(f.days)) return { row, error: 'invalid days' };
    row.applies_days = Array.from(new Set(f.days)).sort();
  }
  if (f.start !== undefined) {
    if (f.start !== null && !validTime(f.start)) return { row, error: 'invalid start time' };
    row.preferred_start_time = f.start;
  }
  if (f.priority !== undefined) {
    if (!Number.isInteger(f.priority) || f.priority < 1 || f.priority > 10) return { row, error: 'invalid priority' };
    row.priority = f.priority;
  }
  if (f.fixed !== undefined) row.fixed = !!f.fixed;
  if (f.active !== undefined) row.active = !!f.active;
  return { row };
}

/** Pulls the ```actions block out of a model reply and returns the visible text + parsed actions. */
export function extractActions(text: string): { text: string; actions: Action[] | null } {
  const m = text.match(ACTIONS_RE);
  if (!m) return { text, actions: null };
  const visible = text.replace(ACTIONS_RE, '').trim();
  try {
    const parsed = JSON.parse(m[1]);
    return { text: visible, actions: Array.isArray(parsed) ? parsed : null };
  } catch {
    return { text: visible, actions: null };
  }
}

/** Applies commitment changes for one user, then regenerates the affected days. Returns human-readable results. */
export async function applyScheduleActions(
  supabase: SupabaseClient,
  userId: string,
  actions: Action[]
): Promise<string[]> {
  const results: string[] = [];
  const affectedDays = new Set<number>();

  for (const a of actions.slice(0, 10)) {
    if (a.op === 'add') {
      if (!a.label || !a.activity_type || !a.duration_min || !a.days) {
        results.push('Could not add a block: missing label, type, duration or days.');
        continue;
      }
      const { row, error } = toRow(a);
      if (error) { results.push(`Could not add "${a.label}": ${error}.`); continue; }
      const { error: dbErr } = await supabase.from('recurring_commitments').insert({ ...row, user_id: userId });
      if (dbErr) { results.push(`Could not add "${a.label}".`); continue; }
      (row.applies_days as number[]).forEach((d) => affectedDays.add(d));
      results.push(`Added "${a.label}".`);
    } else if (a.op === 'update' || a.op === 'delete') {
      const { data: existing } = await supabase
        .from('recurring_commitments').select('*').eq('id', a.id).eq('user_id', userId).maybeSingle();
      if (!existing) { results.push('Could not find that commitment.'); continue; }
      (existing.applies_days as number[]).forEach((d) => affectedDays.add(d));
      if (a.op === 'delete') {
        const { error: dbErr } = await supabase.from('recurring_commitments').delete().eq('id', a.id).eq('user_id', userId);
        results.push(dbErr ? `Could not delete "${existing.label}".` : `Deleted "${existing.label}".`);
      } else {
        const { row, error } = toRow(a);
        if (error) { results.push(`Could not update "${existing.label}": ${error}.`); continue; }
        if (Object.keys(row).length === 0) continue;
        const { error: dbErr } = await supabase.from('recurring_commitments').update(row).eq('id', a.id).eq('user_id', userId);
        if (dbErr) { results.push(`Could not update "${existing.label}".`); continue; }
        ((row.applies_days as number[] | undefined) ?? []).forEach((d) => affectedDays.add(d));
        results.push(`Updated "${existing.label}".`);
      }
    }
  }

  if (affectedDays.size > 0) {
    await regenerateAutoBlocksForDays(supabase, userId, Array.from(affectedDays));
  }
  return results;
}
