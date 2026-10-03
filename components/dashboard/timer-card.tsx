'use client';

import { useEffect, useState } from 'react';
import { supabase, type ActivityKind } from '@/lib/supabase/client';
import { useTimer, ACTIVITY_LABELS } from '@/lib/timer/context';
import { PageTimer } from '@/components/page-timer';
import { DashCard } from '@/components/ui/glass-card';
import { Timer as TimerIcon } from 'lucide-react';

const TABLE_MAP: Record<ActivityKind, string> = {
  trading: 'trading_sessions', gym: 'gym_sessions', language: 'language_sessions',
  job_search: 'job_search_sessions', reading: 'reading_sessions', course: 'course_sessions',
  botcouncil: 'botcouncil_sessions',
};
const KINDS: ActivityKind[] = ['trading', 'gym', 'language', 'job_search', 'reading', 'course', 'botcouncil'];

export function TimerCard() {
  const { running } = useTimer();
  const [recent, setRecent] = useState<{ kind: ActivityKind; started_at: string; duration_min: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const results = await Promise.all(
        KINDS.map(async (k) => {
          const { data } = await supabase.from(TABLE_MAP[k]).select('started_at, duration_min').not('ended_at', 'is', null).order('started_at', { ascending: false }).limit(3);
          return (data ?? []).map((r: { started_at: string; duration_min: number | null }) => ({ ...r, kind: k }));
        })
      );
      setRecent(results.flat().sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()).slice(0, 3));
      setLoading(false);
    })();
  }, [running]);

  return (
    <DashCard title="Timer" icon={TimerIcon} href="/app/timer" loading={loading}>
      <div className="space-y-3">
        {running ? (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{ACTIVITY_LABELS[running.kind]} running</span>
            <PageTimer kind={running.kind} global />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nothing running — start one from any module.</p>
        )}
        {recent.length > 0 && (
          <div className="space-y-1 border-t border-white/10 pt-2">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{ACTIVITY_LABELS[r.kind]}</span>
                <span>{r.duration_min ?? 0} min</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashCard>
  );
}
