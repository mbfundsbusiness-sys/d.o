'use client';

import { useEffect, useState } from 'react';
import type { ScheduleBlock, UserSettings } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { londonNow } from '@/lib/utils/dates';
import { effectiveBlocksForDay, needsJummahTime, type EffectiveBlock } from '@/lib/schedule/effective';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function countdown(mins: number): string {
  if (mins <= 0) return 'now';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function ScheduleToday({
  blocks,
  settings,
}: {
  blocks: ScheduleBlock[];
  settings: UserSettings | null;
}) {
  const [now, setNow] = useState(() => londonNow());

  useEffect(() => {
    const t = setInterval(() => setNow(londonNow()), 1000);
    return () => clearInterval(t);
  }, []);

  const today = effectiveBlocksForDay(blocks, settings, now.dayOfWeek);
  const current = today.find((b) => now.minutesOfDay >= b.startMin && now.minutesOfDay < b.endMin) ?? null;
  const next = today.find((b) => b.startMin > now.minutesOfDay) ?? null;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">
            {DAY_NAMES[now.dayOfWeek]}
          </span>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {String(now.hour).padStart(2, '0')}:{String(now.minute).padStart(2, '0')} London
          </span>
        </div>

        {needsJummahTime(settings, now.dayOfWeek) && (
          <p className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            It&apos;s Friday — set your Jummah time in Settings to swap the midday block.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NowNext label="Now" block={current} now={now.minutesOfDay} emphasis />
          <NowNext label="Next" block={next} now={now.minutesOfDay} />
        </div>

        {today.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled today. Add blocks below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function NowNext({
  label,
  block,
  now,
  emphasis,
}: {
  label: string;
  block: EffectiveBlock | null;
  now: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        'rounded-lg border p-3 ' +
        (emphasis && block ? 'border-2 border-foreground bg-white/[0.06]' : 'border-border')
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {block ? (
        <>
          <p className="mt-1 text-base font-semibold">{block.label}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {block.start_time}–{block.end_time}
            {label === 'Now'
              ? ` · ends in ${countdown(block.endMin - now)}`
              : ` · in ${countdown(block.startMin - now)}`}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          {label === 'Now' ? 'Free time' : 'Nothing else today'}
        </p>
      )}
    </div>
  );
}
