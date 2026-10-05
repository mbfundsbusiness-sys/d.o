'use client';

import { AlertTriangle, GraduationCap } from 'lucide-react';
import type { RecurringCommitment, ScheduleBlock } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { londonNow } from '@/lib/utils/dates';
import { dayInsights, describeShortfall, nextDateForWeekday, DAY_SHORT, type PlannerCommitment } from '@/lib/schedule/planner';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Lecture-aware warnings: per-day work/learning shortfalls and prayers that land inside a lecture. */
export function ScheduleInsights({
  commitments,
  blocks,
}: {
  commitments: RecurringCommitment[];
  blocks: ScheduleBlock[];
}) {
  const now = londonNow();
  const active = commitments.filter((c) => c.active) as PlannerCommitment[];
  const week = WEEK.map((dow) => {
    const dateISO = dow === now.dayOfWeek ? now.dateISO : nextDateForWeekday(dow, now);
    return { dow, ...dayInsights(active, blocks, dow, dateISO) };
  });

  const shortfalls = week.flatMap((d) => d.shortfalls.map((s) => ({ dow: d.dow, text: describeShortfall(d.dow, s) })));
  const prayerNotes = week.filter((d) => d.dow === now.dayOfWeek).flatMap((d) => d.prayerFlags);
  if (shortfalls.length === 0 && prayerNotes.length === 0) return null;

  return (
    <Card className="border-amber-500/40">
      <CardContent className="space-y-3 pt-6 text-sm">
        {shortfalls.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Shortfall — lectures leave no room for the full targets
            </p>
            <ul className="space-y-0.5 text-muted-foreground">
              {shortfalls.map((s) => (
                <li key={s.text}>{s.text}</li>
              ))}
            </ul>
          </div>
        )}
        {prayerNotes.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-2 font-medium">
              <GraduationCap className="h-4 w-4 text-amber-500" />
              Today ({DAY_SHORT[now.dayOfWeek]})
            </p>
            <ul className="space-y-0.5 text-muted-foreground">
              {prayerNotes.map((f) => (
                <li key={f.prayer}>
                  {f.prayer} — during lecture, pray before/after
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
