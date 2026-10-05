'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import { supabase, type ScheduleBlock, type RecurringCommitment } from '@/lib/supabase/client';
import { useUserSettings } from '@/lib/settings/use-user-settings';
import { DashCard } from '@/components/ui/glass-card';
import { londonNow } from '@/lib/utils/dates';
import { effectiveBlocksForDay } from '@/lib/schedule/effective';
import { blockKind, BLOCK_LOOK } from '@/lib/schedule/colors';
import { dayInsights, describeShortfall, type PlannerCommitment } from '@/lib/schedule/planner';
import { cn } from '@/lib/utils';

/** Today's schedule, colour-coded by kind. Replaces the streak heatmap on the dashboard. */
export function ScheduleCard() {
  const { settings } = useUserSettings();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [commitments, setCommitments] = useState<RecurringCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => londonNow());

  useEffect(() => {
    (async () => {
      const [b, c] = await Promise.all([
        supabase.from('schedule_blocks').select('*').eq('day_of_week', londonNow().dayOfWeek),
        supabase.from('recurring_commitments').select('*').eq('active', true),
      ]);
      if (b.error) setError(b.error.message);
      setBlocks((b.data ?? []) as ScheduleBlock[]);
      setCommitments((c.data ?? []) as RecurringCommitment[]);
      setLoading(false);
    })();
    const t = setInterval(() => setNow(londonNow()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = effectiveBlocksForDay(blocks, settings, now.dayOfWeek);
  const insights = dayInsights(commitments as PlannerCommitment[], blocks, now.dayOfWeek, now.dateISO);

  return (
    <DashCard title="Today's schedule" icon={CalendarClock} href="/app/schedule" loading={loading} error={error} empty={!loading && today.length === 0}>
      <div className="flex h-full flex-col gap-3">
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {today.map((b) => {
            const look = BLOCK_LOOK[blockKind(b)];
            const current = now.minutesOfDay >= b.startMin && now.minutesOfDay < b.endMin;
            const past = b.endMin <= now.minutesOfDay;
            return (
              <li
                key={b.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-sm',
                  look.chip,
                  past && 'opacity-45',
                  current && 'ring-2 ring-foreground'
                )}
              >
                <span className="truncate font-medium">{b.label}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums opacity-80">
                  {b.start_time}–{b.end_time}
                </span>
              </li>
            );
          })}
        </ul>
        {insights.shortfalls.map((s) => (
          <p key={s.category} className="flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {describeShortfall(now.dayOfWeek, s)}
          </p>
        ))}
        {insights.prayerFlags.map((f) => (
          <p key={f.prayer} className="text-xs text-muted-foreground">
            {f.prayer} — during lecture, pray before/after
          </p>
        ))}
        <div className="mt-auto flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
          {Object.values(BLOCK_LOOK).map((l) => (
            <span key={l.label} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', l.dot)} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </DashCard>
  );
}
