'use client';

import { Volume2 } from 'lucide-react';
import { isSpeechSupported, speak } from '@/lib/utils/speech';
import { cn } from '@/lib/utils';

export function SpeakButton({
  text,
  language,
  size = 'sm',
  className,
}: {
  text: string;
  language: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (!isSpeechSupported()) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text, language);
      }}
      title={`Hear "${text}"`}
      aria-label={`Hear "${text}" in ${language}`}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground',
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
        className
      )}
    >
      <Volume2 className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </button>
  );
}
