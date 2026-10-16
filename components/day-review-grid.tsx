'use client';

import { Check, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DayReview } from '@/lib/utils/streaks';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<DayReview['dayType'], string> = {
  rest: 'Rest day',
  shift: 'Shift day',
  lecture: 'Lecture day',
  full: 'Full day',
};

function Cell({ done, target }: { done: number; target: number }) {
  const ok = done >= target;
  return (
    <span className={cn('tabular-nums', ok ? 'text-foreground' : 'text-muted-foreground')}>
      {Math.round(done)}
      <span className="text-muted-foreground">/{target}</span>
    </span>
  );
}

function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** The last 14 days against each day's own targets: what you did, what counted, what to fix. */
export function DayReviewGrid({ days }: { days: DayReview[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Last 14 days</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Day</th>
              <th className="py-1 pr-3 font-medium">Type</th>
              <th className="py-1 pr-3 font-medium">Woke</th>
              <th className="py-1 pr-3 font-medium">BotCouncil</th>
              <th className="py-1 pr-3 font-medium">Learning</th>
              <th className="py-1 pr-3 font-medium">Gym</th>
              <th className="py-1 text-right font-medium">Counted</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="py-2 pr-3 font-medium">{weekday(d.date)}</td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">{TYPE_LABEL[d.dayType]}</td>
                <td className="py-2 pr-3">{d.totals.wakeLogged ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4 text-muted-foreground" />}</td>
                <td className="py-2 pr-3"><Cell done={d.totals.workMin} target={d.goals.workMin} /></td>
                <td className="py-2 pr-3"><Cell done={d.totals.learningMin} target={d.goals.learningMin} /></td>
                <td className="py-2 pr-3"><Cell done={d.totals.gymMin} target={d.goals.gymMin} /></td>
                <td className="py-2 text-right">
                  {d.qualifies ? <Check className="ml-auto h-4 w-4" /> : <Minus className="ml-auto h-4 w-4 text-muted-foreground" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">Minutes done / target. Targets are lighter on shift and lecture days; Sundays always count.</p>
      </CardContent>
    </Card>
  );
}
