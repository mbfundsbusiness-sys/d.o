'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ROADMAP_PHASES, type RoadmapPhase } from '@/lib/types/roadmap';
import { computeAnchorStreak } from '@/lib/utils/streaks';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Circle, Lock, Loader2, Flame, Wallet, TrendingUp, Moon, Dumbbell, CandlestickChart, Bot } from 'lucide-react';
import { formatDateUK } from '@/lib/utils/dates';

type RollupData = {
  // Finance
  netPosition: number;
  totalIncome: number;
  totalOut: number;
  // Prayer
  prayerStreak: number;
  todayPrayersCompleted: number;
  // Trading
  tradingSessionsThisWeek: number;
  tradingInPlanRate: number;
  // Gym
  gymSessionsThisWeek: number;
  // BotCouncil
  botCouncilChecksThisWeek: number;
  // Anchor logs
  anchorStreak: number;
};

const EMPTY_ROLLUP: RollupData = {
  netPosition: 0,
  totalIncome: 0,
  totalOut: 0,
  prayerStreak: 0,
  todayPrayersCompleted: 0,
  tradingSessionsThisWeek: 0,
  tradingInPlanRate: 0,
  gymSessionsThisWeek: 0,
  botCouncilChecksThisWeek: 0,
  anchorStreak: 0,
};

// Map each phase to the rollup metrics it should display
const PHASE_METRICS: Record<string, { key: keyof RollupData; label: string; format: (v: number) => string; icon: typeof Wallet }[]> = {
  foundation: [
    { key: 'anchorStreak', label: 'Anchor streak', format: (v) => `${v} days`, icon: Flame },
    { key: 'prayerStreak', label: 'Prayer streak', format: (v) => `${v} days`, icon: Moon },
    { key: 'tradingInPlanRate', label: 'In-plan rate', format: (v) => `${v}%`, icon: CandlestickChart },
    { key: 'botCouncilChecksThisWeek', label: 'BotCouncil checks', format: (v) => `${v}/7`, icon: Bot },
  ],
  search_sprint: [
    { key: 'anchorStreak', label: 'Anchor streak', format: (v) => `${v} days`, icon: Flame },
    { key: 'tradingSessionsThisWeek', label: 'Trading sessions', format: (v) => `${v}`, icon: CandlestickChart },
    { key: 'prayerStreak', label: 'Prayer streak', format: (v) => `${v} days`, icon: Moon },
    { key: 'botCouncilChecksThisWeek', label: 'BotCouncil checks', format: (v) => `${v}/7`, icon: Bot },
  ],
  stabilise: [
    { key: 'netPosition', label: 'Net position', format: (v) => `£${v.toFixed(2)}`, icon: Wallet },
    { key: 'totalIncome', label: 'Income tracked', format: (v) => `£${v.toFixed(2)}`, icon: TrendingUp },
    { key: 'gymSessionsThisWeek', label: 'Gym sessions', format: (v) => `${v}`, icon: Dumbbell },
    { key: 'prayerStreak', label: 'Prayer streak', format: (v) => `${v} days`, icon: Moon },
  ],
  scale: [
    { key: 'netPosition', label: 'Net position', format: (v) => `£${v.toFixed(2)}`, icon: Wallet },
    { key: 'totalIncome', label: 'Total income', format: (v) => `£${v.toFixed(2)}`, icon: TrendingUp },
    { key: 'tradingSessionsThisWeek', label: 'Trading sessions', format: (v) => `${v}`, icon: CandlestickChart },
    { key: 'gymSessionsThisWeek', label: 'Gym sessions', format: (v) => `${v}`, icon: Dumbbell },
  ],
};

