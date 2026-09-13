'use client';

import { useState } from 'react';
import { supabase, type GhostwriterSong } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Music2, Check } from 'lucide-react';
import { DeleteButton } from '@/components/delete-button';
import { formatDateUK } from '@/lib/utils/dates';

type SongListProps = {
  songs: GhostwriterSong[];
  onSelect: (song: GhostwriterSong) => void;
  onCreated: (song: GhostwriterSong) => void;
  onDeleted: () => void;
};

export function GhostwriterSongList({ songs, onSelect, onCreated, onDeleted }: SongListProps) {
  async function handleDelete(id: string) {
    await supabase.from('ghostwriter_songs').delete().eq('id', id);
    onDeleted();
  }
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const { data, error } = await supabase
      .from('ghostwriter_songs')
      .insert({ title: title.trim(), brief: brief.trim() || null })
      .select()
      .single();

    if (error) {
      setError(error.message);
    } else {
      setTitle('');
      setBrief('');
      setShowForm(false);
      onCreated(data);
    }
    setCreating(false);
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Music2 className="h-4 w-4" />
            Songs
          </h3>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            New song
          </Button>
        </div>

        {showForm && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Input placeholder="Song title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
            <Input
              placeholder="Brief (optional) — topic, mood, direction"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="h-8 text-sm"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={creating || !title.trim()}>
                {creating && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Create
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {songs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No songs yet. Start one and co-write with the AI.
          </p>
        ) : (
          <div className="space-y-1.5">
            {songs.map((s) => (
              <div key={s.id} className="relative">
                <button
                  onClick={() => onSelect(s)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 pr-9 text-left transition-colors hover:bg-accent/5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{s.title}</p>
                      {s.status === 'finished' && (
                        <Badge className="border-success/20 bg-success/10 text-[10px] text-success">
                          <Check className="mr-1 h-3 w-3" />
                          Finished
                        </Badge>
                      )}
                    </div>
                    {s.brief && <p className="truncate text-xs text-muted-foreground">{s.brief}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateUK(s.updated_at.slice(0, 10))}
                  </span>
                </button>
                <DeleteButton
                  onDelete={() => handleDelete(s.id)}
                  confirmText={`Delete "${s.title}"? This deletes its lyrics and co-write chat too.`}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
