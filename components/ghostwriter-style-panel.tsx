'use client';

import { useState } from 'react';
import { supabase, type GhostwriterStyleLyrics, type GhostwriterReference } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, BookText, Music, Upload, Sparkles } from 'lucide-react';

type StylePanelProps = {
  styleLyrics: GhostwriterStyleLyrics[];
  references: GhostwriterReference[];
  onChanged: () => void;
};

export function GhostwriterStylePanel({ styleLyrics, references, onChanged }: StylePanelProps) {
  const [expanded, setExpanded] = useState(styleLyrics.length === 0 && references.length === 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="text-lg">
            Your style
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {styleLyrics.length} lyric{styleLyrics.length !== 1 ? 's' : ''} · {references.length} reference{references.length !== 1 ? 's' : ''}
            </span>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            The more you add here, the better the AI matches your actual voice instead of writing generic lyrics.
          </p>
          <StyleLyricsSection styleLyrics={styleLyrics} onChanged={onChanged} />
          <ReferencesSection references={references} onChanged={onChanged} />
        </CardContent>
      )}
    </Card>
  );
}

function StyleLyricsSection({ styleLyrics, onChanged }: { styleLyrics: GhostwriterStyleLyrics[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [lyricsText, setLyricsText] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() || !lyricsText.trim()) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('ghostwriter_style_lyrics').insert({
      title: title.trim(),
      lyrics_text: lyricsText.trim(),
      notes: notes.trim() || null,
    });
    if (error) {
      setError(error.message);
    } else {
      setTitle('');
      setLyricsText('');
      setNotes('');
      setShowForm(false);
      onChanged();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('ghostwriter_style_lyrics').delete().eq('id', id);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <BookText className="h-4 w-4" />
          Past lyrics
        </h4>
        <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add lyrics
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Input placeholder="Song title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
          <Textarea
            placeholder="Paste the full lyrics..."
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
            rows={6}
            className="text-sm"
          />
          <Input
            placeholder="Notes (optional) — e.g. 'early stuff', 'more commercial'"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-8 text-sm"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !title.trim() || !lyricsText.trim()}>
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {styleLyrics.length === 0 ? (
        <p className="text-xs text-muted-foreground">No past lyrics added yet.</p>
      ) : (
        <div className="space-y-1.5">
          {styleLyrics.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{l.title}</p>
                {l.notes && <p className="text-xs text-muted-foreground truncate">{l.notes}</p>}
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleDelete(l.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReferencesSection({ references, onChanged }: { references: GhostwriterReference[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [artist, setArtist] = useState('');
  const [track, setTrack] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAudioSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const formData = new FormData();
      formData.append('audio', file);

      const res = await fetch('/api/ghostwriter/analyze-audio', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      setDescription((prev) => (prev.trim() ? `${prev.trim()}\n\n${data.analysis}` : data.analysis));
      setShowForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze audio');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!description.trim()) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('ghostwriter_references').insert({
      artist: artist.trim() || null,
      track: track.trim() || null,
      description: description.trim(),
    });
    if (error) {
      setError(error.message);
    } else {
      setArtist('');
      setTrack('');
      setDescription('');
      setShowForm(false);
      onChanged();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('ghostwriter_references').delete().eq('id', id);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Music className="h-4 w-4" />
          Reference tracks
        </h4>
        <div className="flex items-center gap-1">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent/5 hover:text-foreground">
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {analyzing ? 'Listening...' : 'Upload audio'}
            <input type="file" accept="audio/*" className="hidden" onChange={handleAudioSelected} disabled={analyzing} />
          </label>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add reference
          </Button>
        </div>
      </div>

      {analyzing && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Analyzing the track's sound — this can take up to a minute.
        </p>
      )}

      {showForm && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex gap-2">
            <Input placeholder="Artist (optional)" value={artist} onChange={(e) => setArtist(e.target.value)} className="h-8 text-sm" />
            <Input placeholder="Track (optional)" value={track} onChange={(e) => setTrack(e.target.value)} className="h-8 text-sm" />
          </div>
          <Textarea
            placeholder="Describe the sound/mood/genre you're chasing — production style, tempo, energy, what it feels like..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="text-sm"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !description.trim()}>
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {references.length === 0 ? (
        <p className="text-xs text-muted-foreground">No reference tracks added yet.</p>
      ) : (
        <div className="space-y-1.5">
          {references.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5">
              <div className="min-w-0">
                {(r.artist || r.track) && (
                  <p className="text-sm font-medium truncate">
                    {r.artist}{r.artist && r.track ? ' — ' : ''}{r.track}
                  </p>
                )}
                <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleDelete(r.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
