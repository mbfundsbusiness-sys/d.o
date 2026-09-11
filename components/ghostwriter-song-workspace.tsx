'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, type GhostwriterSong, type GhostwriterChatMessage } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, ArrowLeft, MessageSquare, Sparkles, User, Check, ClipboardPlus, Trash2 } from 'lucide-react';

type SongWorkspaceProps = {
  song: GhostwriterSong;
  onBack: () => void;
  onSongChanged: (song: GhostwriterSong) => void;
  onSongDeleted: () => void;
};

export function GhostwriterSongWorkspace({ song, onBack, onSongChanged, onSongDeleted }: SongWorkspaceProps) {
  const [lyricsText, setLyricsText] = useState(song.lyrics_text);
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [messages, setMessages] = useState<GhostwriterChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLyricsText(song.lyrics_text);
  }, [song.id, song.lyrics_text]);

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('ghostwriter_chat_messages')
      .select('*')
      .eq('song_id', song.id)
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setMessages(data ?? []);
    }
  }, [song.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSaveLyrics() {
    setSavingLyrics(true);
    const { data, error } = await supabase
      .from('ghostwriter_songs')
      .update({ lyrics_text: lyricsText, updated_at: new Date().toISOString() })
      .eq('id', song.id)
      .select()
      .single();

    if (!error && data) onSongChanged(data);
    setSavingLyrics(false);
  }

  async function handleToggleStatus() {
    const nextStatus = song.status === 'finished' ? 'draft' : 'finished';
    const { data, error } = await supabase
      .from('ghostwriter_songs')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', song.id)
      .select()
      .single();

    if (!error && data) onSongChanged(data);
  }

  async function handleDeleteSong() {
    if (!confirm(`Delete "${song.title}"? This can't be undone.`)) return;
    await supabase.from('ghostwriter_songs').delete().eq('id', song.id);
    onSongDeleted();
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    setInput('');

    const tempMsg: GhostwriterChatMessage = {
      id: 'temp-' + Date.now(),
      user_id: '',
      song_id: song.id,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/ghostwriter/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message: trimmed, songId: song.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const tempAssistant: GhostwriterChatMessage = {
        id: 'temp-a-' + Date.now(),
        user_id: '',
        song_id: song.id,
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempAssistant]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInsert(content: string) {
    setLyricsText((prev) => (prev.trim() ? `${prev.trim()}\n\n${content}` : content));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{song.title}</h2>
            {song.status === 'finished' && (
              <Badge className="border-success/20 bg-success/10 text-[10px] text-success">
                <Check className="mr-1 h-3 w-3" />
                Finished
              </Badge>
            )}
          </div>
          {song.brief && <p className="truncate text-xs text-muted-foreground">{song.brief}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={handleToggleStatus}>
          {song.status === 'finished' ? 'Mark as draft' : 'Mark finished'}
        </Button>
        <Button size="icon" variant="ghost" onClick={handleDeleteSong}>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Lyrics editor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Lyrics</CardTitle>
            <Button size="sm" onClick={handleSaveLyrics} disabled={savingLyrics || lyricsText === song.lyrics_text}>
              {savingLyrics && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder="Write or paste lyrics here, or ask the AI to draft something in the chat..."
              rows={18}
              className="resize-none font-mono text-sm leading-relaxed"
            />
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Co-write
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            <div ref={scrollRef} className="max-h-[28rem] min-h-[200px] flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Tell it what you want — a hook idea, a verse about something specific,
                  a rewrite in a different mood. It knows your style profile.
                </p>
              ) : (
                messages.map((msg) => (
                  <ChatBubble key={msg.id} msg={msg} onInsert={handleInsert} />
                ))
              )}
              {sending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Writing...
                </div>
              )}
            </div>
            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write me a hook about..."
                  rows={1}
                  className="min-h-[40px] max-h-32 resize-none"
                  disabled={sending}
                />
                <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChatBubble({ msg, onInsert }: { msg: GhostwriterChatMessage; onInsert: (content: string) => void }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
        isUser ? 'bg-secondary' : 'bg-primary'
      }`}>
        {isUser ? (
          <User className="h-3 w-3 text-secondary-foreground" />
        ) : (
          <Sparkles className="h-3 w-3 text-primary-foreground" />
        )}
      </div>
      <div className={`max-w-[85%] space-y-2 rounded-lg px-3 py-2 text-sm ${
        isUser
          ? 'bg-secondary text-secondary-foreground'
          : 'bg-card border border-border'
      }`}>
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        {!isUser && (
          <button
            onClick={() => onInsert(msg.content)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ClipboardPlus className="h-3 w-3" />
            Insert into lyrics
          </button>
        )}
      </div>
    </div>
  );
}
