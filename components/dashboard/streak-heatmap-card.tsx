'use client';

import { useEffect, useState } from 'react';
import { supabase, type AnchorLog } from '@/lib/supabase/client';
import { todayISO } from '@/lib/utils/dates';
import { DashCard } from '@/components/ui/glass-card';
import { Heatmap, type HeatmapDay } from '@/components/ui/heatmap';
import { Activity } from 'lucide-react';

const CHECK_FIELDS: (keyof AnchorLog)[] = ['trading_in_plan', 'botcouncil_checked', 'reading_done', 'gym_done', 'language_done'];

export function StreakHeatmapCard() {
  const [logs, setLogs] = useState<AnchorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 34);
      const { data } = await supabase.from('anchor_logs').select('*').gte('log_date', since.toISOString().slice(0, 10));
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, []);

  const byDate = new Map<string, AnchorLog>();
  for (const l of logs) byDate.set(l.log_date, l);

  const today = todayISO();
  const days: HeatmapDay[] = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const log = byDate.get(dateStr);
    const score = log ? CHECK_FIELDS.filter((f) => !!log[f]).length + (log.wake_time ? 1 : 0) : 0;
    const level = score === 0 ? 0 : score <= 1 ? 1 : score <= 3 ? 2 : score <= 5 ? 3 : 4;
    days.push({ date: dateStr, level: level as HeatmapDay['level'] });
  }

  return (
    <DashCard title="Streak" icon={Activity} href="/app/anchors" loading={loading}>
      <Heatmap days={days} todayDate={today} />
    </DashCard>
  );
}
