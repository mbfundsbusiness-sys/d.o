import type { SupabaseClient } from '@supabase/supabase-js';
import type { PrayerTimesOfDay } from '@/app/api/prayer/times/route';
import { minutesOfDay, minutesToHM } from '@/lib/utils/dates';

const PRAYER_DURATION_MIN = 15;
const PRAYER_LABELS: { key: keyof Omit<PrayerTimesOfDay, 'sunrise'>; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

/**
 * Registers (or refreshes) one recurring_commitments row per daily prayer —
 * every day, 15 min, preferred_start_time set to today's calculated time
 * (illustrative in the commitments list; actual placement below writes
 * exact times directly rather than going through the generic slot-finder,
 * since prayer times are fixed externally, not "fit somewhere today").
 */
async function registerPrayerCommitments(
  supabase: SupabaseClient,
  userId: string,
  times: PrayerTimesOfDay
): Promise<void> {
  const { data: existing } = await supabase
    .from('recurring_commitments')
    .select('id, label')
    .eq('user_id', userId)
    .eq('activity_type', 'prayer');

  const existingByLabel = new Map((existing ?? []).map((c: { id: string; label: string }) => [c.label, c.id]));

  for (const { key, label } of PRAYER_LABELS) {
    const existingId = existingByLabel.get(label);
    const fields = {
      activity_type: 'prayer' as const,
      label,
      target_duration_min: PRAYER_DURATION_MIN,
      applies_days: [0, 1, 2, 3, 4, 5, 6],
      preferred_start_time: times[key],
      priority: 8,
      active: true,
    };
    if (existingId) {
      await supabase.from('recurring_commitments').update(fields).eq('id', existingId);
    } else {
      await supabase.from('recurring_commitments').insert({ user_id: userId, ...fields });
    }
  }
}

/**
 * Writes today's 5 prayer blocks directly (not through the generic
 * gap-finding scheduler — the times are fixed by calculation, not
 * negotiable against other commitments). Only ever touches this day's
 * source='auto' + activity_type='prayer' rows; the Friday Jummah override
 * in lib/schedule/effective.ts is unchanged and now overrides this real
 * Dhuhr block instead of a synthetic one.
 */
export async function syncPrayerSchedule(
  supabase: SupabaseClient,
  userId: string,
  dayOfWeek: number,
  times: PrayerTimesOfDay
): Promise<void> {
  await registerPrayerCommitments(supabase, userId, times);

  const { data: existingBlocks } = await supabase
    .from('schedule_blocks')
    .select('id')
    .eq('user_id', userId)
    .eq('day_of_week', dayOfWeek)
    .eq('source', 'auto')
    .eq('activity_type', 'prayer');

  const staleIds = (existingBlocks ?? []).map((b: { id: string }) => b.id);
  if (staleIds.length > 0) {
    await supabase.from('schedule_blocks').delete().in('id', staleIds);
  }

  const inserts = PRAYER_LABELS.map(({ key, label }) => {
    const startMin = minutesOfDay(times[key]);
    return {
      user_id: userId,
      day_of_week: dayOfWeek,
      activity_type: 'prayer',
      start_time: minutesToHM(startMin),
      end_time: minutesToHM(startMin + PRAYER_DURATION_MIN),
      label,
      source: 'auto',
    };
  });

  await supabase.from('schedule_blocks').insert(inserts);
}
