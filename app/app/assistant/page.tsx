'use client';

import { Sparkles } from 'lucide-react';
import { AssistantPanel } from '@/components/assistant-panel';

export default function AssistantPage() {
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">AI Assistant</h1>
          <p className="text-xs text-muted-foreground">
            Knows your last 7 days. Ask for accountability, planning, or a reality check.
          </p>
        </div>
      </div>

      <div className="glass-surface flex flex-1 flex-col overflow-hidden rounded-2xl">
        <AssistantPanel />
      </div>
    </div>
  );
}
