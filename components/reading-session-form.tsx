'use client';

import { useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { todayISO } from '@/lib/utils/dates';

type ReadingSessionFormProps = {
  onSaved: () => void;
  materialTitles?: string[];
};

export function ReadingSessionForm({ onSaved, materialTitles = [] }: ReadingSessionFormProps) {
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [durationMin, setDurationMin] = useState('30');
  const [pages, setPages] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const mins = parseInt(durationMin, 10) || 0;
    const pageCount = pages.trim() ? parseInt(pages, 10) || null : null;

    const { error: insertError } = await supabase.from('reading_sessions').insert({
      started_at: sessionDate + 'T00:00:00',
      ended_at: sessionDate + 'T00:00:00',
      duration_min: mins,
      title: title.trim() || null,
      pages: pageCount,
      note: note.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setTitle('');
    setPages('');
    setNote('');
    setDurationMin('30');
    setLoading(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reading-date">Date</Label>
          <Input
            id="reading-date"
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reading-duration">Duration (minutes)</Label>
          <Input
            id="reading-duration"
            type="number"
            min="1"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reading-title">Book / material</Label>
          <Input
            id="reading-title"
            list="reading-material-titles"
            placeholder="e.g. Atomic Habits"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <datalist id="reading-material-titles">
            {materialTitles.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reading-pages">Pages (optional)</Label>
          <Input
            id="reading-pages"
            type="number"
            min="0"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reading-note">Note (optional)</Label>
        <Textarea
          id="reading-note"
          placeholder="What did you read? Any takeaways?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Log session
      </Button>
    </form>
  );
}
