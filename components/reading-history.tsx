'use client';

import { supabase, type ReadingSession } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteButton } from '@/components/delete-button';
import { formatDateUK } from '@/lib/utils/dates';

export function ReadingHistory({ sessions, onChanged }: { sessions: ReadingSession[]; onChanged: () => void }) {
  const completed = sessions.filter((s) => s.duration_min !== null);

  async function handleDelete(id: string) {
    await supabase.from('reading_sessions').delete().eq('id', id);
    onChanged();
  }

  if (completed.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No reading sessions yet. Start the timer from the sidebar or log one below.
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold tabular-nums">
                {new Date(s.started_at).getDate()}
              </div>
              <div>
                <span className="text-sm font-medium">{s.title || 'Reading'}</span>
                <p className="text-xs text-muted-foreground">
                  {formatDateUK(s.started_at.slice(0, 10))} · {Math.round(s.duration_min ?? 0)} min
                  {s.pages ? ` · ${s.pages} pp` : ''}
                </p>
                {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              </div>
            </div>
            <DeleteButton onDelete={() => handleDelete(s.id)} confirmText="Delete this reading session?" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
