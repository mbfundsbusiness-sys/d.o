import type { SupabaseClient } from '@supabase/supabase-js';

// Phase 1 sizing: how many lessons fill a module, and how many modules fill
// a unit, before the next one is auto-created. Purely structural — no
// mastery/performance gating yet (that's a later phase).
const LESSONS_PER_GROUP = 4;
const GROUPS_PER_UNIT = 3;

/**
 * Returns the lesson_group_id that a newly created lesson (language_modules
 * row) for this user+language should be attached to — creating Unit 1 /
 * Module 1 if none exist yet, or rolling over to a new module/unit once the
 * current one is full. Used by both the initial curriculum generation and
 * the adaptive next-module route so the hierarchy stays consistent no
 * matter which one is creating the lesson.
 */
export async function getActiveLessonGroupId(
  supabaseServer: SupabaseClient,
  userId: string,
  language: string
): Promise<string> {
  const { data: latestGroups } = await supabaseServer
    .from('lang_lesson_groups')
    .select('id, group_number, unit_id')
    .eq('user_id', userId)
    .eq('language', language)
    .order('group_number', { ascending: false })
    .limit(1);

  const latest = latestGroups?.[0];

  if (!latest) {
    return createFirstUnitAndGroup(supabaseServer, userId, language);
  }

  const { count } = await supabaseServer
    .from('language_modules')
    .select('id', { count: 'exact', head: true })
    .eq('lesson_group_id', latest.id);

  if ((count ?? 0) < LESSONS_PER_GROUP) {
    return latest.id;
  }

  return createNextLessonGroup(supabaseServer, userId, language, latest.unit_id);
}

async function createFirstUnitAndGroup(
  supabaseServer: SupabaseClient,
  userId: string,
  language: string
): Promise<string> {
  const { data: unit, error: unitError } = await supabaseServer
    .from('lang_units')
    .insert({ user_id: userId, language, unit_number: 1, title: 'Unit 1' })
    .select()
    .single();
  if (unitError || !unit) throw new Error(unitError?.message || 'Failed to create unit');

  const { data: group, error: groupError } = await supabaseServer
    .from('lang_lesson_groups')
    .insert({ user_id: userId, language, unit_id: unit.id, group_number: 1, title: 'Module 1' })
    .select()
    .single();
  if (groupError || !group) throw new Error(groupError?.message || 'Failed to create module');

  return group.id;
}

async function createNextLessonGroup(
  supabaseServer: SupabaseClient,
  userId: string,
  language: string,
  currentUnitId: string
): Promise<string> {
  const { count: groupsInUnit } = await supabaseServer
    .from('lang_lesson_groups')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', currentUnitId);

  let unitId = currentUnitId;
  let groupNumber = (groupsInUnit ?? 0) + 1;

  if (groupNumber > GROUPS_PER_UNIT) {
    const { data: units } = await supabaseServer
      .from('lang_units')
      .select('unit_number')
      .eq('user_id', userId)
      .eq('language', language)
      .order('unit_number', { ascending: false })
      .limit(1);
    const nextUnitNumber = (units?.[0]?.unit_number ?? 0) + 1;

    const { data: newUnit, error: unitError } = await supabaseServer
      .from('lang_units')
      .insert({ user_id: userId, language, unit_number: nextUnitNumber, title: `Unit ${nextUnitNumber}` })
      .select()
      .single();
    if (unitError || !newUnit) throw new Error(unitError?.message || 'Failed to create unit');

    unitId = newUnit.id;
    groupNumber = 1;
  }

  const { data: group, error: groupError } = await supabaseServer
    .from('lang_lesson_groups')
    .insert({ user_id: userId, language, unit_id: unitId, group_number: groupNumber, title: `Module ${groupNumber}` })
    .select()
    .single();
  if (groupError || !group) throw new Error(groupError?.message || 'Failed to create module');

  return group.id;
}
