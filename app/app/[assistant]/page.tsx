'use client';

import { notFound } from 'next/navigation';
import { ChatView } from '@/components/chat/chat-view';
import { FinancePanel } from '@/components/panels/finance-panel';
import { ScholarshipPanel } from '@/components/panels/scholarship-panel';
import { ASSISTANT_NAV } from '@/lib/assistants/nav';

export default function AssistantPage({ params }: { params: { assistant: string } }) {
  const a = ASSISTANT_NAV.find((x) => x.key === params.assistant && x.key !== 'ea');
  if (!a) notFound();

  if (a.key === 'finance') {
    return (
      <ChatView
        assistant="finance"
        title="Finance"
        placeholder="Log a shift, move money into a pot, add a bill…"
        panelTitle="Money"
        Panel={FinancePanel}
        starters={["Log today's shift: 07:00 to 15:30, 112 drops", 'How much have I earned this month?', 'Put £50 in a pot', 'What bills and subscriptions do I have?']}
      />
    );
  }

  if (a.key === 'scholarship') {
    return (
      <ChatView
        assistant="scholarship"
        title="Scholarship"
        placeholder="Ask about a module, add coursework or an exam, or start a language lesson…"
        panelTitle="Modules"
        Panel={ScholarshipPanel}
        starters={['Explain nodal analysis with an example', 'Circuits lab report due next Friday, about 4 hours', 'Quiz me on complex numbers', 'Start my next language lesson']}
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-lg font-medium">{a.name}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Trading notes as a slideshow and BotCouncil status. Coming in a later phase.
      </p>
    </div>
  );
}
