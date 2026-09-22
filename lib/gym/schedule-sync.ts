import type { SupabaseClient } from '@supabase/supabase-js';
import { regenerateAutoBlocksForDays } from '@/lib/schedule/auto-scheduler';

const GYM_SESSION_DURATION_MIN = 60;

// Sensible spreads when a plain days_per_week count is all that's available
// (e.g. an assessment taken before training_days existed) — evenly spaced
// rather than clumped at the start of the week.
const DEFAULT_SPREADS: Record<number, number[]> = {
  1: [3],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function defaultTrainingDays(daysPerWeek: number): number[] {
  return DEFAULT_SPREADS[daysPerWeek] ?? DEFAULT_SPREADS[3];
}

/**
 * Registers (or updates) the user's single "Gym" recurring_commitments row
 * from whatever training days their current assessment/plan implies, then
 * regenerates the auto blocks for every day that could be affected —
 * called after gym plan generation, per the scheduling architecture (gym
 * is a registrant like every other module, not a special case).
 */
export async function syncGymCommitment(
  supabase: SupabaseClient,
  userId: string,
  trainingDays: number[]
): Promise<void> {
  if (!trainingDays || trainingDays.length === 0) return;

  const { data: existing } = await supabase
    .from('recurring_commitments')
    .select('id, applies_days')
    .eq('user_id', userId)
    .eq('activity_type', 'gym')
    .limit(1)
    .maybeSingle();

  const affectedDays = Array.from(new Set([...(existing?.applies_days ?? []), ...trainingDays]));

  if (existing) {
    await supabase
      .from('recurring_commitments')
      .update({
        applies_days: trainingDays,
        target_duration_min: GYM_SESSION_DURATION_MIN,
        active: true,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('recurring_commitments').insert({
      user_id: userId,
      activity_type: 'gym',
      label: 'Gym session',
      target_duration_min: GYM_SESSION_DURATION_MIN,
      applies_days: trainingDays,
      priority: 5,
      active: true,
    });
  }

  await regenerateAutoBlocksForDays(supabase, userId, affectedDays);
}
