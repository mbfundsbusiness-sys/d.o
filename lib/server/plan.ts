import type { SupabaseClient } from '@supabase/supabase-js';
import type { Rules } from '@/lib/rules';
import { planDay, type PlanResult } from '@/lib/schedule/planner';
import { mondayOf } from '@/lib/schedule/shifts';
import { addDaysISO, londonNow, minutesToHM } from '@/lib/utils/dates';
import { loadDay, openTodos } from '@/lib/server/data';
import { studyInputs } from '@/lib/server/scholarship';
import { loadProgress } from '@/lib/server/progress';

/**
 * (Re)plans one day. The EA's own not-yet-started blocks are replaced; anything
 * done, anything the user placed, and anything already under way stays put.
 */
export async function replanDay(db: SupabaseClient, userId: string, date: string, rules: Rules): Promise<PlanResult> {
  const now = londonNow();
  const isToday = date === now.dateISO;
  const fromMin = isToday ? now.minutesOfDay + 5 : 0;

  let clear = db.from('plan_items').delete().eq('user_id', userId).eq('plan_date', date).eq('source', 'ea').eq('status', 'planned');
  if (isToday) clear = clear.gte('start_time', minutesToHM(fromMin));
  await clear;

  const monday = mondayOf(date);
  const [day, todos, studied, gym, progress] = await Promise.all([
    loadDay(db, userId, date, rules),
    openTodos(db, userId),
    studyInputs(db, userId, date),
    db
      .from('plan_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', 'gym')
      .in('status', ['planned', 'done'])
      .gte('plan_date', monday)
      .lte('plan_date', addDaysISO(monday, 6))
      .neq('plan_date', date),
    rules.autopilot.learn_windows ? loadProgress(db, userId, rules) : Promise.resolve(null),
  ]);

  const learned = progress ? { prefer: progress.patterns.prefer, avoid: progress.patterns.avoid } : undefined;
  const result = planDay({ day, rules, todos, gymSessionsThisWeek: gym.count ?? 0, fromMin, ...studied, learned });
  if (result.items.length) {
    await db.from('plan_items').insert(
      result.items.map((p) => ({
        user_id: userId,
        plan_date: date,
        start_time: p.start,
        end_time: p.end,
        title: p.title,
        kind: p.kind,
        todo_id: p.todo_id ?? null,
        module_key: p.module_key ?? null,
        source: 'ea',
      }))
    );
  }
  return result;
}
