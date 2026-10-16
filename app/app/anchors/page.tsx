'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type AnchorLog } from '@/lib/supabase/client';
import { AnchorForm } from '@/components/anchor-form';
import { AnchorStats } from '@/components/anchor-stats';
import { DayReviewGrid } from '@/components/day-review-grid';
import { useGoalStreak } from '@/lib/streaks/use-goal-streak';
import { AnchorHistory } from '@/components/anchor-history';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function AnchorsPage() {
  const goalData = useGoalStreak();
  const [logs, setLogs] = useState<AnchorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('anchor_logs')
      .select('*')
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setLogs(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daily Review</h1>
        <p className="text-sm text-muted-foreground">
          How the last two weeks went against each day's targets. Log today from the dashboard; fix or backfill a day below.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <AnchorStats />
          <DayReviewGrid days={goalData.recent} />
          <details className="group rounded-xl border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">Log or fix a day manually</summary>
            <div className="mt-4 space-y-6">
              <AnchorForm onLogged={() => { void fetchLogs(); void goalData.refresh(); }} />
              <AnchorHistory logs={logs} onChanged={() => { void fetchLogs(); void goalData.refresh(); }} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
