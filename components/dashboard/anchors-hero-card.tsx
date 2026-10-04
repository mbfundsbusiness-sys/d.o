'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type AnchorLog } from '@/lib/supabase/client';
import { computeAnchorStreak } from '@/lib/utils/streaks';
import { markAnchorField } from '@/lib/anchors/mark-done';
import { todayISO } from '@/lib/utils/dates';
import { GlassCard } from '@/components/ui/glass-card';
import { Ring } from '@/components/ui/ring';
import { Check, Flame, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHECKS: { field: keyof AnchorLog; label: string }[] = [
  { field: 'wake_time', label: 'Woke up on time' },
  { field: 'trading_in_plan', label: 'Trading in plan' },
  { field: 'botcouncil_checked', label: 'BotCouncil checked' },
  { field: 'reading_done', label: 'Reading' },
  { field: 'gym_done', label: 'Gym' },
  { field: 'language_done', label: 'Language' },
];

export function AnchorsHeroCard() {
  const [logs, setLogs] = useState<AnchorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('anchor_logs')
        .select('*')
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) setError(error.message);
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, []);

  const today = todayISO();
  const todayLog = logs.find((l) => l.log_date === today) ?? null;
  const streak = computeAnchorStreak(logs);
  const doneCount = CHECKS.filter((c) => !!todayLog?.[c.field]).length;

  async function toggle(field: keyof AnchorLog) {
    if (field === 'wake_time') {
      const value = todayLog?.wake_time ? null : new Date().toTimeString().slice(0, 5);
      if (todayLog) {
        await supabase.from('anchor_logs').update({ wake_time: value }).eq('id', todayLog.id);
      } else {
        await supabase.from('anchor_logs').insert({ log_date: today, wake_time: value });
      }
    } else {
      await markAnchorField(field as 'trading_in_plan' | 'botcouncil_checked' | 'reading_done' | 'gym_done' | 'language_done', !todayLog?.[field]);
    }
    const { data } = await supabase.from('anchor_logs').select('*').order('log_date', { ascending: false }).order('created_at', { ascending: false });
    setLogs(data ?? []);
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Today&apos;s Anchors</h3>
        <Link href="/app/anchors" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          View <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-foreground/5" />
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Ring value={doneCount} max={CHECKS.length} />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Flame className={cn('h-3.5 w-3.5', streak > 0 && 'text-foreground')} />
              {streak} day{streak === 1 ? '' : 's'} streak
            </div>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2">
            {CHECKS.map((c) => {
              const done = !!todayLog?.[c.field];
              return (
                <button
                  key={c.field}
                  onClick={() => toggle(c.field)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                    done ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:bg-foreground/5'
                  )}
                >
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', done ? 'border-foreground bg-foreground text-background' : 'border-border')}>
                    {done && <Check className="h-2.5 w-2.5" />}
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
