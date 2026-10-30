import type { SupabaseClient } from '@supabase/supabase-js';
import type { Rules } from '@/lib/rules';
import { computeLedger, type Ledger } from '@/lib/rewards/ledger';
import { LEARN_DAYS, learnPatterns, type HistoryRow, type Patterns } from '@/lib/schedule/learn';
import { addDaysISO, londonNow } from '@/lib/utils/dates';

// Phase 4: what the plan history says. The ledger (earned free time and the
// streak) covers all history; the learned patterns cover the last few weeks.

export type Reward = { id: string; title: string; cost_min: number };
export type Progress = { ledger: Ledger; patterns: Patterns; rewards: Reward[] };

export async function loadProgress(db: SupabaseClient, userId: string, rules: Rules): Promise<Progress> {
  const now = londonNow();
  const since = addDaysISO(now.dateISO, -LEARN_DAYS);
  const [plan, shifts, spent, rewards] = await Promise.all([
    db.from('plan_items').select('plan_date, start_time, end_time, kind, status').eq('user_id', userId).lte('plan_date', now.dateISO).limit(10000),
    db.from('work_shifts').select('shift_date').eq('user_id', userId).gte('shift_date', since).lte('shift_date', now.dateISO),
    db.from('reward_redemptions').select('cost_min').eq('user_id', userId).limit(10000),
    db.from('rewards').select('id, title, cost_min').eq('user_id', userId).eq('active', true).order('cost_min'),
  ]);
  const rows = (plan.data ?? []) as HistoryRow[];
  const shiftDates = new Set((shifts.data ?? []).map((s: { shift_date: string }) => s.shift_date));
  return {
    ledger: computeLedger(rows, (spent.data ?? []) as { cost_min: number }[], rules, now.dateISO, now.minutesOfDay),
    patterns: learnPatterns(
      rows.filter((r) => r.plan_date >= since),
      shiftDates,
      now.dateISO,
      now.minutesOfDay
    ),
    rewards: (rewards.data ?? []) as Reward[],
  };
}

export function describeRewards(rewards: Reward[]): string {
  return rewards.length ? rewards.map((r) => `${r.title} (${r.cost_min} min) id=${r.id}`).join('; ') : 'none set up yet';
}
