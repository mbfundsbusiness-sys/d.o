'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, type PrayerLog, type PrayerName } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Flame, Sunrise, Sun, Sunset, Moon, CloudSun } from 'lucide-react';
import { todayISO, formatDateUK, fmtHM } from '@/lib/utils/dates';
import { cn } from '@/lib/utils';
import { useUserSettings } from '@/lib/settings/use-user-settings';
import Link from 'next/link';

const PRAYERS: { name: PrayerName; label: string; icon: typeof Sunrise }[] = [
  { name: 'fajr', label: 'Fajr', icon: Sunrise },
  { name: 'dhuhr', label: 'Dhuhr', icon: Sun },
  { name: 'asr', label: 'Asr', icon: CloudSun },
  { name: 'maghrib', label: 'Maghrib', icon: Sunset },
  { name: 'isha', label: 'Isha', icon: Moon },
];

export default function PrayerPage() {
  const [logs, setLogs] = useState<PrayerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const { settings: userSettings } = useUserSettings();

  const today = todayISO();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('prayer_logs')
      .select('*')
      .order('log_date', { ascending: false })
      .order('prayer_name', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setLogs(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Today's prayer states
  const todayPrayers = useMemo(() => {
    const todayLogs = logs.filter(l => l.log_date === today);
    const map = new Map<PrayerName, boolean>();
    for (const p of PRAYERS) {
      const log = todayLogs.find(l => l.prayer_name === p.name);
      map.set(p.name, log?.completed ?? false);
    }
    return map;
  }, [logs, today]);

  const todayCompletedCount = Array.from(todayPrayers.values()).filter(Boolean).length;

  // Streak: consecutive days where all 5 prayers completed
  const streak = useMemo(() => {
    const dayMap = new Map<string, Set<PrayerName>>();
    for (const log of logs) {
      if (!dayMap.has(log.log_date)) dayMap.set(log.log_date, new Set());
      if (log.completed) dayMap.get(log.log_date)!.add(log.prayer_name);
    }

    const todayDate = new Date(today + 'T00:00:00');
    const yesterdayDate = new Date(today + 'T00:00:00');
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    // Start from today if all 5 done, or yesterday
    let cursor = todayDate;
    if (!dayMap.has(today) || dayMap.get(today)!.size < 5) {
      cursor = yesterdayDate;
    }

    let count = 0;
    while (true) {
      const cursorStr = cursor.toISOString().slice(0, 10);
      const prayers = dayMap.get(cursorStr);
      if (prayers && prayers.size >= 5) {
        count++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [logs, today]);

  // Last 7 days history
  const weekHistory = useMemo(() => {
    const days: { date: string; completed: number; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLogs = logs.filter(l => l.log_date === dateStr && l.completed);
      days.push({ date: dateStr, completed: dayLogs.length, total: 5 });
    }
    return days;
  }, [logs]);

  async function togglePrayer(name: PrayerName) {
    setToggling(name);
    setError(null);

    const existing = logs.find(l => l.log_date === today && l.prayer_name === name);

    try {
      if (existing) {
        // Toggle
        const newCompleted = !existing.completed;
        const { error: updateError } = await supabase
          .from('prayer_logs')
          .update({
            completed: newCompleted,
            completed_at: newCompleted ? new Date().toISOString() : null,
          })
          .eq('id', existing.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('prayer_logs')
          .insert({
            log_date: today,
            prayer_name: name,
            completed: true,
            completed_at: new Date().toISOString(),
          });

        if (insertError) throw new Error(insertError.message);
      }

      await fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prayer</h1>
        <p className="text-sm text-muted-foreground">
          Log your five daily prayers. This is a consistency tracker — tap to mark each prayer as done.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          This is a logging tool for tracking consistency — not an alert system.
          A web app can't reliably send notifications while your phone is locked.
          Use it to check in and record, not to be reminded.
        </p>
        {!userSettings?.prayer_times || Object.keys(userSettings.prayer_times).length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Want your prayer times shown here (and included in the in-app schedule alerts)?{' '}
            <Link href="/app/settings" className="underline underline-offset-2 hover:text-foreground">
              Set them in Settings
            </Link>
            .
          </p>
        ) : null}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Streak + today summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Current streak</span>
              <Flame className={cn('h-4 w-4', streak > 0 ? 'text-warning' : 'text-muted-foreground')} />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{streak}</p>
            <p className="text-xs text-muted-foreground">{streak === 1 ? 'day' : 'days'} · all 5 logged</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Today</span>
              <span className="text-xs tabular-nums text-muted-foreground">{todayCompletedCount}/5</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{todayCompletedCount}/5</p>
            <p className="text-xs text-muted-foreground">prayers logged</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Date</span>
            </div>
            <p className="mt-2 text-sm font-medium">{formatDateUK(today)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's prayers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Today's prayers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PRAYERS.map((p) => {
              const Icon = p.icon;
              const isDone = todayPrayers.get(p.name) ?? false;
              const isToggling = toggling === p.name;
              return (
                <button
                  key={p.name}
                  onClick={() => togglePrayer(p.name)}
                  disabled={isToggling}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                    isDone
                      ? 'border-success bg-success/5'
                      : 'border-border hover:border-primary/40 hover:bg-accent/5',
                    isToggling && 'opacity-50'
                  )}
                >
                  <div className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
                    isDone ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'
                  )}>
                    {isToggling ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isDone ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={cn(
                    'text-sm font-medium',
                    isDone ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {p.label}
                  </span>
                  {userSettings?.prayer_times?.[p.name] && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmtHM(userSettings.prayer_times[p.name]!)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Last 7 days */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Last 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {weekHistory.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <span className="w-20 text-xs text-muted-foreground">{formatDateUK(day.date)}</span>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-2 flex-1 rounded-full',
                        i < day.completed ? 'bg-success/60' : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
                <Badge variant={day.completed === 5 ? 'default' : 'secondary'} className="text-[10px] w-8 justify-center">
                  {day.completed}/5
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
