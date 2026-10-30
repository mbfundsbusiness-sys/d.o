'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Upload, X } from 'lucide-react';
import type { BotCouncilResult } from '@/lib/server/botcouncil';
import type { TradingNote } from '@/lib/server/notes';
import { supabase } from '@/lib/supabase/client';
import { apiGet, apiPost } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PanelProps } from '@/components/chat/chat-view';

type FreelanceData = { notes: TradingNote[]; botcouncil: BotCouncilResult };

const SLIDE_KEY = 'do.freelance.slide';

function ago(iso: string | null) {
  if (!iso) return 'never';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 60) return `${min}m ago`;
  if (min < 48 * 60) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

function BotCouncilCard({ data, ask }: { data: BotCouncilResult; ask: PanelProps['ask'] }) {
  if ('error' in data) {
    return (
      <section>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">BotCouncil</h3>
        <p className="text-sm text-muted-foreground">Status unavailable: {data.error}.</p>
      </section>
    );
  }
  const s = data.status;
  const acc = s.accuracy_30d.resolved ? Math.round((s.accuracy_30d.correct / s.accuracy_30d.resolved) * 100) : null;
  const ready = s.readiness.filter((c) => c.ready).length;
  const stale = s.sweeps.some((w) => !w.last_completed_at || Date.now() - Date.parse(w.last_completed_at) > 36 * 3600_000 || w.status !== 'success');
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">BotCouncil</h3>
        <button type="button" onClick={() => ask('How is BotCouncil doing?')} className="text-xs text-muted-foreground hover:text-foreground">
          Ask
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Sweeps</div>
          <div className={cn(stale && 'text-amber-300')}>{s.sweeps.map((w) => `${w.timeframe} ${ago(w.last_completed_at)}`).join(' · ') || 'none'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Forecasts</div>
          <div className="tabular-nums">
            {s.forecasts.last_24h} today · {s.forecasts.last_7d} this week
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Accuracy, 30 days</div>
          <div className="tabular-nums">{acc === null ? 'n/a' : `${acc}% of ${s.accuracy_30d.resolved}`}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Councils ready</div>
          <div className="tabular-nums">
            {ready}/{s.readiness.length}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">AI spend</div>
          <div className="tabular-nums">
            ${Number(s.ai_cost_usd.today).toFixed(2)} today · ${Number(s.ai_cost_usd.month).toFixed(2)} month
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Users</div>
          <div className="tabular-nums">
            {s.users.total} · {s.users.active_7d} active
          </div>
        </div>
      </div>
    </section>
  );
}

function Slide({ note, big }: { note: TradingNote; big?: boolean }) {
  return (
    <div className={cn('prose-chat leading-relaxed', big ? 'text-lg' : 'text-sm')}>
      {note.section && <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{note.section}</div>}
      <h2 className={cn('mb-3 font-medium', big ? 'text-3xl' : 'text-base')}>{note.title}</h2>
      {note.body ? <ReactMarkdown>{note.body}</ReactMarkdown> : <p className="text-muted-foreground">(no text on this slide)</p>}
    </div>
  );
}

export function FreelancePanel({ refreshKey, ask }: PanelProps) {
  const [data, setData] = useState<FreelanceData | null>(null);
  const [err, setErr] = useState(false);
  const [i, setI] = useState(0);
  const [present, setPresent] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiGet<FreelanceData>('/api/freelance'));
      setErr(false);
    } catch {
      setErr(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(SLIDE_KEY));
      if (saved > 0) setI(saved);
    } catch {}
  }, []);

  const count = data?.notes.length ?? 0;
  const go = useCallback(
    (n: number) => {
      if (!count) return;
      const next = Math.max(0, Math.min(count - 1, n));
      setI(next);
      try {
        localStorage.setItem(SLIDE_KEY, String(next));
      } catch {}
    },
    [count]
  );

  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') go(i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(i - 1);
      else if (e.key === 'Escape') setPresent(false);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [present, i, go]);

  const upload = async (file: File) => {
    setImporting(`Uploading ${file.name}…`);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('signed out');
      const path = `${auth.user.id}/imports/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, '-')}`;
      const up = await supabase.storage.from('trading-notes').upload(path, file, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      if (up.error) throw new Error(up.error.message);
      setImporting('Reading the notes and charts… (big files take a minute)');
      const r = await apiPost<{ added: number; replaced: number; images: number; error?: string }>('/api/freelance/import', { path });
      setImporting(`Imported ${r.added} slides with ${r.images} images${r.replaced ? `, replacing ${r.replaced} from the last import of this file` : ''}.`);
      await load();
    } catch (e) {
      setImporting(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (err) return <p className="p-5 text-sm text-muted-foreground">Couldn&apos;t load your notes.</p>;
  if (!data) return <Loader2 className="m-5 h-4 w-4 animate-spin text-muted-foreground" />;

  const note = data.notes[Math.min(i, count - 1)];
  const sections = Array.from(new Set(data.notes.map((n) => n.section ?? 'Intro')));

  return (
    <div className="flex flex-col gap-6 p-5">
      <BotCouncilCard data={data.botcouncil} ask={ask} />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trading notes</h3>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" title="Import a .docx of your notes">
              <Upload className="h-3 w-3" /> Import
            </button>
            {note && (
              <button type="button" onClick={() => setPresent(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Maximize2 className="h-3 w-3" /> Present
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) upload(f);
            }}
          />
        </div>
        {importing && <p className="text-xs text-muted-foreground">{importing}</p>}

        {!note && <p className="text-sm text-muted-foreground">No notes yet. Import your notes .docx, or tell me something to save.</p>}
        {note && (
          <>
            <select
              value={note.section ?? 'Intro'}
              onChange={(e) => go(data.notes.findIndex((n) => (n.section ?? 'Intro') === e.target.value))}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              aria-label="Jump to chapter"
            >
              {sections.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border p-4">
              <Slide note={note} />
            </div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => go(i - 1)} disabled={i === 0} className="rounded-md border border-border p-1.5 hover:bg-accent disabled:opacity-30" aria-label="Previous slide">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.min(i, count - 1) + 1} / {count}
              </span>
              <button type="button" onClick={() => go(i + 1)} disabled={i >= count - 1} className="rounded-md border border-border p-1.5 hover:bg-accent disabled:opacity-30" aria-label="Next slide">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => ask(`Quiz me on slide #${note.position}: ${note.title}`)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
                Quiz me on this
              </button>
              <button type="button" onClick={() => ask(`Explain slide #${note.position} (${note.title}) back to me simply.`)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
                Explain it
              </button>
            </div>
          </>
        )}
      </section>

      {present && note && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-label="Trading notes slideshow">
          <div className="flex items-center justify-between px-6 py-3 text-sm text-white/60">
            <span className="tabular-nums">
              {Math.min(i, count - 1) + 1} / {count}
            </span>
            <button type="button" onClick={() => setPresent(false)} aria-label="Close slideshow" className="rounded p-1 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-10">
            <div className="mx-auto max-w-3xl">
              <Slide note={note} big />
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 pb-6">
            <button type="button" onClick={() => go(i - 1)} disabled={i === 0} className="rounded-full border border-white/20 p-2 hover:bg-white/10 disabled:opacity-30" aria-label="Previous slide">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(i + 1)} disabled={i >= count - 1} className="rounded-full border border-white/20 p-2 hover:bg-white/10 disabled:opacity-30" aria-label="Next slide">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
