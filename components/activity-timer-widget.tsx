'use client';

import { useState, useEffect } from 'react';
import { useTimer, formatDuration, ACTIVITY_LABELS, type RunningSession } from '@/lib/timer/context';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Square, X, Timer as TimerIcon, Loader2 } from 'lucide-react';
import type { ActivityKind } from '@/lib/supabase/client';

const KIND_OPTIONS: { value: ActivityKind; label: string }[] = [
  { value: 'job_search', label: 'Job Search' },
  { value: 'trading', label: 'Trading' },
  { value: 'gym', label: 'Gym' },
  { value: 'language', label: 'Language' },
];

const LANGUAGE_OPTIONS = ['Spanish', 'French', 'German', 'Arabic', 'Japanese', 'Mandarin', 'Italian', 'Portuguese'];
const ACTIVITY_TYPES = ['vocabulary', 'grammar', 'listening', 'speaking', 'reading'];

export function ActivityTimerWidget() {
  const { running, loading, startSession, completeSession, cancelSession } = useTimer();
  const [selectedKind, setSelectedKind] = useState<ActivityKind>('job_search');
  const [language, setLanguage] = useState('Spanish');
  const [customLanguage, setCustomLanguage] = useState('');
  const [activityType, setActivityType] = useState('vocabulary');
  const [workoutType, setWorkoutType] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setError(null);
    setStarting(true);
    try {
      const opts: Record<string, unknown> = {};
      if (selectedKind === 'language') {
        opts.language = customLanguage.trim() || language;
        opts.activity_type = activityType;
      }
      if (selectedKind === 'gym' && workoutType.trim()) {
        opts.workout_type = workoutType.trim();
      }
      if (note.trim()) opts.note = note.trim();
      await startSession(selectedKind, opts);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setStarting(false);
    }
  }

  async function handleComplete() {
    setError(null);
    try {
      await completeSession(note.trim() || undefined);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete');
    }
  }

  async function handleCancel() {
    setError(null);
    try {
      await cancelSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking for active sessions...
      </div>
    );
  }

  if (running) {
    return <RunningWidget running={running} note={note} setNote={setNote} onComplete={handleComplete} onCancel={handleCancel} error={error} />;
  }

  return (
    <div className="space-y-3 border-b border-border px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <TimerIcon className="h-3.5 w-3.5" />
        Activity Timer
      </div>

      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label className="text-xs">Activity</Label>
          <Select value={selectedKind} onValueChange={(v) => setSelectedKind(v as ActivityKind)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedKind === 'language' && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l} className="text-xs">
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Or type your own..."
              value={customLanguage}
              onChange={(e) => setCustomLanguage(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="space-y-1">
              <Label className="text-xs">Activity type</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((a) => (
                    <SelectItem key={a} value={a} className="text-xs capitalize">
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {selectedKind === 'gym' && (
          <div className="space-y-1">
            <Label className="text-xs">Workout type (optional)</Label>
            <Input
              placeholder="e.g. Push, Pull, Legs, Cardio"
              value={workoutType}
              onChange={(e) => setWorkoutType(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        )}

        <Input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-8 text-xs"
        />

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button onClick={handleStart} disabled={starting} size="sm" className="w-full">
          {starting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-2 h-3.5 w-3.5" />}
          Start {ACTIVITY_LABELS[selectedKind]}
        </Button>
      </div>
    </div>
  );
}

function RunningWidget({
  running,
  note,
  setNote,
  onComplete,
  onCancel,
  error,
}: {
  running: RunningSession;
  note: string;
  setNote: (v: string) => void;
  onComplete: () => void;
  onCancel: () => void;
  error: string | null;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(running.started_at).getTime();
    const update = () => setElapsed(Date.now() - start);
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [running.started_at]);

  return (
    <div className="space-y-3 border-b border-border px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <TimerIcon className="h-3.5 w-3.5" />
          {ACTIVITY_LABELS[running.kind]}
        </div>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-destructive"
          title="Cancel session"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="text-center">
        <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
          {formatDuration(elapsed)}
        </span>
      </div>

      {running.language && (
        <p className="text-center text-xs text-muted-foreground">
          {running.language} · {running.activity_type}
        </p>
      )}
      {running.workout_type && (
        <p className="text-center text-xs text-muted-foreground">{running.workout_type}</p>
      )}

      <Input
        placeholder="Add a note..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="h-8 text-xs"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button onClick={onComplete} size="sm" className="w-full">
        <Square className="mr-2 h-3.5 w-3.5" />
        Complete
      </Button>
    </div>
  );
}
