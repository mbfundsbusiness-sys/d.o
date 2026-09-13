'use client';

import { supabase, type BotCouncilCheck } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DeleteButton } from '@/components/delete-button';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatDateUK } from '@/lib/utils/dates';

export function BotCouncilHistory({ checks, onChanged }: { checks: BotCouncilCheck[]; onChanged: () => void }) {
  async function handleDelete(id: string) {
    await supabase.from('botcouncil_checks').delete().eq('id', id);
    onChanged();
  }

  if (checks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No checks logged yet. Log your first health check above.
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
        {checks.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  c.status === 'healthy' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                }`}
              >
                {c.status === 'healthy' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {formatDateUK(c.checked_at.slice(0, 10))}
                  </span>
                  <Badge variant={c.status === 'healthy' ? 'success' : 'destructive'} className="text-xs">
                    {c.status === 'healthy' ? 'Healthy' : 'Issue'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {c.note && (
                <p className="text-xs text-muted-foreground sm:text-right">{c.note}</p>
              )}
              <DeleteButton onDelete={() => handleDelete(c.id)} confirmText="Delete this check?" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
