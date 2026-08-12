'use client';

import type { LanguageSession } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateUK } from '@/lib/utils/dates';

const ACTIVITY_LABELS: Record<string, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  listening: 'Listening',
  speaking: 'Speaking',
  reading: 'Reading',
};

export function LanguageHistory({ sessions }: { sessions: LanguageSession[] }) {
  const completed = sessions.filter((s) => s.duration_min !== null);

  if (completed.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No sessions yet. Log your first language session above.
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
                  <span className="text-sm font-medium">{s.language}</span>
                  <Badge variant="secondary" className="text-xs">
                    {ACTIVITY_LABELS[s.activity_type] ?? s.activity_type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateUK(s.started_at.slice(0, 10))} · {s.duration_min} min
                </p>
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
