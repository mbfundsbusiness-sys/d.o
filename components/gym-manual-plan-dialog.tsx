'use client';

import { useState } from 'react';
import { supabase, type GymDayPlan, type GymExercise } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type GymManualPlanDialogProps = {
  open: boolean;
  nextWeekNumber: number;
  onClose: () => void;
  onSaved: () => void;
};

const emptyExercise = (): GymExercise => ({ name: '', sets: 3, reps: '10' });
const emptyDay = (): GymDayPlan => ({ day_label: '', focus: '', exercises: [emptyExercise()] });

export function GymManualPlanDialog({ open, nextWeekNumber, onClose, onSaved }: GymManualPlanDialogProps) {
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<GymDayPlan[]>([emptyDay()]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle('');
    setDays([emptyDay()]);
    setNotes('');
    setError(null);
  }

  function updateDay(i: number, patch: Partial<GymDayPlan>) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function updateExercise(dayIdx: number, exIdx: number, patch: Partial<GymExercise>) {
    setDays((prev) =>
      prev.map((d, idx) =>
        idx === dayIdx
          ? { ...d, exercises: d.exercises.map((e, ei) => (ei === exIdx ? { ...e, ...patch } : e)) }
          : d
      )
    );
  }

  function addExercise(dayIdx: number) {
    setDays((prev) =>
      prev.map((d, idx) => (idx === dayIdx ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d))
    );
  }

  function removeExercise(dayIdx: number, exIdx: number) {
    setDays((prev) =>
      prev.map((d, idx) =>
        idx === dayIdx ? { ...d, exercises: d.exercises.filter((_, ei) => ei !== exIdx) } : d
      )
    );
  }

  function addDay() {
    setDays((prev) => [...prev, emptyDay()]);
  }

  function removeDay(i: number) {
    setDays((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setLoading(true);
    setError(null);

    const cleanDays = days
      .filter((d) => d.day_label.trim())
      .map((d) => ({
        day_label: d.day_label.trim(),
        focus: d.focus.trim(),
        exercises: d.exercises
          .filter((e) => e.name.trim())
          .map((e) => ({
            name: e.name.trim(),
            sets: Number(e.sets) || 0,
            reps: String(e.reps || ''),
            ...(e.rest_sec ? { rest_sec: Number(e.rest_sec) } : {}),
            ...(e.notes?.trim() ? { notes: e.notes.trim() } : {}),
          })),
      }));

    if (cleanDays.length === 0) {
      setError('Add at least one day with a name.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('gym_plans').insert({
      week_number: nextWeekNumber,
      title: title.trim() || `Week ${nextWeekNumber}`,
      is_deload: false,
      is_manual: true,
      content_json: { days: cleanDays, ...(notes.trim() ? { recovery_notes: notes.trim() } : {}) },
      completed: false,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    reset();
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Write your own week</DialogTitle>
          <DialogDescription>
            Build week {nextWeekNumber} yourself — days, focus, and exercises. No AI involved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Week title</Label>
            <Input
              placeholder={`e.g. Week ${nextWeekNumber} — Push/Pull/Legs`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {days.map((day, dayIdx) => (
            <div key={dayIdx} className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Day label (e.g. Day 1 — Push)"
                  value={day.day_label}
                  onChange={(e) => updateDay(dayIdx, { day_label: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="Focus (e.g. Chest/Shoulders/Triceps)"
                  value={day.focus}
                  onChange={(e) => updateDay(dayIdx, { focus: e.target.value })}
                  className="flex-1"
                />
                {days.length > 1 && (
                  <button
                    onClick={() => removeDay(dayIdx)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    title="Remove day"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {day.exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_4rem_5rem_5rem_auto]">
                    <Input
                      placeholder="Exercise"
                      value={ex.name}
                      onChange={(e) => updateExercise(dayIdx, exIdx, { name: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Sets"
                      value={ex.sets}
                      onChange={(e) => updateExercise(dayIdx, exIdx, { sets: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="Reps"
                      value={ex.reps}
                      onChange={(e) => updateExercise(dayIdx, exIdx, { reps: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Rest (s)"
                      value={ex.rest_sec ?? ''}
                      onChange={(e) => updateExercise(dayIdx, exIdx, { rest_sec: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                    <button
                      onClick={() => removeExercise(dayIdx, exIdx)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Remove exercise"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => addExercise(dayIdx)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add exercise
                </Button>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addDay}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add day
          </Button>

          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              placeholder="Recovery notes, deload flags, anything else..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save week {nextWeekNumber}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
