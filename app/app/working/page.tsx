'use client';

import { CandlestickChart, Bot, Dumbbell } from 'lucide-react';
import { TabGroupPage } from '@/components/tab-group-page';
import TradingView from '@/components/views/trading-view';
import BotCouncilView from '@/components/views/botcouncil-view';
import GymView from '@/components/views/gym-view';

export default function WorkingPage() {
  return (
    <TabGroupPage
      tabs={[
        { id: 'trading', label: 'Trading', icon: CandlestickChart, View: TradingView },
        { id: 'botcouncil', label: 'BotCouncil', icon: Bot, View: BotCouncilView },
        { id: 'gym', label: 'Gym', icon: Dumbbell, View: GymView },
      ]}
    />
  );
}
