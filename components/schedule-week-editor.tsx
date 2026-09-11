'use client';

import { useState } from 'react';
import {
  supabase,
  type ScheduleBlock,
  type ScheduleActivityType,
  type UserSettings,
} from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { fmtHM } from '@/lib/utils/dates';
import { effectiveBlocksForDay } from '@/lib/schedule/effective';

const DAYS: { dow: number; name: string }[] = [
  { dow: 1, name: 'Monday' },
  { dow: 2, name: 'Tuesday' },
  { dow: 3, name: 'Wednesday' },
  { dow: 4, name: 'Thursday' },
  { dow: 5, name: 'Friday' },
  { dow: 6, name: 'Saturday' },
  { dow: 0, name: 'Sunday' },
];

const ACTIVITY_OPTIONS: { value: ScheduleActivityType; label: string }[] = [
  { value: 'trading', label: 'Trading' },
  { value: 'botcouncil', label: 'BotCouncil' },
  { value: 'reading', label: 'Reading' },
  { value: 'custom', label: 'Custom' },
];

export function ScheduleWeekEditor({
  blocks,
  settings,
  onChanged,
}: {
  blocks: ScheduleBlock[];
  settings: UserSettings | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    const { error: e } = await fn();
    if (e) setError(e.message);
    setBusy(false);
    onChanged();
  }

  function addBlock(dow: number) {
    void run(() =>
      supabase.from('schedule_blocks').insert({
        day_of_week: dow,
        activity_type: 'custom' as ScheduleActivityType,
        start_time: '09:00',
        end_time: '10:00',
        label: 'New block',
      })
    );
  }

  function updateBlock(id: string, fields: Partial<ScheduleBlock>) {
    void run(() => supabase.from('schedule_blocks').update(fields).eq('id', id));
  }

  function deleteBlock(id: string) {
    void run(() => supabase.from('schedule_blocks').delete().eq('id', id));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Weekly schedule</CardTitle>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {DAYS.map(({ dow, name }) => {
          const dayBlocks = blocks
            .filter((b) => b.day_of_week === dow)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          const derivedJummah =
            dow === 5
              ? effectiveBlocksForDay(blocks, settings, 5).find((b) => b.derived)
              : undefined;

          return (
            <div key={dow} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {name}
                </p>
                <Button variant="ghost" size="sm" onClick={() => addBlock(dow)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              {dayBlocks.length === 0 && !derivedJummah && (
                <p className="text-xs text-muted-foreground">No blocks.</p>
              )}

              {dayBlocks.map((b) => (
                <div
                  key={b.id}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[8rem_6rem_6rem_1fr_auto] sm:items-center"
                >
                  <Select
                    value={b.activity_type}
                    onValueChange={(v) => updateBlock(b.id, { activity_type: v as ScheduleActivityType })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    defaultValue={fmtHM(b.start_time)}
                    className="h-8 text-xs"
                    onBlur={(e) => {
                      if (e.target.value && fmtHM(e.target.value) !== fmtHM(b.start_time)) {
                        updateBlock(b.id, { start_time: e.target.value });
                      }
                    }}
                  />
                  <Input
                    type="time"
                    defaultValue={fmtHM(b.end_time)}
                    className="h-8 text-xs"
                    onBlur={(e) => {
                      if (e.target.value && fmtHM(e.target.value) !== fmtHM(b.end_time)) {
                        updateBlock(b.id, { end_time: e.target.value });
                      }
                    }}
                  />
                  <Input
                    defaultValue={b.label}
                    className="h-8 text-xs"
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== b.label) {
                        updateBlock(b.id, { label: e.target.value.trim() });
                      }
                    }}
                  />
                  <button
                    onClick={() => deleteBlock(b.id)}
                    className="justify-self-end text-muted-foreground hover:text-destructive"
                    title="Delete block"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {derivedJummah && (
                <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Jummah</span>{' '}
                  {derivedJummah.start_time}–{derivedJummah.end_time} · replaces the midday block on
                  Fridays. Edit the time in Settings.
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
