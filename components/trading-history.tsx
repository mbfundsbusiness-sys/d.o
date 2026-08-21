'use client';

import type { TradingSession } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateUK } from '@/lib/utils/dates';

export function TradingHistory({ sessions }: { sessions: TradingSession[] }) {
  const completed = sessions.filter((s) => s.ended_at !== null);

  if (completed.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No sessions yet. Start a trading session above to begin tracking discipline.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {completed.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold">
                {new Date(s.started_at).getDate()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatDateUK(s.started_at.slice(0, 10))}</span>
                  <Badge variant={s.in_plan ? 'success' : 'destructive'} className="text-xs">
                    {s.in_plan ? 'In plan' : 'Off plan'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{s.duration_min} min</p>
              </div>
            </div>
            {s.note && (
              <p className="text-xs text-muted-foreground sm:text-right">{s.note}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
