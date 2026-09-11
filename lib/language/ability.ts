import type { SupabaseClient } from '@supabase/supabase-js';

/** Ability (0-100) -> a starting difficulty (1-5) to anchor question generation on. */
export function difficultyFromAbility(ability: number): number {
  return Math.min(5, Math.max(1, Math.round(ability / 20) + 1));
}

export async function getAbility(
  supabaseServer: SupabaseClient,
  userId: string,
  language: string,
  focusArea: string
): Promise<number> {
  const { data } = await supabaseServer
    .from('lang_skill_ability')
    .select('ability')
    .eq('user_id', userId)
    .eq('language', language)
    .eq('focus_area', focusArea)
    .maybeSingle();

  return data ? Number(data.ability) : 50;
}

/**
 * Nudges the stored ability after one answer. Not a calibrated IRT model —
 * a simple, transparent rule: a correct answer at a harder question moves
 * ability up more than an easy one; a wrong answer moves it down more the
 * harder the question was expected to be trivial. Clamped to [0, 100].
 */
export async function updateAbilityAfterAnswer(
  supabaseServer: SupabaseClient,
  userId: string,
  language: string,
  focusArea: string,
  questionDifficulty: number,
  correct: boolean
): Promise<number> {
  const current = await getAbility(supabaseServer, userId, language, focusArea);
  const magnitude = 2 + questionDifficulty; // harder questions move the needle more
  const delta = correct ? magnitude : -magnitude;
  const next = Math.min(100, Math.max(0, current + delta));

  await supabaseServer.from('lang_skill_ability').upsert(
    {
      user_id: userId,
      language,
      focus_area: focusArea,
      ability: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,language,focus_area' }
  );

  return next;
}

export type DifficultyTrend = 'up' | 'down' | 'hold';

/**
 * Reads recent attempts for a lesson to decide whether difficulty should
 * step up, down, or hold, per the spec's adaptive rules:
 * - 2+ correct in a row at the last difficulty -> step up
 * - 3 wrong in a row -> step down
 * - otherwise -> hold at the last question's difficulty
 */
export async function getDifficultyTrend(
  supabaseServer: SupabaseClient,
  lessonId: string
): Promise<DifficultyTrend> {
  const { data: recent } = await supabaseServer
    .from('lang_question_attempts')
    .select('is_correct')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!recent || recent.length === 0) return 'hold';

  const flags = recent.map((r) => r.is_correct as boolean);

  if (flags.length >= 3 && flags[0] === false && flags[1] === false && flags[2] === false) {
    return 'down';
  }
  if (flags.length >= 2 && flags[0] === true && flags[1] === true) {
    return 'up';
  }
  return 'hold';
}
