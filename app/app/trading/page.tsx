'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type TradingSession } from '@/lib/supabase/client';
import { useTimer, formatDuration } from '@/lib/timer/context';
import { TradingStats } from '@/components/trading-stats';
import { TradingHistory } from '@/components/trading-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Square } from 'lucide-react';

export default function TradingPage() {
  const { running, startSession, completeSession } = useTimer();
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [inPlan, setInPlan] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const isTradingRunning = running?.kind === 'trading';

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('trading_sessions')
      .select('*')
      .order('started_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setSessions(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Refresh history when a trading session completes, including via the sidebar widget
  useEffect(() => {
    if (!isTradingRunning) fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTradingRunning]);

  useEffect(() => {
    if (isTradingRunning && running) {
      const start = new Date(running.started_at).getTime();
      const update = () => setElapsed(Date.now() - start);
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [isTradingRunning, running]);

  async function handleStart() {
    setError(null);
    setStarting(true);
    try {
      await startSession('trading', {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setStarting(false);
    }
  }

  async function handleComplete() {
    if (inPlan === null) return;
    setError(null);
    setCompleting(true);
    try {
      await completeSession({ in_plan: inPlan, note: note.trim() || undefined });
      setInPlan(null);
      setNote('');
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete session');
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trading</h1>
        <p className="text-sm text-muted-foreground">
          Discipline tracking only — no forecasting, no P&amp;L. Just whether you stayed in plan.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <TradingStats sessions={sessions} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTradingRunning ? (
            <>
              <div className="flex items-center justify-center">
                <span className="font-mono text-3xl font-semibold tabular-nums text-primary">
                  {formatDuration(elapsed)}
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Stayed in plan?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={inPlan === true ? 'default' : 'outline'}
                    onClick={() => setInPlan(true)}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={inPlan === false ? 'default' : 'outline'}
                    onClick={() => setInPlan(false)}
                  >
                    No
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Note (optional)</Label>
                <Input
                  placeholder="What happened this session..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <Button
                onClick={handleComplete}
                disabled={inPlan === null || completing}
                className="w-full"
              >
                {completing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Square className="mr-2 h-4 w-4" />
                )}
                Complete session
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {running ? `Another session (${running.kind}) is running — finish it first.` : 'Ready to trade?'}
              </p>
              <Button onClick={handleStart} disabled={starting || !!running}>
                {starting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Start session
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <TradingHistory sessions={sessions} />
      )}
    </div>
  );
}
