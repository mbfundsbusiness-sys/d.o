'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type AnchorLog } from '@/lib/supabase/client';
import { SHIFT_DAY_GOALS, LECTURE_DAY_GOALS } from '@/lib/utils/streaks';
import { useGoalStreak } from '@/lib/streaks/use-goal-streak';
import { markAnchorField } from '@/lib/anchors/mark-done';
import { londonNow, todayISO } from '@/lib/utils/dates';
import { useTimer, ACTIVITY_LABELS } from '@/lib/timer/context';
import { PageTimer } from '@/components/page-timer';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { ActivityKind } from '@/lib/supabase/client';
import { GlassCard } from '@/components/ui/glass-card';
import { Ring } from '@/components/ui/ring';
import { Check, Flame, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIMER_KINDS: ActivityKind[] = ['botcouncil', 'language', 'reading', 'course', 'gym', 'trading'];

type GoalRow = { key: string; label: string; done: number; target: number; unit: 'min' | 'logged' };

function Row({ row }: { row: GoalRow }) {
  const complete = row.done >= row.target;
  const pct = Math.min(100, (row.done / row.target) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('flex items-center gap-2', complete ? 'text-foreground' : 'text-muted-foreground')}>
          <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', complete ? 'border-foreground bg-foreground text-background' : 'border-border')}>
            {complete && <Check className="h-2.5 w-2.5" />}
          </span>
          {row.label}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {row.unit === 'min' ? `${Math.min(Math.round(row.done), 999)} / ${row.target} min` : complete ? 'logged' : 'not yet'}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AnchorsHeroCard() {
  const goals = useGoalStreak();
  const { running } = useTimer();
  const [todayLog, setTodayLog] = useState<AnchorLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ActivityKind>('botcouncil');

  const loadToday = useCallback(async () => {
    const { data, error } = await supabase
      .from('anchor_logs')
      .select('*')
      .eq('log_date', todayISO())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) setError(error.message);
    setTodayLog((data as AnchorLog | null) ?? null);
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  // A timer stopping changes the totals, so re-read when the running session changes.
  const { refresh } = goals;
  useEffect(() => {
    void refresh();
  }, [running, refresh]);

  async function toggleWake() {
    const today = todayISO();
    const value = todayLog?.wake_time ? null : new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    if (todayLog) {
      await supabase.from('anchor_logs').update({ wake_time: value }).eq('id', todayLog.id);
    } else {
      await supabase.from('anchor_logs').insert({ log_date: today, wake_time: value });
    }
    await loadToday();
    await refresh();
  }

  async function toggleTrading() {
    await markAnchorField('trading_in_plan', !todayLog?.trading_in_plan);
    await loadToday();
  }

  const t = goals.today;
  const wakeDone = !!todayLog?.wake_time || t.wakeLogged;
  const rows: GoalRow[] = [
    { key: 'work', label: 'BotCouncil work', done: t.workMin, target: goals.todayGoals.workMin, unit: 'min' },
    { key: 'learn', label: 'Learning', done: t.learningMin, target: goals.todayGoals.learningMin, unit: 'min' },
    { key: 'gym', label: 'Gym', done: t.gymMin, target: goals.todayGoals.gymMin, unit: 'min' },
  ];
  const doneCount = Number(wakeDone) + rows.filter((r) => r.done >= r.target).length;
  const isWeekday = ![0, 6].includes(londonNow().dayOfWeek);

  return (
    <GlassCard hoverLift={false} className="flex h-full flex-col gap-5 lg:overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Today&apos;s Anchors</h3>
        <Link href="/app/anchors" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          View <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {goals.loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-foreground/5" />
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-6">
          <div className="flex items-center gap-3">
            <Ring value={doneCount} max={4} size={104} stroke={9} />
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Flame className={cn('h-3.5 w-3.5', goals.current > 0 && 'text-foreground')} />
                {goals.current} day{goals.current === 1 ? '' : 's'} streak
              </div>
              <div>{goals.todayQualifies ? "Streak secured. You're done — properly chill." : `${4 - doneCount} to go today`}</div>
              <div className="text-[11px]">
                {londonNow().dayOfWeek === 0
                  ? 'Sunday: rest day, streak is safe'
                  : goals.todayGoals === SHIFT_DAY_GOALS
                  ? 'Shift day: lighter targets'
                  : goals.todayGoals === LECTURE_DAY_GOALS
                    ? 'Lecture day: lighter targets'
                    : 'Full day'}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <button
              onClick={toggleWake}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                wakeDone ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:bg-foreground/5'
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', wakeDone ? 'border-foreground bg-foreground text-background' : 'border-border')}>
                  {wakeDone && <Check className="h-2.5 w-2.5" />}
                </span>
                Woke up
              </span>
              <span className="tabular-nums">{todayLog?.wake_time ? todayLog.wake_time.slice(0, 5) : 'tap to log'}</span>
            </button>
            {rows.map((r) => (
              <Row key={r.key} row={r} />
            ))}
            {isWeekday && (
              <button
                onClick={toggleTrading}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-[11px] transition-colors',
                  todayLog?.trading_in_plan ? 'text-foreground' : 'text-muted-foreground hover:bg-foreground/5'
                )}
              >
                <span>Trading in plan (not part of streak)</span>
                {todayLog?.trading_in_plan && <Check className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Select value={kind} onValueChange={(v) => setKind(v as ActivityKind)} disabled={!!running}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMER_KINDS.map((k) => (
              <SelectItem key={k} value={k}>{ACTIVITY_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PageTimer kind={running ? running.kind : kind} global onCompleted={() => void refresh()} />
      </div>
    </GlassCard>
  );
}
