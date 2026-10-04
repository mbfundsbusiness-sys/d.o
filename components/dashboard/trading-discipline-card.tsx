'use client';

import { useEffect, useState } from 'react';
import { supabase, type TradingSession } from '@/lib/supabase/client';
import { DashCard } from '@/components/ui/glass-card';
import { CandlestickChart } from 'lucide-react';

export function TradingDisciplineCard() {
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data, error } = await supabase.from('trading_sessions').select('*').gte('started_at', weekAgo.toISOString()).order('started_at', { ascending: false });
      if (error) setError(error.message);
      setSessions(data ?? []);
      setLoading(false);
    })();
  }, []);

  const completed = sessions.filter((s) => s.ended_at);
  const inPlan = completed.filter((s) => s.in_plan).length;
  const rate = completed.length > 0 ? Math.round((inPlan / completed.length) * 100) : null;
  const last = completed[0];

  return (
    <DashCard title="Trading Discipline" icon={CandlestickChart} href="/app/working?tab=trading" loading={loading} error={error} empty={completed.length === 0}>
      <div className="space-y-1">
        <p className="text-2xl font-semibold tabular-nums">{rate ?? '—'}{rate !== null && '%'}</p>
        <p className="text-xs text-muted-foreground">in-plan this week</p>
        {last && (
          <p className="text-xs text-muted-foreground">
            Last: {new Date(last.started_at).toLocaleDateString('en-GB')} · {last.in_plan ? 'in plan' : 'off plan'}
          </p>
        )}
      </div>
    </DashCard>
  );
}
