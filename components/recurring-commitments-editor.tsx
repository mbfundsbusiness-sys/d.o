'use client';

import { useState } from 'react';
import {
  supabase,
  type RecurringCommitment,
  type ScheduleActivityType,
} from '@/lib/supabase/client';
import { regenerateAutoBlocksForDays } from '@/lib/schedule/auto-scheduler';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DeleteButton } from '@/components/delete-button';
import { Plus, Loader2 } from 'lucide-react';
import { fmtHM } from '@/lib/utils/dates';
import { cn } from '@/lib/utils';

const ACTIVITY_OPTIONS: { value: ScheduleActivityType; label: string }[] = [
  { value: 'trading', label: 'Trading' },
  { value: 'botcouncil', label: 'BotCouncil' },
  { value: 'gym', label: 'Gym' },
  { value: 'language', label: 'Language' },
  { value: 'course', label: 'Course' },
  { value: 'reading', label: 'Reading' },
  { value: 'prayer', label: 'Prayer' },
  { value: 'custom', label: 'Custom' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RecurringCommitmentsEditor({
  commitments,
  userId,
  onChanged,
}: {
  commitments: RecurringCommitment[];
  userId: string;
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    activity_type: 'custom' as ScheduleActivityType,
    label: '',
    target_duration_min: '60',
    applies_days: [1, 2, 3, 4, 5] as number[],
    preferred_start_time: '',
    priority: '5',
  });

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      applies_days: f.applies_days.includes(day)
        ? f.applies_days.filter((d) => d !== day)
        : [...f.applies_days, day].sort(),
    }));
  }

  async function regenerate(days: number[]) {
    if (days.length === 0) return;
    await regenerateAutoBlocksForDays(supabase, userId, days);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim() || form.applies_days.length === 0) return;
    setBusy(true);
    setError(null);

    const { error: insErr } = await supabase.from('recurring_commitments').insert({
      activity_type: form.activity_type,
      label: form.label.trim(),
      target_duration_min: parseInt(form.target_duration_min, 10) || 30,
      applies_days: form.applies_days,
      preferred_start_time: form.preferred_start_time || null,
      priority: parseInt(form.priority, 10) || 5,
    });

    if (insErr) {
      setError(insErr.message);
      setBusy(false);
      return;
    }

    await regenerate(form.applies_days);
    setForm({
      activity_type: 'custom',
      label: '',
      target_duration_min: '60',
      applies_days: [1, 2, 3, 4, 5],
      preferred_start_time: '',
      priority: '5',
    });
    setShowAdd(false);
    setBusy(false);
    onChanged();
  }

  async function handleToggleActive(c: RecurringCommitment) {
    setBusy(true);
    setError(null);
    const { error: updErr } = await supabase
      .from('recurring_commitments')
      .update({ active: !c.active })
      .eq('id', c.id);
    if (updErr) setError(updErr.message);
    await regenerate(c.applies_days);
    setBusy(false);
    onChanged();
  }

  async function handleDelete(c: RecurringCommitment) {
    await supabase.from('recurring_commitments').delete().eq('id', c.id);
    await regenerate(c.applies_days);
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Recurring commitments</CardTitle>
        <div className="flex items-center gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button variant="ghost" size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The source of truth for things that need to happen regularly. The scheduler turns these
          into blocks automatically — set a preferred start time to try there first, or leave it
          blank to let the scheduler find any open slot.
        </p>

        {showAdd && (
          <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Module</Label>
                <Select
                  value={form.activity_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, activity_type: v as ScheduleActivityType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  placeholder="e.g. Push day"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Duration (minutes)</Label>
                <Input
                  type="number"
                  min="5"
                  value={form.target_duration_min}
                  onChange={(e) => setForm((f) => ({ ...f, target_duration_min: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preferred start (optional)</Label>
                <Input
                  type="time"
                  value={form.preferred_start_time}
                  onChange={(e) => setForm((f) => ({ ...f, preferred_start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority (higher = scheduled first)</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Applies on</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((d, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        form.applies_days.includes(i)
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border text-muted-foreground hover:border-foreground/40'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy || !form.label.trim()}>
                {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {commitments.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground">No recurring commitments yet.</p>
        )}

        <div className="space-y-2">
          {commitments.map((c) => (
            <div
              key={c.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3',
                c.active ? 'border-border' : 'border-border opacity-50'
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-xs capitalize text-muted-foreground">{c.activity_type}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.target_duration_min} min ·{' '}
                  {c.applies_days.map((d) => DAY_LABELS[d]).join(' ')}
                  {c.preferred_start_time ? ` · from ${fmtHM(c.preferred_start_time)}` : ' · any open slot'}
                  {' · priority '}{c.priority}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleToggleActive(c)}>
                  {c.active ? 'Pause' : 'Resume'}
                </Button>
                <DeleteButton
                  onDelete={() => handleDelete(c)}
                  confirmText={`Delete "${c.label}"? This also removes its auto-generated blocks.`}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
