'use client';

import { ChatView } from '@/components/chat/chat-view';
import { TodayPanel } from '@/components/panels/today-panel';
import { apiPost } from '@/lib/api';

const openBrief = async () => (await apiPost<{ created?: boolean }>('/api/brief')).created === true;

export default function EAHome() {
  return (
    <ChatView
      assistant="ea"
      title="EA"
      placeholder="Tell your EA what's changed, what you've done, or what you need…"
      panelTitle="Today"
      Panel={TodayPanel}
      onOpen={openBrief}
      starters={['Plan my day', "What's next?", 'I did BotCouncil, 60 min', 'Add coursework: circuits lab report due Friday, about 3 hours']}
    />
  );
}
