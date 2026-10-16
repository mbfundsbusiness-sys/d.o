'use client';

import { useGoalStreak } from '@/lib/streaks/use-goal-streak';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, Trophy, CalendarCheck } from 'lucide-react';

export function AnchorStats() {
  const { current: currentStreak, longest: longestStreak, qualifyingLast30 } = useGoalStreak();

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
      label: 'Qualifying days (30d)',
      value: `${qualifyingLast30}`,
      unit: qualifyingLast30 === 1 ? 'day' : 'days',
      icon: CalendarCheck,
      tone: 'text-accent',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
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
