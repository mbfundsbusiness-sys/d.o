'use client';

import { useEffect, useState } from 'react';
import { supabase, type PrayerLog, type PrayerName } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/provider';
import type { PrayerTimesOfDay } from '@/app/api/prayer/times/route';
import { todayISO, londonNow, fmtHM } from '@/lib/utils/dates';
import { DashCard } from '@/components/ui/glass-card';
import { Moon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRAYERS: { name: PrayerName; label: string }[] = [
  { name: 'fajr', label: 'Fajr' }, { name: 'dhuhr', label: 'Dhuhr' }, { name: 'asr', label: 'Asr' },
  { name: 'maghrib', label: 'Maghrib' }, { name: 'isha', label: 'Isha' },
];

export function PrayerCard() {
  const { user } = useAuth();
  const [times, setTimes] = useState<PrayerTimesOfDay | null>(null);
  const [logs, setLogs] = useState<PrayerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const today = todayISO();
        const [timesRes, logsRes] = await Promise.all([
          accessToken ? fetch(`/api/prayer/times?date=${today}`, { headers: { Authorization: `Bearer ${accessToken}` } }) : null,
          supabase.from('prayer_logs').select('*').eq('log_date', today),
        ]);
        if (timesRes) {
          const data = await timesRes.json();
          if (timesRes.ok) setTimes(data.times);
        }
        if (logsRes.error) setError(logsRes.error.message);
        setLogs(logsRes.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const completed = new Set(logs.filter((l) => l.completed).map((l) => l.prayer_name));
  const nowMin = londonNow().minutesOfDay;
  const next = PRAYERS.find((p) => {
    const t = times?.[p.name];
    if (!t) return false;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m > nowMin;
  });

  return (
    <DashCard title="Prayer" icon={Moon} href="/app/prayer" loading={loading} error={error}>
      <div className="space-y-3">
        {next && times?.[next.name] && (
          <p className="text-sm font-medium">
            Next: {next.label} at {fmtHM(times[next.name]!)}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {PRAYERS.map((p) => {
            const done = completed.has(p.name);
            return (
              <span
                key={p.name}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]',
                  done ? 'bg-foreground text-background' : 'bg-foreground/10 text-muted-foreground'
                )}
              >
                {done && <Check className="h-2.5 w-2.5" />}
                {p.label}
              </span>
            );
          })}
        </div>
      </div>
    </DashCard>
  );
}
