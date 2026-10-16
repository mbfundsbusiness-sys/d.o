'use client';

import { motion } from 'framer-motion';
import { AnchorsHeroCard } from '@/components/dashboard/anchors-hero-card';
import { ScheduleCard } from '@/components/dashboard/schedule-card';

/** Minimal daily view: anchors + today's schedule, filling the viewport on desktop. */
export default function DashboardPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-8.5rem)] lg:grid-cols-5"
    >
      <div className="lg:col-span-2 lg:min-h-0">
        <AnchorsHeroCard />
      </div>
      <div className="lg:col-span-3 lg:min-h-0">
        <ScheduleCard />
      </div>
    </motion.div>
  );
}
