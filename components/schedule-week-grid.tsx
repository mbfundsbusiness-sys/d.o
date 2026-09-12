'use client';

import type { ScheduleBlock, UserSettings } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { effectiveBlocksForDay, type EffectiveBlock } from '@/lib/schedule/effective';
import { cn } from '@/lib/utils';

const DAYS: { dow: number; label: string }[] = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
  { dow: 0, label: 'Sun' },
];

const ACTIVITY_STYLE: Record<string, string> = {
  trading: 'bg-foreground/80 text-background',
  botcouncil: 'bg-foreground/55 text-background',
  reading: 'bg-foreground/35 text-foreground',
  custom: 'border-2 border-foreground bg-foreground/10 text-foreground',
};

const PIXELS_PER_HOUR = 48;

export function ScheduleWeekGrid({
  blocks,
  settings,
}: {
  blocks: ScheduleBlock[];
  settings: UserSettings | null;
}) {
  const byDay = DAYS.map((d) => ({ ...d, blocks: effectiveBlocksForDay(blocks, settings, d.dow) }));

  const allBlocks = byDay.flatMap((d) => d.blocks);
  const earliestMin = allBlocks.length > 0 ? Math.min(...allBlocks.map((b) => b.startMin)) : 8 * 60;
  const latestMin = allBlocks.length > 0 ? Math.max(...allBlocks.map((b) => b.endMin)) : 18 * 60;

  const startHour = Math.max(0, Math.floor(earliestMin / 60) - 1);
  const endHour = Math.min(24, Math.ceil(latestMin / 60) + 1);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * PIXELS_PER_HOUR;

  function topFor(minutes: number) {
    return ((minutes - startHour * 60) / 60) * PIXELS_PER_HOUR;
  }

  if (allBlocks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nothing scheduled yet — add blocks in list view first.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto pt-6">
        <div className="flex min-w-[640px] gap-2">
          {/* Time axis */}
          <div className="w-12 shrink-0" style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div
                key={h}
                className="relative text-right text-[10px] text-muted-foreground"
                style={{ height: PIXELS_PER_HOUR }}
              >
                <span className="absolute -top-2 right-1">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {byDay.map((day) => (
            <div key={day.dow} className="flex-1">
              <p className="mb-1 text-center text-xs font-medium text-muted-foreground">{day.label}</p>
              <div
                className="relative rounded-md border border-border bg-white/[0.02]"
                style={{ height: gridHeight }}
              >
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className={cn('absolute inset-x-0 border-t border-border/50', i === 0 && 'border-t-0')}
                    style={{ top: i * PIXELS_PER_HOUR }}
                  />
                ))}
                {day.blocks.map((block) => (
                  <GridBlock key={block.id} block={block} top={topFor(block.startMin)} height={Math.max(16, ((block.endMin - block.startMin) / 60) * PIXELS_PER_HOUR)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {Object.entries(ACTIVITY_STYLE).map(([type, cls]) => (
            <span key={type} className="flex items-center gap-1.5 capitalize">
              <span className={cn('inline-block h-3 w-3 rounded-sm', cls.split(' ')[0])} />
              {type === 'botcouncil' ? 'BotCouncil' : type}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GridBlock({ block, top, height }: { block: EffectiveBlock; top: number; height: number }) {
  return (
    <div
      className={cn(
        'absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-1 text-[10px] leading-tight',
        ACTIVITY_STYLE[block.activity_type] ?? ACTIVITY_STYLE.custom
      )}
      style={{ top, height }}
      title={`${block.label} · ${block.start_time}–${block.end_time}`}
    >
      <p className="truncate font-medium">{block.label}</p>
      {height > 28 && <p className="truncate opacity-80">{block.start_time}–{block.end_time}</p>}
    </div>
  );
}
