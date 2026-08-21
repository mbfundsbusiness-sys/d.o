'use client';

import type { TradingSession } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Clock, CalendarCheck, TrendingUp } from 'lucide-react';

export function TradingStats({ sessions }: { sessions: TradingSession[] }) {
  const completed = sessions.filter((s) => s.ended_at !== null);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weekCompleted = completed.filter((s) => new Date(s.started_at) >= sevenDaysAgo);
  const weekInPlan = weekCompleted.filter((s) => s.in_plan).length;
  const weekAdherence = weekCompleted.length > 0 ? Math.round((weekInPlan / weekCompleted.length) * 100) : 0;

  const totalInPlan = completed.filter((s) => s.in_plan).length;
  const overallAdherence = completed.length > 0 ? Math.round((totalInPlan / completed.length) * 100) : 0;

  const totalMin = completed.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);

  const stats = [
    {
      label: 'This week adherence',
      value: `${weekAdherence}`,
      unit: '%',
      icon: Target,
      tone: weekAdherence >= 80 ? 'text-success' : weekAdherence >= 50 ? 'text-warning' : 'text-error',
    },
    {
      label: 'Overall adherence',
      value: `${overallAdherence}`,
      unit: '%',
      icon: TrendingUp,
      tone: 'text-primary',
    },
    {
      label: 'Total sessions',
      value: `${completed.length}`,
      unit: completed.length === 1 ? 'session' : 'sessions',
      icon: CalendarCheck,
      tone: 'text-accent',
    },
    {
      label: 'Total time',
      value: `${Math.floor(totalMin / 60)}h ${Math.round(totalMin % 60)}m`,
      unit: '',
      icon: Clock,
      tone: 'text-muted-foreground',
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
