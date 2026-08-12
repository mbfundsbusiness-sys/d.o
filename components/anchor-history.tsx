'use client';

import type { AnchorLog } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Clock, Send, Stethoscope } from 'lucide-react';
import { formatDateUK } from '@/lib/utils/dates';

export function AnchorHistory({ logs }: { logs: AnchorLog[] }) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No entries yet. Log your first anchor above to start building history.
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
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold">
                {new Date(log.log_date + 'T00:00:00').getDate()}
              </div>
              <div>
                <p className="text-sm font-medium">{formatDateUK(log.log_date)}</p>
                <p className="text-xs text-muted-foreground">
                  Logged at {new Date(log.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AnchorChip
                icon={Clock}
                label={log.wake_time ? `${log.wake_time}` : '—'}
                active={!!log.wake_time}
              />
              <AnchorChip
                icon={Send}
                label={`${log.applications_sent} app${log.applications_sent === 1 ? '' : 's'}`}
                active={log.applications_sent > 0}
              />
              <AnchorChip
                icon={Check}
                label="In plan"
                active={log.trading_in_plan}
              />
              <AnchorChip
                icon={Stethoscope}
                label="BC check"
                active={log.botcouncil_checked}
              />
            </div>

            {log.note && (
              <p className="w-full text-xs text-muted-foreground sm:w-auto sm:text-right">
                {log.note}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AnchorChip({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {active ? <Icon className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}
