'use client';

import type { GymSession } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, Clock, CalendarCheck, TrendingUp } from 'lucide-react';
import { dayStreak, londonDateISO } from '@/lib/utils/dates';

export function GymStats({ sessions }: { sessions: GymSession[] }) {
  const completed = sessions.filter((s) => s.ended_at !== null);

  const streak = computeGymStreak(completed);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyMin = completed
    .filter((s) => new Date(s.started_at) >= sevenDaysAgo)
    .reduce((sum, s) => sum + (s.duration_min ?? 0), 0);

  const totalMin = completed.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);

  const stats = [
    {
      label: 'Current streak',
      value: `${streak}`,
      unit: streak === 1 ? 'day' : 'days',
      icon: Flame,
      tone: streak > 0 ? 'text-warning' : 'text-muted-foreground',
    },
    {
      label: 'This week',
      value: `${Math.round(weeklyMin)}`,
      unit: 'min',
      icon: Clock,
      tone: 'text-primary',
    },
    {
      label: 'Total time',
      value: `${Math.floor(totalMin / 60)}h ${Math.round(totalMin % 60)}m`,
      unit: '',
      icon: TrendingUp,
      tone: 'text-accent',
    },
    {
      label: 'Total sessions',
      value: `${completed.length}`,
      unit: completed.length === 1 ? 'session' : 'sessions',
      icon: CalendarCheck,
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
                {stat.unit && <span className="text-xs text-muted-foreground">{stat.unit}</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function computeGymStreak(sessions: GymSession[]): number {
  if (sessions.length === 0) return 0;

  const dayMap = new Set<string>();
  for (const s of sessions) {
    dayMap.add(londonDateISO(s.started_at));
  }

  return dayStreak(dayMap);
}
