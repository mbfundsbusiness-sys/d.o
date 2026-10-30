'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Square } from 'lucide-react';
import { useDictation } from '@/hooks/use-dictation';
import { cn } from '@/lib/utils';

export function Composer({
  onSend,
  onStop,
  busy,
  placeholder,
  seed,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  placeholder: string;
  /** Pre-fills the box (e.g. "Log my shift on Thu: ") for the user to finish. */
  seed?: { text: string; n: number };
}) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!seed) return;
    setText(seed.text);
    const el = ref.current;
    el?.focus();
    el?.setSelectionRange(seed.text.length, seed.text.length);
  }, [seed]);
  const dictation = useDictation((phrase) => setText((t) => (t ? `${t.trimEnd()} ${phrase}` : phrase)));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text, dictation.interim]);

  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    if (dictation.listening) dictation.stop();
    onSend(t);
    setText('');
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-2 shadow-lg focus-within:border-foreground/30">
      <textarea
        ref={ref}
        rows={1}
        value={dictation.interim ? `${text}${text ? ' ' : ''}${dictation.interim}` : text}
        readOnly={dictation.listening}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={dictation.listening ? 'Listening…' : placeholder}
        className="block w-full resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-muted-foreground"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="px-2 text-xs text-muted-foreground">Enter to send, Shift+Enter for a new line</span>
        <div className="flex items-center gap-1">
          {dictation.supported && (
            <button
              type="button"
              onClick={dictation.toggle}
              aria-label={dictation.listening ? 'Stop dictation' : 'Dictate'}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                dictation.listening ? 'bg-red-500 text-white' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
          {busy ? (
            <button type="button" onClick={onStop} aria-label="Stop" className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!text.trim()}
              aria-label="Send"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
