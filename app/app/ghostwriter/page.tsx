'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  supabase,
  type GhostwriterStyleLyrics,
  type GhostwriterReference,
  type GhostwriterSong,
} from '@/lib/supabase/client';
import { GhostwriterStylePanel } from '@/components/ghostwriter-style-panel';
import { GhostwriterSongList } from '@/components/ghostwriter-song-list';
import { GhostwriterSongWorkspace } from '@/components/ghostwriter-song-workspace';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function GhostwriterPage() {
  const [styleLyrics, setStyleLyrics] = useState<GhostwriterStyleLyrics[]>([]);
  const [references, setReferences] = useState<GhostwriterReference[]>([]);
  const [songs, setSongs] = useState<GhostwriterSong[]>([]);
  const [selectedSong, setSelectedSong] = useState<GhostwriterSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [lyricsRes, refsRes, songsRes] = await Promise.all([
      supabase.from('ghostwriter_style_lyrics').select('*').order('created_at', { ascending: false }),
      supabase.from('ghostwriter_references').select('*').order('created_at', { ascending: false }),
      supabase.from('ghostwriter_songs').select('*').order('updated_at', { ascending: false }),
    ]);

    if (lyricsRes.error) setError(lyricsRes.error.message);
    setStyleLyrics(lyricsRes.data ?? []);
    setReferences(refsRes.data ?? []);
    setSongs(songsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Keep the selected song's details fresh with the list after edits
  useEffect(() => {
    if (selectedSong) {
      const fresh = songs.find((s) => s.id === selectedSong.id);
      if (fresh && fresh !== selectedSong) setSelectedSong(fresh);
    }
  }, [songs, selectedSong]);

  function handleSongChanged(song: GhostwriterSong) {
    setSelectedSong(song);
    setSongs((prev) => prev.map((s) => (s.id === song.id ? song : s)).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  }

  function handleSongCreated(song: GhostwriterSong) {
    setSongs((prev) => [song, ...prev]);
    setSelectedSong(song);
  }

  function handleSongDeleted() {
    setSelectedSong(null);
    fetchAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ghostwriter</h1>
        <p className="text-sm text-muted-foreground">
          An AI co-writer that learns your style from your own lyrics and reference tracks.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {selectedSong ? (
        <GhostwriterSongWorkspace
          song={selectedSong}
          onBack={() => setSelectedSong(null)}
          onSongChanged={handleSongChanged}
          onSongDeleted={handleSongDeleted}
        />
      ) : (
        <>
          <GhostwriterStylePanel styleLyrics={styleLyrics} references={references} onChanged={fetchAll} />
          <GhostwriterSongList songs={songs} onSelect={setSelectedSong} onCreated={handleSongCreated} onDeleted={handleSongDeleted} />
        </>
      )}
    </div>
  );
}
