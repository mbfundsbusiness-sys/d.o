'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ScholarshipSummary } from '@/lib/server/scholarship';
import { daysBetween } from '@/lib/scholarship/study';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PanelProps } from '@/components/chat/chat-view';

const hours = (min: number) => (min >= 60 ? `${Math.round((min / 60) * 10) / 10}h` : `${min}m`);

function dueLabel(today: string, due: string) {
  const d = daysBetween(today, due);
  if (d < 0) return { text: `${-d}d overdue`, urgent: true };
  if (d === 0) return { text: 'today', urgent: true };
  if (d === 1) return { text: 'tomorrow', urgent: true };
  return { text: `in ${d}d`, urgent: d <= 7 };
}

export function ScholarshipPanel({ refreshKey, ask, draft }: PanelProps) {
  const [data, setData] = useState<ScholarshipSummary | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try {
      setData((await apiGet<{ summary: ScholarshipSummary }>('/api/scholarship')).summary);
      setErr(false);
    } catch {
      setErr(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (err) return <p className="p-5 text-sm text-muted-foreground">Couldn&apos;t load your modules.</p>;
  if (!data) return <Loader2 className="m-5 h-4 w-4 animate-spin text-muted-foreground" />;

  const deadlines = data.modules
    .flatMap((m) => m.deadlines.map((d) => ({ ...d, module: m.short })))
    .sort((a, b) => a.due.localeCompare(b.due));
  const maxMin = Math.max(60, ...data.modules.map((m) => m.recentMin));

  return (
    <div className="flex flex-col gap-6 p-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Deadlines</h2>
          <button type="button" onClick={() => draft('New coursework: ')} className="text-xs text-muted-foreground hover:text-foreground">
            + Add
          </button>
        </div>
        {deadlines.length === 0 && <p className="text-sm text-muted-foreground">None logged. Tell me about coursework or exams and I&apos;ll plan time for them.</p>}
        {deadlines.map((d) => {
          const due = dueLabel(data.today, d.due);
          return (
            <div key={d.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{d.title}</span>
                <span className="text-xs text-muted-foreground">
                  {d.module} · {d.kind === 'exams' ? 'exam' : 'coursework'}
                </span>
              </span>
              <span className={cn('shrink-0 text-xs tabular-nums', due.urgent ? 'text-amber-300' : 'text-muted-foreground')}>{due.text}</span>
            </div>
          );
        })}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Modules · study, last 7 days</h3>
        {data.modules.map((m) => (
          <button key={m.key} type="button" onClick={() => draft(`${m.short}: `)} className="block w-full py-1.5 text-left">
            <div className="flex items-baseline justify-between text-sm">
              <span className="truncate">{m.short}</span>
              <span className={cn('text-xs tabular-nums', m.recentMin === 0 ? 'text-amber-300' : 'text-muted-foreground')}>{hours(m.recentMin)}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded bg-muted">
              <div className="h-full bg-foreground/70" style={{ width: `${(m.recentMin / maxMin) * 100}%` }} />
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {m.lectures.map((l) => `${l.day} ${l.start}`).join(', ') || 'No lectures on the timetable'}
            </div>
          </button>
        ))}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Languages</h3>
          <span className="text-xs text-muted-foreground">{hours(data.languageRecentMin)} this week</span>
        </div>
        {data.languages.length === 0 && <p className="text-sm text-muted-foreground">No modules yet.</p>}
        {data.languages.map((lang) => (
          <div key={lang.language} className="py-2">
            <div className="flex items-baseline justify-between text-sm">
              <span>{lang.language}</span>
              <span className="text-xs text-muted-foreground">
                {lang.completed}/{lang.total} done
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded bg-muted">
              <div className="h-full bg-emerald-500" style={{ width: `${lang.total ? (lang.completed / lang.total) * 100 : 0}%` }} />
            </div>
            <button
              type="button"
              onClick={() => ask(lang.next ? `Teach me ${lang.language} module ${lang.next.module_number}: ${lang.next.title}` : `Write my next ${lang.language} module.`)}
              className="mt-2 w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {lang.next ? (
                <>
                  Next: <span className="text-muted-foreground">#{lang.next.module_number} {lang.next.title}</span>
                </>
              ) : (
                'All done. Write the next module'
              )}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
