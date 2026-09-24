'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, type BotCouncilCheck, type BotCouncilCheckStatus, type BotCouncilTask } from '@/lib/supabase/client';
import { markAnchorField } from '@/lib/anchors/mark-done';
import { BotCouncilTasks } from '@/components/botcouncil-tasks';
import { BotCouncilHistory } from '@/components/botcouncil-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Flame, CheckCircle2, AlertTriangle, ListChecks, Zap } from 'lucide-react';

export default function BotCouncilView() {
  const [checks, setChecks] = useState<BotCouncilCheck[]>([]);
  const [tasks, setTasks] = useState<BotCouncilTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<BotCouncilCheckStatus>('healthy');
  const [note, setNote] = useState('');
  const [logging, setLogging] = useState(false);
  const [quickLogging, setQuickLogging] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [checksRes, tasksRes] = await Promise.all([
      supabase.from('botcouncil_checks').select('*').order('checked_at', { ascending: false }),
      supabase.from('botcouncil_tasks').select('*').order('created_at', { ascending: false }),
    ]);

    if (checksRes.error) setError(checksRes.error.message);
    else if (tasksRes.error) setError(tasksRes.error.message);

    setChecks(checksRes.data ?? []);
    setTasks(tasksRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleLogCheck(e: React.FormEvent) {
    e.preventDefault();
    setLogging(true);
    setError(null);

    const { error } = await supabase.from('botcouncil_checks').insert({
      status,
      note: note.trim() || null,
    });

    setLogging(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNote('');
    setStatus('healthy');
    await markAnchorField('botcouncil_checked', true);
    fetchAll();
  }

  async function handleQuickLog() {
    setQuickLogging(true);
    setError(null);
    const { error } = await supabase.from('botcouncil_checks').insert({ status: 'healthy', note: null });
    setQuickLogging(false);
    if (error) {
      setError(error.message);
      return;
    }
    await markAnchorField('botcouncil_checked', true);
    fetchAll();
  }

  const streak = useMemo(() => computeCheckStreak(checks), [checks]);
  const lastCheck = checks[0] ?? null;
  const openTasks = tasks.filter((t) => !t.completed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">BotCouncil</h1>
          <p className="text-sm text-muted-foreground">
            Light maintenance tracking — health checks and a running task list. Logging a check
            marks today's BotCouncil anchor done.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleQuickLog} disabled={quickLogging}>
          {quickLogging ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-2 h-3.5 w-3.5" />}
          Quick log (healthy)
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Current streak"
          value={`${streak}`}
          unit={streak === 1 ? 'day' : 'days'}
          icon={Flame}
          tone={streak > 0 ? 'text-warning' : 'text-muted-foreground'}
        />
        <StatCard
          label="Last check"
          value={lastCheck ? (lastCheck.status === 'healthy' ? 'Healthy' : 'Issue') : '—'}
          unit=""
          icon={lastCheck?.status === 'issue' ? AlertTriangle : CheckCircle2}
          tone={lastCheck?.status === 'issue' ? 'text-destructive' : 'text-success'}
        />
        <StatCard
          label="Total checks"
          value={`${checks.length}`}
          unit={checks.length === 1 ? 'check' : 'checks'}
          icon={CheckCircle2}
          tone="text-primary"
        />
        <StatCard
          label="Open tasks"
          value={`${openTasks}`}
          unit={openTasks === 1 ? 'task' : 'tasks'}
          icon={ListChecks}
          tone={openTasks > 0 ? 'text-warning' : 'text-muted-foreground'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Log a health check</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogCheck} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={status === 'healthy' ? 'default' : 'outline'}
                  onClick={() => setStatus('healthy')}
                >
                  Healthy
                </Button>
                <Button
                  type="button"
                  variant={status === 'issue' ? 'default' : 'outline'}
                  onClick={() => setStatus('issue')}
                >
                  Issue
                </Button>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <Label className="text-xs">Note (optional)</Label>
              <Input
                placeholder="e.g. cron ran fine, deploy healthy, or what broke..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={logging}>
              {logging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Log check
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <BotCouncilTasks tasks={tasks} onChanged={fetchAll} />
          <BotCouncilHistory checks={checks} onChanged={fetchAll} />
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  icon: typeof Flame;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function computeCheckStreak(checks: BotCouncilCheck[]): number {
  if (checks.length === 0) return 0;

  const dayMap = new Set<string>();
  for (const c of checks) {
    if (c.status === 'healthy') dayMap.add(c.checked_at.slice(0, 10));
  }
  if (dayMap.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const sortedDays = Array.from(dayMap).sort().reverse();
  const mostRecent = sortedDays[0];

  if (mostRecent !== todayStr && mostRecent !== yesterdayStr) return 0;

  let streak = 0;
  const cursor = new Date(mostRecent + 'T00:00:00');
  while (true) {
    const cursorStr = cursor.toISOString().slice(0, 10);
    if (dayMap.has(cursorStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
