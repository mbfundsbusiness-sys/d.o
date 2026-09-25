'use client';

import { useTimer, ACTIVITY_LABELS } from '@/lib/timer/context';
import { PageTimer } from '@/components/page-timer';

/**
 * Safety net: if a timer is running but no PageTimer for its kind is on the
 * current screen (another tab, a page without one, a kind whose page is
 * unlinked), show its stop control here so it can never be stranded.
 */
export function RunningTimerFallback() {
  const { running, controlKinds } = useTimer();
  if (!running || controlKinds.includes(running.kind)) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/80 px-3 py-2">
      <span className="text-sm text-muted-foreground">{ACTIVITY_LABELS[running.kind]} timer running</span>
      <PageTimer kind={running.kind} global />
    </div>
  );
}
