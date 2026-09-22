import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Central London — close enough that no user-specific location input is
// needed; prayer times vary by seconds across Greater London, not minutes.
const LATITUDE = 51.5074;
const LONGITUDE = -0.1278;
// Moonsighting Committee Worldwide — recommended for UK use.
const CALCULATION_METHOD = 15;

export type PrayerTimesOfDay = {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

function toDDMMYYYY(dateISO: string): string {
  const [y, m, d] = dateISO.split('-');
  return `${d}-${m}-${y}`;
}

/** Aladhan returns times like "13:05 (BST)" — keep just the HH:mm. */
function stripTz(value: string): string {
  return value.split(' ')[0];
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseServer = getSupabaseServer();
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dateISO = req.nextUrl.searchParams.get('date');
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return NextResponse.json({ error: 'date=YYYY-MM-DD required' }, { status: 400 });
    }

    const { data: cached } = await supabaseServer
      .from('prayer_time_cache')
      .select('*')
      .eq('date', dateISO)
      .maybeSingle();

    if (cached) {
      const times: PrayerTimesOfDay = {
        fajr: cached.fajr,
        sunrise: cached.sunrise,
        dhuhr: cached.dhuhr,
        asr: cached.asr,
        maghrib: cached.maghrib,
        isha: cached.isha,
      };
      return NextResponse.json({ times, cached: true });
    }

    const url = `https://api.aladhan.com/v1/timings/${toDDMMYYYY(dateISO)}?latitude=${LATITUDE}&longitude=${LONGITUDE}&method=${CALCULATION_METHOD}&timezonestring=Europe/London`;

    let apiTimings: Record<string, string>;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Aladhan responded ${res.status}`);
      const json = await res.json();
      apiTimings = json?.data?.timings;
      if (!apiTimings) throw new Error('No timings in response');
    } catch (err) {
      console.error('Prayer time calculation fetch failed:', err);
      return NextResponse.json({ error: 'Prayer time calculation service unavailable' }, { status: 502 });
    }

    const times: PrayerTimesOfDay = {
      fajr: stripTz(apiTimings.Fajr),
      sunrise: stripTz(apiTimings.Sunrise),
      dhuhr: stripTz(apiTimings.Dhuhr),
      asr: stripTz(apiTimings.Asr),
      maghrib: stripTz(apiTimings.Maghrib),
      isha: stripTz(apiTimings.Isha),
    };

    await supabaseServer.from('prayer_time_cache').upsert(
      {
        date: dateISO,
        fajr: times.fajr,
        sunrise: times.sunrise,
        dhuhr: times.dhuhr,
        asr: times.asr,
        maghrib: times.maghrib,
        isha: times.isha,
      },
      { onConflict: 'date' }
    );

    return NextResponse.json({ times, cached: false });
  } catch (err) {
    console.error('Prayer times error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
