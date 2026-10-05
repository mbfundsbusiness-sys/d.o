'use client';

import { motion } from 'framer-motion';
import { AnchorsHeroCard } from '@/components/dashboard/anchors-hero-card';
import { TimerCard } from '@/components/dashboard/timer-card';
import { PrayerCard } from '@/components/dashboard/prayer-card';
import { ScheduleCard } from '@/components/dashboard/schedule-card';
import { TradingDisciplineCard } from '@/components/dashboard/trading-discipline-card';
import { FinanceSnapshotCard } from '@/components/dashboard/finance-snapshot-card';
import { GymCard } from '@/components/dashboard/gym-card';
import { LanguageCard } from '@/components/dashboard/language-card';
import { BotCouncilCard } from '@/components/dashboard/botcouncil-card';

export default function DashboardPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12"
    >
      <div className="order-1 lg:order-none lg:col-span-6">
        <AnchorsHeroCard />
      </div>
      <div className="order-2 lg:order-none lg:col-span-3">
        <TimerCard />
      </div>
      <div className="order-3 lg:order-none lg:col-span-3">
        <PrayerCard />
      </div>

      <div className="order-5 lg:order-none lg:col-span-8">
        <ScheduleCard />
      </div>
      <div className="order-4 lg:order-none lg:col-span-4">
        <TradingDisciplineCard />
      </div>

      <div className="order-8 lg:order-none lg:col-span-4">
        <FinanceSnapshotCard />
      </div>
      <div className="order-6 lg:order-none lg:col-span-4">
        <GymCard />
      </div>
      <div className="order-7 lg:order-none lg:col-span-4">
        <LanguageCard />
      </div>

      <div className="order-9 lg:order-none lg:col-span-12">
        <BotCouncilCard />
      </div>
    </motion.div>
  );
}
