'use client';

import { useState, useEffect } from 'react';
import { useTimer, formatDuration, ACTIVITY_LABELS } from '@/lib/timer/context';
import type { ActivityKind } from '@/lib/supabase/client';
import { markAnchorForKind } from '@/lib/anchors/mark-done';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square, Loader2 } from 'lucide-react';

/**
 * Compact top-right timer control for a page's primary activity — replaces
 * the old always-on sidebar widget. One click to start, one to stop; on
 * completion the session saves to that module's own history table exactly
 * as the sidebar widget always did (via the same useTimer context), and
 * today's matching Daily Anchor (if one exists for this kind) is marked
 * done automatically.
 *
 * This sits alongside each page's existing, more specific timer controls
 * (e.g. "time this book", "time this workout day") rather than replacing
 * them — it's the quick, no-picking-required way to just start timing the
 * page's activity right now.
 */
export function PageTimer({
  kind,
  startOpts,
  onCompleted,
}: {
  kind: ActivityKind;
  startOpts?: Record<string, unknown>;
  onCompleted?: () => void;
}) {
  const { running, loading, startSession, completeSession } = useTimer();
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState('');
  const [inPlan, setInPlan] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isThisRunning = running?.kind === kind;
  const anotherRunning = !!running && !isThisRunning;

  useEffect(() => {
    if (!isThisRunning || !running) return;
    const start = new Date(running.started_at).getTime();
    const update = () => setElapsed(Date.now() - start);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isThisRunning, running]);

  async function handleStart() {
    setError(null);
    setStarting(true);
    try {
      await startSession(kind, startOpts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setStarting(false);
    }
  }

  async function handleComplete() {
    if (kind === 'trading' && inPlan === null) return;
    setError(null);
    setCompleting(true);
    try {
      await completeSession({
        note: note.trim() || undefined,
        in_plan: kind === 'trading' ? inPlan ?? undefined : undefined,
      });
      await markAnchorForKind(kind, kind === 'trading' ? !!inPlan : true);
      setNote('');
      setInPlan(null);
      onCompleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete');
    } finally {
      setCompleting(false);
    }
  }

  if (loading) return null;

  if (isThisRunning) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold tabular-nums text-primary">
          {formatDuration(elapsed)}
        </span>
        {kind === 'trading' && (
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={inPlan === true ? 'default' : 'outline'}
              onClick={() => setInPlan(true)}
            >
              In plan
            </Button>
            <Button
              type="button"
              size="sm"
              variant={inPlan === false ? 'default' : 'outline'}
              onClick={() => setInPlan(false)}
            >
              Off plan
            </Button>
          </div>
        )}
        <Input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-8 w-36 text-xs"
        />
        <Button
          size="sm"
          onClick={handleComplete}
          disabled={completing || (kind === 'trading' && inPlan === null)}
        >
          {completing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Square className="mr-1.5 h-3.5 w-3.5" />}
          Complete
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleStart} disabled={starting || anotherRunning}>
        {starting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-2 h-3.5 w-3.5" />}
        Start {ACTIVITY_LABELS[kind]}
      </Button>
      {anotherRunning && (
        <span className="text-xs text-muted-foreground">{ACTIVITY_LABELS[running.kind]} is running</span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
