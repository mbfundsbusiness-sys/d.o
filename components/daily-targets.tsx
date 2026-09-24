'use client';

import { useEffect, useState } from 'react';
import { supabase, type ScheduleBlock } from '@/lib/supabase/client';
import { londonNow, minutesOfDay, todayISO } from '@/lib/utils/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const WORK_TARGET_MIN = 180;
const LEARNING_TARGET_MIN = 90;
const WORK_TYPES = ['trading', 'botcouncil'];
const LEARNING_TYPES = ['course', 'reading', 'language'];

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

function Bar({ label, done, planned, target }: { label: string; done: number; planned: number; target: number }) {
  const pct = Math.min(100, (done / target) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {fmt(done)} / {fmt(target)} <span className="text-xs">· {fmt(planned)} scheduled</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DailyTargets({ blocks }: { blocks: ScheduleBlock[] }) {
  const [workDone, setWorkDone] = useState(0);
  const [learningDone, setLearningDone] = useState(0);

  useEffect(() => {
    (async () => {
      const today = todayISO();
      const dayStart = new Date(today + 'T00:00:00').toISOString();
      const sum = async (table: string) => {
        const { data } = await supabase.from(table).select('duration_min').gte('started_at', dayStart);
        return (data ?? []).reduce((s: number, r: { duration_min: number | null }) => s + Number(r.duration_min ?? 0), 0);
      };
      const [trading, botcouncil, reading, language, course] = await Promise.all([
        sum('trading_sessions'),
        sum('botcouncil_sessions'),
        sum('reading_sessions'),
        sum('language_sessions'),
        sum('course_sessions'),
      ]);
      setWorkDone(trading + botcouncil);
      setLearningDone(reading + language + course);
    })();
  }, [blocks]);

  const dow = londonNow().dayOfWeek;
  const planned = (types: string[]) =>
    blocks
      .filter((b) => b.day_of_week === dow && types.includes(b.activity_type))
      .reduce((s, b) => s + (minutesOfDay(b.end_time) - minutesOfDay(b.start_time)), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Today&apos;s targets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Bar label="Work" done={workDone} planned={planned(WORK_TYPES)} target={WORK_TARGET_MIN} />
        <Bar label="Learning" done={learningDone} planned={planned(LEARNING_TYPES)} target={LEARNING_TARGET_MIN} />
        <p className="text-xs text-muted-foreground">
          Work = trading + BotCouncil timer sessions. Learning = reading,
          language and course timer sessions.
        </p>
      </CardContent>
    </Card>
  );
}
