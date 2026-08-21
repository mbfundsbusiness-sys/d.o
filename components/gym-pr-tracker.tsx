'use client';

import { useState } from 'react';
import { supabase, type GymPR } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trophy } from 'lucide-react';
import { formatDateUK, todayISO } from '@/lib/utils/dates';

type GymPRTrackerProps = {
  prs: GymPR[];
  onChanged: () => void;
};

export function GymPRTracker({ prs, onChanged }: GymPRTrackerProps) {
  const [exercise, setExercise] = useState('');
  const [value, setValue] = useState('');
  const [achievedAt, setAchievedAt] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!exercise.trim() || !value.trim() || saving) return;

    setSaving(true);
    setError(null);
    const { error } = await supabase.from('gym_prs').insert({
      exercise: exercise.trim(),
      value: value.trim(),
      achieved_at: achievedAt,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setExercise('');
    setValue('');
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-warning" />
          PR tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label className="text-xs">Exercise</Label>
            <Input
              placeholder="e.g. Back Squat"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label className="text-xs">Result</Label>
            <Input
              placeholder="e.g. 100kg x 5"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={achievedAt}
              onChange={(e) => setAchievedAt(e.target.value)}
              className="w-36"
            />
          </div>
          <Button type="submit" disabled={!exercise.trim() || !value.trim() || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Log PR
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {prs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No PRs logged yet.</p>
        ) : (
          <div className="space-y-2">
            {prs.map((pr) => (
              <div key={pr.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{pr.exercise}</p>
                  <p className="text-xs text-muted-foreground">{formatDateUK(pr.achieved_at)}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{pr.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
