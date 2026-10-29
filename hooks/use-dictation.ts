'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Browser speech-to-text (Chrome/Edge/Safari). No server, no API key.

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** onText receives each finished phrase; `interim` is the phrase being spoken. */
export function useDictation(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => setSupported(getRecognition() !== null), []);

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    const R = getRecognition();
    if (!R || rec.current) return;
    const r = new R();
    r.lang = 'en-GB';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      setInterim('');
    };
    r.onerror = () => r.stop();
    rec.current = r;
    r.start();
    setListening(true);
  }, []);

  return { supported, listening, interim, start, stop, toggle: listening ? stop : start };
}
