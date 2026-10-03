'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type ActivityKind } from '@/lib/supabase/client';
import { useTimer, ACTIVITY_LABELS } from '@/lib/timer/context';
import { PageTimer } from '@/components/page-timer';
import { PageShell } from '@/components/ui/page-shell';
import { GlassCard } from '@/components/ui/glass-card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const TABLE_MAP: Record<ActivityKind, string> = {
  trading: 'trading_sessions',
  gym: 'gym_sessions',
  language: 'language_sessions',
  job_search: 'job_search_sessions',
  reading: 'reading_sessions',
  course: 'course_sessions',
  botcouncil: 'botcouncil_sessions',
};

const PICKABLE_KINDS: ActivityKind[] = ['trading', 'gym', 'language', 'job_search', 'reading', 'course', 'botcouncil'];

type RecentSession = { id: string; kind: ActivityKind; started_at: string; duration_min: number | null };

export default function TimerPage() {
  const { running } = useTimer();
  const [kind, setKind] = useState<ActivityKind>('trading');
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(
      PICKABLE_KINDS.map(async (k) => {
        const { data } = await supabase
          .from(TABLE_MAP[k])
          .select('id, started_at, duration_min')
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(5);
        return (data ?? []).map((r: { id: string; started_at: string; duration_min: number | null }) => ({ ...r, kind: k }));
      })
    );
    const all = results.flat().sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    setRecent(all.slice(0, 3));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  return (
    <PageShell title="Timer" subtitle="One activity at a time, across every module.">
      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={kind} onValueChange={(v) => setKind(v as ActivityKind)} disabled={!!running}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PICKABLE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>{ACTIVITY_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PageTimer kind={running ? running.kind : kind} global onCompleted={fetchRecent} />
        </div>
      </GlassCard>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last 3 sessions</p>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed sessions yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => (
              <GlassCard key={`${s.kind}-${s.id}`} hoverLift={false} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium">{ACTIVITY_LABELS[s.kind]}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.started_at).toLocaleDateString('en-GB')} · {s.duration_min ?? 0} min
                </span>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