export default function RoadmapPage() {
  const [rollup, setRollup] = useState<RollupData>(EMPTY_ROLLUP);
  const [loading, setLoading] = useState(true);

  const fetchRollup = useCallback(async () => {
    setLoading(true);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();
    const todayStr = now.toISOString().slice(0, 10);

    const [
      financeRes,
      prayerRes,
      tradingRes,
      gymRes,
      anchorRes,
      botCouncilRes,
    ] = await Promise.all([
      supabase.from('finance_entries').select('*'),
      supabase.from('prayer_logs').select('*'),
      supabase.from('trading_sessions').select('*'),
      supabase.from('gym_sessions').select('*'),
      supabase.from('anchor_logs').select('*'),
      supabase.from('botcouncil_checks').select('*'),
    ]);

    // Finance
    const financeEntries = financeRes.data ?? [];
    const totalIn = financeEntries.filter((e: { type: string; amount: number }) => e.type === 'in').reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
    const totalOut = financeEntries.filter((e: { type: string; amount: number }) => e.type === 'out').reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
    const totalIncome = financeEntries.filter((e: { type: string; category: string; amount: number }) => e.type === 'in' && e.category === 'income').reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);

    // Prayer streak
    const prayerLogs = prayerRes.data ?? [];
    const prayerStreak = computePrayerStreak(prayerLogs, todayStr);
    const todayPrayersCompleted = prayerLogs.filter((l: { log_date: string; completed: boolean }) => l.log_date === todayStr && l.completed).length;

    // Trading
    const tradingSessions = tradingRes.data ?? [];
    const tradingThisWeek = tradingSessions.filter((s: { started_at: string }) => new Date(s.started_at) >= weekAgo);
    const tradingCompleted = tradingThisWeek.filter((s: { ended_at: string | null }) => s.ended_at);
    const inPlanCount = tradingCompleted.filter((s: { in_plan: boolean }) => s.in_plan).length;
    const tradingInPlanRate = tradingCompleted.length > 0 ? Math.round((inPlanCount / tradingCompleted.length) * 100) : 0;

    // Gym
    const gymSessions = gymRes.data ?? [];
    const gymThisWeek = gymSessions.filter((s: { started_at: string }) => new Date(s.started_at) >= weekAgo).length;

    // Anchor logs
    const anchorLogs = anchorRes.data ?? [];
    const anchorStreak = computeAnchorStreak(anchorLogs);

    // BotCouncil — distinct days with at least one healthy check, in the last 7 days
    const botCouncilChecks = botCouncilRes.data ?? [];
    const botCouncilDaysThisWeek = new Set(
      botCouncilChecks
        .filter((c: { checked_at: string; status: string }) => new Date(c.checked_at) >= weekAgo && c.status === 'healthy')
        .map((c: { checked_at: string }) => c.checked_at.slice(0, 10))
    );
    const botCouncilChecksThisWeek = botCouncilDaysThisWeek.size;

    setRollup({
      netPosition: totalIn - totalOut,
      totalIncome,
      totalOut,
      prayerStreak,
      todayPrayersCompleted,
      tradingSessionsThisWeek: tradingThisWeek.length,
      tradingInPlanRate,
      gymSessionsThisWeek: gymThisWeek,
      botCouncilChecksThisWeek,
      anchorStreak,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRollup();
  }, [fetchRollup]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roadmap</h1>
        <p className="text-sm text-muted-foreground">
          Four phases from zero to compounding. You are in Phase 1 — Foundation.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="relative space-y-4">
          {ROADMAP_PHASES.map((phase, index) => {
            const isLast = index === ROADMAP_PHASES.length - 1;
            const metrics = PHASE_METRICS[phase.id] ?? [];

            return (
              <div key={phase.id} className="relative">
                {!isLast && (
                  <div className="absolute left-[1.625rem] top-16 bottom-0 w-px bg-border sm:left-[2.125rem]" />
                )}

                <div className="flex gap-4">
                  <div className="relative z-10 shrink-0">
                    <div
                      className={cn(
                        'flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full border-2 sm:h-[4.25rem] sm:w-[4.25rem]',
                        phase.status === 'active'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : phase.status === 'done'
                          ? 'border-success bg-success text-success-foreground'
                          : 'border-border bg-card text-muted-foreground'
                      )}
                    >
                      {phase.status === 'done' ? (
                        <Check className="h-5 w-5 sm:h-6 sm:w-6" />
                      ) : phase.status === 'upcoming' ? (
                        <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
                      ) : (
                        <span className="text-lg font-semibold sm:text-xl">{phase.number}</span>
                      )}
                    </div>
                  </div>

                  <Card
                    className={cn(
                      'flex-1 transition-colors',
                      phase.status === 'active' && 'border-primary/40 bg-primary/5'
                    )}
                  >
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">{phase.title}</CardTitle>
                        <Badge
                          variant={phase.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {phase.status === 'active'
                            ? 'In progress'
                            : phase.status === 'done'
                            ? 'Complete'
                            : 'Upcoming'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{phase.subtitle}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {phase.description}
                      </p>

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Goals
                        </p>
                        <ul className="space-y-1.5">
                          {phase.goals.map((goal, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Circle className="mt-1 h-2 w-2 shrink-0 fill-current text-primary" />
                              <span>{goal}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Live rollup metrics */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Current progress
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {metrics.map((m) => {
                            const Icon = m.icon;
                            const value = rollup[m.key];
                            return (
                              <div key={m.key} className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2">
                                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="text-[10px] text-muted-foreground truncate">{m.label}</p>
                                  <p className="text-sm font-semibold tabular-nums">{m.format(value)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Tracked anchors
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {phase.anchors.map((anchor, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                            >
                              {anchor}
                            </span>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function computePrayerStreak(logs: { log_date: string; prayer_name: string; completed: boolean }[], todayStr: string): number {
  const dayMap = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!dayMap.has(log.log_date)) dayMap.set(log.log_date, new Set());
    if (log.completed) dayMap.get(log.log_date)!.add(log.prayer_name);
  }

  const todayDate = new Date(todayStr + 'T00:00:00');
  const yesterdayDate = new Date(todayStr + 'T00:00:00');
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  let cursor = todayDate;
  if (!dayMap.has(todayStr) || dayMap.get(todayStr)!.size < 5) {
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
}

