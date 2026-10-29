'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import type { DayView, FixedBlock } from '@/lib/schedule/day';
import type { PlanItem, TodoItem } from '@/lib/supabase/types';
import { supabase } from '@/lib/supabase/client';
import { apiGet } from '@/lib/api';
import { fmtHM, minutesOfDay } from '@/lib/utils/dates';
import { cn } from '@/lib/utils';
import type { PanelProps } from '@/components/chat/chat-view';

type TodayData = { nowMin: number; today: DayView; tomorrow: DayView; todos: TodoItem[] };

type Row =
  | { type: 'fixed'; start: number; end: number; block: FixedBlock }
  | { type: 'plan'; start: number; end: number; item: PlanItem };

const FIXED_LABEL: Record<FixedBlock['kind'], string> = {
  wake: 'wake',
  prayer: 'prayer',
  lecture: 'uni',
  shift: 'DPD',
  jummah: 'prayer',
  other: '',
};

function dayTitle(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function TodayPanel({ refreshKey, ask }: PanelProps) {
  const [data, setData] = useState<TodayData | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiGet<TodayData>('/api/today'));
      setErr(false);
    } catch {
      setErr(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const togglePlan = async (p: PlanItem) => {
    const done = p.status !== 'done';
    await supabase.from('plan_items').update({ status: done ? 'done' : 'planned', done_at: done ? new Date().toISOString() : null }).eq('id', p.id);
    if (done && p.todo_id) await supabase.from('todo_items').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', p.todo_id);
    load();
  };

  const toggleTodo = async (t: TodoItem) => {
    await supabase.from('todo_items').update({ completed: !t.completed, completed_at: t.completed ? null : new Date().toISOString() }).eq('id', t.id);
    load();
  };

  if (err) return <p className="p-5 text-sm text-muted-foreground">Couldn&apos;t load today. It will retry in a minute.</p>;
  if (!data) return <Loader2 className="m-5 h-4 w-4 animate-spin text-muted-foreground" />;

  const { today, tomorrow, nowMin, todos } = data;
  const rows: Row[] = [
    ...today.fixed.map<Row>((b) => ({ type: 'fixed', start: b.startMin, end: b.endMin, block: b })),
    ...today.plan
      .filter((p) => p.status !== 'dropped')
      .map<Row>((p) => ({ type: 'plan', start: minutesOfDay(p.start_time), end: minutesOfDay(p.end_time), item: p })),
  ].sort((a, b) => a.start - b.start);

  const live = today.plan.filter((p) => p.status !== 'dropped');
  const done = live.filter((p) => p.status === 'done').length;
  const dueIds = new Set(today.due.map((t) => t.id));
  const undated = todos.filter((t) => !t.due_at && !dueIds.has(t.id)).slice(0, 8);
  const later = todos.filter((t) => t.due_at && !dueIds.has(t.id)).slice(0, 6);
  const tomorrowFirst = tomorrow.fixed.find((f) => f.kind === 'lecture' || f.kind === 'shift');

  return (
    <div className="flex flex-col gap-6 p-5">
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">{dayTitle(today.date)}</h2>
          <span className="text-xs text-muted-foreground">
            {done}/{live.length} done{today.isRestDay ? ' · rest day' : ''}
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded bg-muted">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${live.length ? (done / live.length) * 100 : 0}%` }} />
        </div>
      </section>

      <section className="flex flex-col">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lined up</h3>
          <button type="button" onClick={() => ask('Re-plan the rest of my day.')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3 w-3" /> Re-plan
          </button>
        </div>
        {rows.map((r) => {
          const now = nowMin >= r.start && nowMin < r.end;
          const past = nowMin >= r.end;
          if (r.type === 'fixed') {
            return (
              <div key={`f-${r.block.title}-${r.start}`} className={cn('flex items-center gap-3 py-1.5 text-sm', past && 'opacity-40', now && 'text-foreground')}>
                <span className="w-11 shrink-0 tabular-nums text-muted-foreground">{r.block.start}</span>
                <span className="flex-1 truncate text-muted-foreground">{r.block.title}</span>
                {FIXED_LABEL[r.block.kind] && <span className="text-[10px] uppercase text-muted-foreground/70">{FIXED_LABEL[r.block.kind]}</span>}
              </div>
            );
          }
          const p = r.item;
          const isDone = p.status === 'done';
          const overdue = p.status === 'planned' && past;
          return (
            <div key={p.id} className={cn('flex items-center gap-3 rounded-md py-1.5 text-sm', now && 'bg-accent/60 -mx-2 px-2')}>
              <span className="w-11 shrink-0 tabular-nums">{fmtHM(p.start_time)}</span>
              <span className={cn('flex-1 truncate', isDone && 'text-muted-foreground line-through', overdue && 'text-amber-300', p.status === 'skipped' && 'text-muted-foreground')}>
                {p.title}
                <span className="ml-1.5 text-xs text-muted-foreground">until {fmtHM(p.end_time)}</span>
              </span>
              <button
                type="button"
                onClick={() => togglePlan(p)}
                aria-label={isDone ? 'Mark not done' : 'Mark done'}
                className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border', isDone ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-border hover:border-foreground')}
              >
                {isDone && <Check className="h-3.5 w-3.5" />}
              </button>
            </div>
          );
        })}
        {live.length === 0 && (
          <button type="button" onClick={() => ask("Plan my day.")} className="mt-2 self-start rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
            Plan my day
          </button>
        )}
      </section>

      {(today.due.length > 0 || undated.length > 0 || later.length > 0) && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">To-dos</h3>
          {[...today.due, ...later, ...undated].map((t) => (
            <label key={t.id} className="flex cursor-pointer items-start gap-3 py-1.5 text-sm">
              <input type="checkbox" checked={t.completed} onChange={() => toggleTodo(t)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
              <span className="flex-1">
                {t.title}
                {t.due_at && (
                  <span className={cn('ml-1.5 text-xs', dueIds.has(t.id) ? 'text-amber-300' : 'text-muted-foreground')}>
                    {new Date(t.due_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' })}
                  </span>
                )}
              </span>
            </label>
          ))}
        </section>
      )}

      <section className="text-sm text-muted-foreground">
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide">Tomorrow</h3>
        Wake {tomorrow.wake}
        {tomorrowFirst ? `, then ${tomorrowFirst.title} at ${tomorrowFirst.start}` : ''}.
      </section>
    </div>
  );
}
