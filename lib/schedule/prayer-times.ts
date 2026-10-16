import { supabase } from '@/lib/supabase/client';

export type DayPrayerTimes = Partial<Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', string>>;

/** Today's real prayer times (London), kept fresh in prayer_time_cache by a database job. */
export async function fetchPrayerTimes(dateISO: string): Promise<DayPrayerTimes> {
  const { data } = await supabase.from('prayer_time_cache').select('fajr, dhuhr, asr, maghrib, isha').eq('date', dateISO).maybeSingle();
  if (!data) return {};
  const out: DayPrayerTimes = {};
  for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
    const v = (data as Record<string, string | null>)[k];
    if (v) out[k] = v.slice(0, 5);
  }
  return out;
}
