'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GraduationCap, Loader2, Send, Sparkles, User, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { UNI_MODULES, type UniModule } from '@/lib/uni/modules';
import { cn } from '@/lib/utils';

type Msg = { id: string; role: 'user' | 'assistant'; content: string };

export default function UniView() {
  const [activeKey, setActiveKey] = useState(UNI_MODULES[0].key);
  const active = UNI_MODULES.find((m) => m.key === activeKey) ?? UNI_MODULES[0];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <GraduationCap className="mt-1 h-5 w-5 text-purple-400" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">University — Electrical &amp; Electronic Engineering</h2>
          <p className="text-sm text-muted-foreground">One AI tutor per module. Each keeps its own conversation.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {UNI_MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveKey(m.key)}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
              m.key === active.key
                ? 'border-purple-400/60 bg-purple-500/20 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="block font-medium">{m.short}</span>
            <span className="text-xs opacity-70">AI tutor</span>
          </button>
        ))}
      </div>

      <TutorChat key={active.key} module={active} />
    </div>
  );
}

function TutorChat({ module }: { module: UniModule }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('uni_tutor_messages')
      .select('id, role, content')
      .eq('module_key', module.key)
      .order('created_at', { ascending: true });
    if (error) setError(error.message);
    setMessages((data ?? []) as Msg[]);
    setLoading(false);
  }, [module.key]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setInput('');
    const temp: Msg = { id: 'temp-' + Date.now(), role: 'user', content: trimmed };
    setMessages((p) => [...p, temp]);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error('No session');
      const res = await fetch('/api/uni/tutor-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: trimmed, moduleKey: module.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setMessages((p) => [...p, { id: 'temp-a-' + Date.now(), role: 'assistant', content: data.response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
      setMessages((p) => p.filter((m) => m.id !== temp.id));
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  }

  async function clearChat() {
    if (!confirm(`Clear the ${module.short} conversation?`)) return;
    const { error } = await supabase.from('uni_tutor_messages').delete().eq('module_key', module.key);
    if (error) setError(error.message);
    else setMessages([]);
  }

  return (
    <Card>
      <CardContent className="flex h-[32rem] flex-col p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-purple-400" />
            {module.title}
          </p>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} aria-label="Clear conversation">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                Ask your {module.short} tutor anything — paste lecture notes, a problem sheet question, or a task you&apos;re stuck on.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {module.starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn('flex gap-2', m.role === 'user' && 'justify-end')}>
                {m.role === 'assistant' && <Sparkles className="mt-1 h-4 w-4 shrink-0 text-purple-400" />}
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm',
                    m.role === 'user' ? 'bg-white/[0.08]' : 'border border-border'
                  )}
                >
                  {m.content}
                </div>
                {m.role === 'user' && <User className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
            ))
          )}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}
        </div>

        {error && <div className="border-t border-border px-4 py-2 text-sm text-destructive">{error}</div>}

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={`Ask the ${module.short} tutor...`}
              rows={1}
              className="min-h-[40px] resize-none"
            />
            <Button onClick={() => send(input)} disabled={sending || !input.trim()} size="icon" aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
