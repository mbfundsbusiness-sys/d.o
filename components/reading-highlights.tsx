'use client';

import { useState, FormEvent } from 'react';
import { supabase, type ReadingHighlight } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Bookmark, Trash2 } from 'lucide-react';
import { formatDateUK } from '@/lib/utils/dates';

export function ReadingHighlights({
  highlights,
  materialTitles,
  onChanged,
}: {
  highlights: ReadingHighlight[];
  materialTitles: string[];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState('');
  const [quote, setQuote] = useState('');
  const [page, setPage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !quote.trim()) return;
    setLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from('reading_highlights').insert({
      title: title.trim(),
      quote_text: quote.trim(),
      page_number: page.trim() ? parseInt(page, 10) || null : null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setQuote('');
    setPage('');
    setLoading(false);
    onChanged();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    const { error: delError } = await supabase.from('reading_highlights').delete().eq('id', id);
    if (delError) setError(delError.message);
    setDeletingId(null);
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bookmark className="h-5 w-5" />
          Lines to come back to
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-1">
              <Label htmlFor="highlight-title" className="text-xs">Book / material</Label>
              <Input
                id="highlight-title"
                list="highlight-material-titles"
                placeholder="e.g. Atomic Habits"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <datalist id="highlight-material-titles">
                {materialTitles.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label htmlFor="highlight-page" className="text-xs">Page</Label>
              <Input
                id="highlight-page"
                type="number"
                min="0"
                value={page}
                onChange={(e) => setPage(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="highlight-quote" className="text-xs">Line / note</Label>
            <Textarea
              id="highlight-quote"
              placeholder="Paste the line, or jot what to come back to..."
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={2}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={loading || !title.trim() || !quote.trim()}>
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </form>

        {highlights.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            {highlights.map((h) => (
              <div key={h.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{h.title}</span>
                    {h.page_number != null && (
                      <span className="text-xs text-muted-foreground">p.{h.page_number}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm italic leading-relaxed">&ldquo;{h.quote_text}&rdquo;</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateUK(h.created_at.slice(0, 10))}</p>
                </div>
                <button
                  onClick={() => handleDelete(h.id)}
                  disabled={deletingId === h.id}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  {deletingId === h.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
