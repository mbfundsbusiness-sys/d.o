import type { SupabaseClient } from '@supabase/supabase-js';
import { diffFromDefaults, resolveRules, type Rules } from '@/lib/rules';
import { assembleDay, type DayView } from '@/lib/schedule/day';
import type { PlanItem, ScheduleBlock, TodoItem, UserSettings, WorkShift } from '@/lib/supabase/types';

export async function loadRules(db: SupabaseClient, userId: string): Promise<Rules> {
  const { data } = await db.from('assistant_settings').select('rules').eq('user_id', userId).maybeSingle();
  return resolveRules(data?.rules);
}

export async function saveRules(db: SupabaseClient, userId: string, rules: Rules): Promise<string | null> {
  const { error } = await db
    .from('assistant_settings')
    .upsert({ user_id: userId, rules: diffFromDefaults(rules), updated_at: new Date().toISOString() });
  if (error) return error.message;
  // The minute-by-minute alert job still reads the wake time from the weekly template.
  await db
    .from('schedule_blocks')
    .update({ start_time: rules.wake.default, end_time: addMinutes(rules.wake.default, 15) })
    .eq('user_id', userId)
    .ilike('label', 'wake%');
  return null;
}

function addMinutes(hm: string, mins: number): string {
  const [h, m] = hm.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

async function prayerTimesFor(db: SupabaseClient, dateISO: string): Promise<Record<string, string>> {
  const { data } = await db.from('prayer_time_cache').select('fajr, dhuhr, asr, maghrib, isha').eq('date', dateISO).maybeSingle();
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data ?? {})) if (typeof v === 'string') out[k] = v.slice(0, 5);
  return out;
}

export async function loadDay(db: SupabaseClient, userId: string, dateISO: string, rules?: Rules): Promise<DayView> {
  const [r, blocks, settings, shifts, prayers, plan, todos] = await Promise.all([
    rules ?? loadRules(db, userId),
    db.from('schedule_blocks').select('*').eq('user_id', userId).is('archived_at', null),
    db.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    db.from('work_shifts').select('*').eq('user_id', userId).eq('shift_date', dateISO),
    prayerTimesFor(db, dateISO),
    db.from('plan_items').select('*').eq('user_id', userId).eq('plan_date', dateISO),
    db.from('todo_items').select('*').eq('user_id', userId).eq('completed', false).order('due_at', { ascending: true, nullsFirst: false }).limit(100),
  ]);
  return assembleDay(
    {
      date: dateISO,
      blocks: (blocks.data ?? []) as ScheduleBlock[],
      settings: (settings.data ?? null) as UserSettings | null,
      shifts: (shifts.data ?? []) as WorkShift[],
      prayerTimes: prayers,
      plan: (plan.data ?? []) as PlanItem[],
      todos: (todos.data ?? []) as TodoItem[],
    },
    r
  );
}

export async function openTodos(db: SupabaseClient, userId: string): Promise<TodoItem[]> {
  const { data } = await db
    .from('todo_items')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(50);
  return (data ?? []) as TodoItem[];
}

export async function upcomingShifts(db: SupabaseClient, userId: string, fromISO: string, toISO: string): Promise<WorkShift[]> {
  const { data } = await db
    .from('work_shifts')
    .select('*')
    .eq('user_id', userId)
    .gte('shift_date', fromISO)
    .lte('shift_date', toISO)
    .order('shift_date')
    .order('start_time');
  return (data ?? []) as WorkShift[];
}
