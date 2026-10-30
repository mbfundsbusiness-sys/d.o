'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Loader2, PanelRight, RotateCcw } from 'lucide-react';
import type { AssistantKey } from '@/lib/supabase/types';
import { apiGet, authHeaders } from '@/lib/api';
import { ChatMessage } from '@/components/chat/message';
import { Composer } from '@/components/chat/composer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export type PanelProps = {
  refreshKey: number;
  /** Sends a message straight away. */
  ask: (text: string) => void;
  /** Puts text in the composer for the user to finish. */
  draft: (text: string) => void;
};

export function ChatView({
  assistant,
  title,
  starters,
  placeholder,
  panelTitle,
  Panel,
  onOpen,
}: {
  assistant: AssistantKey;
  title: string;
  starters: string[];
  placeholder: string;
  panelTitle: string;
  Panel: (p: PanelProps) => JSX.Element;
  /** Runs once after history loads; return true to reload history (e.g. the brief was just written). */
  onOpen?: () => Promise<boolean>;
}) {
  const [loaded, setLoaded] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [seed, setSeed] = useState<{ text: string; n: number }>();
  const bottom = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', headers: authHeaders, body: { assistant } }),
    [assistant]
  );
  const { messages, setMessages, sendMessage, status, stop, error, regenerate } = useChat({
    id: assistant,
    transport,
    onFinish: () => setRefreshKey((k) => k + 1),
  });

  const loadHistory = useCallback(async () => {
    const { messages } = await apiGet<{ messages: UIMessage[] }>(`/api/chat?assistant=${assistant}`);
    setMessages(messages);
  }, [assistant, setMessages]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await loadHistory();
      } finally {
        if (live) setLoaded(true);
      }
      if (onOpen) {
        setPreparing(true);
        try {
          if ((await onOpen()) && live) {
            await loadHistory();
            setRefreshKey((k) => k + 1);
          }
        } catch {
          // The chat still works without the brief.
        } finally {
          if (live) setPreparing(false);
        }
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistant]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  const busy = status === 'submitted' || status === 'streaming';
  const ask = useCallback((text: string) => sendMessage({ text }), [sendMessage]);
  const draft = useCallback((text: string) => setSeed((s) => ({ text, n: (s?.n ?? 0) + 1 })), []);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
          <h1 className="text-sm font-medium">{title}</h1>
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground xl:hidden"
          >
            <PanelRight className="h-4 w-4" /> {panelTitle}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 md:px-6">
            {!loaded && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
            {loaded && messages.length === 0 && !preparing && (
              <div className="flex flex-col gap-3 py-10">
                <p className="text-muted-foreground">Ask anything, or try one of these.</p>
                <div className="flex flex-wrap gap-2">
                  {starters.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
            {preparing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Lining up today…
              </div>
            )}
            {status === 'submitted' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {error && (
              <div className="flex items-center gap-3 text-sm text-red-300">
                Something went wrong.
                <button type="button" onClick={() => regenerate()} className="flex items-center gap-1 underline">
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            )}
            <div ref={bottom} />
          </div>
        </div>

        <div className="shrink-0 px-4 pb-4 md:px-6">
          <div className="mx-auto max-w-3xl">
            <Composer onSend={ask} onStop={stop} busy={busy} placeholder={placeholder} seed={seed} />
          </div>
        </div>
      </div>

      <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-border bg-black xl:block">
        <Panel refreshKey={refreshKey} ask={ask} draft={draft} />
      </aside>
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-[92vw] max-w-[380px] overflow-y-auto p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{panelTitle}</SheetTitle>
          </SheetHeader>
          <Panel
            refreshKey={refreshKey}
            ask={(t) => {
              setPanelOpen(false);
              ask(t);
            }}
            draft={(t) => {
              setPanelOpen(false);
              draft(t);
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
