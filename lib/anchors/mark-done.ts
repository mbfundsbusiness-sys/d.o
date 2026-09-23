import { supabase, type AnchorBooleanField, type ActivityKind } from '@/lib/supabase/client';
import { todayISO } from '@/lib/utils/dates';

// Which activity kinds have a matching anchor field, and which don't.
// course/job_search deliberately have no mapping — no anchor item exists
// for them (matches the existing anchor_logs shape; not silently invented).
const KIND_TO_ANCHOR_FIELD: Partial<Record<ActivityKind, AnchorBooleanField>> = {
  trading: 'trading_in_plan',
  reading: 'reading_done',
  gym: 'gym_done',
  language: 'language_done',
};

export function anchorFieldForKind(kind: ActivityKind): AnchorBooleanField | null {
  return KIND_TO_ANCHOR_FIELD[kind] ?? null;
}

/**
 * Marks one boolean field on today's anchor log. Updates the most recent
 * row for today if one exists (anchor_logs allows multiple rows per day —
 * the streak logic already treats "any row that day" as the source of
 * truth), otherwise inserts a fresh row carrying just this field.
 */
export async function markAnchorField(field: AnchorBooleanField, value: boolean): Promise<void> {
  const today = todayISO();

  const { data: existing } = await supabase
    .from('anchor_logs')
    .select('id')
    .eq('log_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase.from('anchor_logs').update({ [field]: value }).eq('id', existing.id);
  } else {
    await supabase.from('anchor_logs').insert({ log_date: today, [field]: value });
  }
}

/** Marks the anchor field matching an activity kind, if one exists — a no-op otherwise. */
export async function markAnchorForKind(kind: ActivityKind, value: boolean): Promise<void> {
  const field = anchorFieldForKind(kind);
  if (!field) return;
  await markAnchorField(field, value);
}
