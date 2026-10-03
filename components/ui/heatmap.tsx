import { cn } from '@/lib/utils';

export type HeatmapDay = { date: string; level: 0 | 1 | 2 | 3 | 4 };

const LEVEL_CLASS = [
  'bg-foreground/[0.06]',
  'bg-foreground/25',
  'bg-foreground/45',
  'bg-foreground/70',
  'bg-foreground',
];

export function Heatmap({ days, todayDate }: { days: HeatmapDay[]; todayDate: string }) {
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="flex gap-1.5" role="img" aria-label="Streak heatmap, last 5 weeks">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1.5">
          {week.map((day) => (
            <div
              key={day.date}
              title={day.date}
              className={cn(
                'h-3 w-3 rounded-sm',
                LEVEL_CLASS[day.level],
                day.date === todayDate && 'ring-1 ring-foreground ring-offset-1 ring-offset-background'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
