'use client';

import type { AnchorLog } from '@/lib/supabase/client';
import { computeAnchorStreak, computeLongestStreak } from '@/lib/utils/streaks';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, Trophy, CalendarCheck, TrendingUp } from 'lucide-react';

export function AnchorStats({ logs }: { logs: AnchorLog[] }) {
  const currentStreak = computeAnchorStreak(logs);
  const longestStreak = computeLongestStreak(logs);
  const totalEntries = logs.length;
  const totalApplications = logs.reduce((sum, l) => sum + l.applications_sent, 0);

  const stats = [
    {
      label: 'Current streak',
      value: `${currentStreak}`,
      unit: currentStreak === 1 ? 'day' : 'days',
      icon: Flame,
      tone: currentStreak > 0 ? 'text-warning' : 'text-muted-foreground',
    },
    {
      label: 'Longest streak',
      value: `${longestStreak}`,
      unit: longestStreak === 1 ? 'day' : 'days',
      icon: Trophy,
      tone: 'text-primary',
    },
    {
      label: 'Total log entries',
      value: `${totalEntries}`,
      unit: totalEntries === 1 ? 'entry' : 'entries',
      icon: CalendarCheck,
      tone: 'text-accent',
    },
    {
      label: 'Total applications',
      value: `${totalApplications}`,
      unit: totalApplications === 1 ? 'sent' : 'sent',
      icon: TrendingUp,
      tone: 'text-success',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <Icon className={`h-4 w-4 ${stat.tone}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight">{stat.value}</span>
                <span className="text-xs text-muted-foreground">{stat.unit}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
