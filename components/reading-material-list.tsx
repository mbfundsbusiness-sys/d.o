'use client';

import { useState, FormEvent } from 'react';
import { supabase, type ReadingMaterial } from '@/lib/supabase/client';
import { useTimer } from '@/lib/timer/context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Check, Plus, RotateCcw } from 'lucide-react';

const STATUS_ORDER: ReadingMaterial['status'][] = ['reading', 'queued', 'completed'];
const STATUS_LABEL: Record<ReadingMaterial['status'], string> = {
  reading: 'Currently reading',
  queued: 'Up next',
  completed: 'Finished',
};

export function ReadingMaterialList({
  materials,
  onChanged,
}: {
  materials: ReadingMaterial[];
  onChanged: () => void;
}) {
  const { running, startSession } = useTimer();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    const { error: insErr } = await supabase.from('reading_materials').insert({
      title: title.trim(),
      author: author.trim() || null,
      total_pages: totalPages.trim() ? parseInt(totalPages, 10) || null : null,
      status: 'reading',
    });
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setTitle('');
    setAuthor('');
    setTotalPages('');
    setShowAdd(false);
    onChanged();
  }

  async function patch(id: string, fields: Partial<ReadingMaterial>) {
    setBusyId(id);
    setError(null);
    const { error: updErr } = await supabase.from('reading_materials').update(fields).eq('id', id);
    if (updErr) setError(updErr.message);
    setBusyId(null);
    onChanged();
  }

  async function startTimer(m: ReadingMaterial) {
    setError(null);
    try {
      await startSession('reading', { title: m.title });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start timer');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Reading list</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowAdd((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" />
          Add book
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-4 sm:items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="material-title" className="text-xs">Title</Label>
              <Input id="material-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="material-author" className="text-xs">Author</Label>
              <Input id="material-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="material-pages" className="text-xs">Pages</Label>
              <Input id="material-pages" type="number" min="0" value={totalPages} onChange={(e) => setTotalPages(e.target.value)} />
            </div>
            <div className="sm:col-span-4">
              <Button type="submit" size="sm">Add</Button>
            </div>
          </form>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {materials.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground">
            No books yet. Add what you&apos;re reading to track progress.
          </p>
        )}

        {STATUS_ORDER.map((status) => {
          const items = materials.filter((m) => m.status === status);
          if (items.length === 0) return null;
          return (
            <div key={status} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {STATUS_LABEL[status]}
              </p>
              {items.map((m) => {
                const timerRunningForThis =
                  running?.kind === 'reading' && running.title === m.title;
                return (
                  <div key={m.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{m.title}</p>
                        {m.author && (
                          <p className="text-xs text-muted-foreground">{m.author}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {status !== 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!running}
                            onClick={() => startTimer(m)}
                          >
                            <Play className="mr-1 h-3.5 w-3.5" />
                            {timerRunningForThis ? 'Running' : 'Timer'}
                          </Button>
                        )}
                        {status === 'reading' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === m.id}
                            onClick={() => patch(m.id, { status: 'completed' })}
                          >
                            {busyId === m.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="mr-1 h-3.5 w-3.5" />
                            )}
                            Finished
                          </Button>
                        )}
                        {status === 'queued' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === m.id}
                            onClick={() => patch(m.id, { status: 'reading' })}
                          >
                            Start
                          </Button>
                        )}
                        {status === 'completed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === m.id}
                            onClick={() => patch(m.id, { status: 'reading' })}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>

                    {status === 'reading' && (
                      <div className="mt-2 flex items-center gap-2">
                        <Label htmlFor={`page-${m.id}`} className="text-xs text-muted-foreground">
                          Page
                        </Label>
                        <Input
                          id={`page-${m.id}`}
                          type="number"
                          min="0"
                          defaultValue={m.current_page}
                          className="h-8 w-24 text-xs"
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10) || 0;
                            if (v !== m.current_page) patch(m.id, { current_page: v });
                          }}
                        />
                        {m.total_pages ? (
                          <span className="text-xs text-muted-foreground">
                            / {m.total_pages} ({Math.round((m.current_page / m.total_pages) * 100)}%)
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
