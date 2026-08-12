'use client';

import { useState } from 'react';
import { useActivityTimer, formatElapsed, type RunningSession } from '@/hooks/use-activity-timer';
import { type ActivityKind } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  Dumbbell,
  Languages,
  Search,
  Play,
  CheckCircle2,
  XCircle,
  Timer as TimerIcon,
} from 'lucide-react';

const KIND_CONFIG: Record<
  ActivityKind,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  trading: { label: 'Trading', icon: TrendingUp, color: 'text-success' },
  gym: { label: 'Gym', icon: Dumbbell, color: 'text-warning' },
  language: { label: 'Language', icon: Languages, color: 'text-accent' },
  job_search: { label: 'Job Search', icon: Search, color: 'text-primary' },
};

type ActivityTimerProps = {
  timer: ReturnType<typeof useActivityTimer>;
};

export function ActivityTimer({ timer }: ActivityTimerProps) {
  const { running, elapsedSec, startSession, completeSession, cancelSession } = timer;
  const [startKind, setStartKind] = useState<ActivityKind>('job_search');
  const [language, setLanguage] = useState('');
  const [activityType, setActivityType] = useState('vocabulary');
  const [workoutType, setWorkoutType] = useState('');
  const [inPlan, setInPlan] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setError(null);
    const opts: Record<string, unknown> = {};
    if (startKind === 'language') {
      opts.language = language || 'General';
      opts.activity_type = activityType;
    }
    if (startKind === 'gym') opts.workout_type = workoutType;
    if (startKind === 'trading') opts.in_plan = inPlan;
    const { error } = await startSession(startKind, opts);
    if (error) setError(error);
  }

  async function handleComplete() {
    setError(null);
    const opts: Record<string, unknown> = {};
    if (running?.kind === 'trading') opts.in_plan = inPlan;
    if (note) opts.note = note;
    if (running?.kind === 'gym') opts.workout_type = workoutType;
    if (running?.kind === 'language') {
      opts.language = language || undefined;
      opts.activity_type = activityType;
    }
    const { error } = await completeSession(opts);
    if (error) setError(error);
    setNote('');
  }

  async function handleCancel() {
    setError(null);
    const { error } = await cancelSession();
    if (error) setError(error);
  }

  if (running) {
    return <RunningTimer running={running} elapsedSec={elapsedSec} onComplete={handleComplete} onCancel={handleCancel} note={note} setNote={setNote} inPlan={inPlan} setInPlan={setInPlan} error={error} />;
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <TimerIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Activity Timer</h3>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-4">
          {(Object.keys(KIND_CONFIG) as ActivityKind[]).map((kind) => {
            const cfg = KIND_CONFIG[kind];
            const Icon = cfg.icon;
            const isActive = startKind === kind;
            return (
              <button
                key={kind}
                onClick={() => setStartKind(kind)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? '' : cfg.color}`} />
                <span className="text-xs font-medium">{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {startKind === 'language' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
            <div className="space-y-1.5">
              <Label htmlFor="lang" className="text-xs">Language</Label>
              <Input id="lang" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. Spanish, Arabic" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-type" className="text-xs">Activity type</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger id="act-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vocabulary">Vocabulary</SelectItem>
                  <SelectItem value="grammar">Grammar</SelectItem>
                  <SelectItem value="listening">Listening</SelectItem>
                  <SelectItem value="speaking">Speaking</SelectItem>
                  <SelectItem value="reading">Reading</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {startKind === 'gym' && (
          <div className="space-y-1.5 mb-3">
            <Label htmlFor="workout" className="text-xs">Workout type (optional)</Label>
            <Input id="workout" value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} placeholder="e.g. Push, Pull, Legs, Cardio" />
          </div>
        )}

        {startKind === 'trading' && (
          <div className="mb-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={inPlan} onChange={(e) => setInPlan(e.target.checked)} className="rounded" />
              Trading in-plan
            </label>
          </div>
        )}

        {error && <p className="text-sm text-destructive mb-3">{error}</p>}

        <Button onClick={handleStart} className="w-full">
          <Play className="mr-2 h-4 w-4" />
          Start {KIND_CONFIG[startKind].label} session
        </Button>
      </CardContent>
    </Card>
  );
}

function RunningTimer({
  running,
  elapsedSec,
  onComplete,
  onCancel,
  note,
  setNote,
  inPlan,
  setInPlan,
  error,
}: {
  running: RunningSession;
  elapsedSec: number;
  onComplete: () => void;
  onCancel: () => void;
  note: string;
  setNote: (v: string) => void;
  inPlan: boolean;
  setInPlan: (v: boolean) => void;
  error: string | null;
}) {
  const cfg = KIND_CONFIG[running.kind];
  const Icon = cfg.icon;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${cfg.color}`} />
            <span className="text-sm font-semibold">{cfg.label} session</span>
            {running.language && (
              <span className="text-xs text-muted-foreground">
                · {running.language} · {running.activity_type}
              </span>
            )}
            {running.workout_type && (
              <span className="text-xs text-muted-foreground">· {running.workout_type}</span>
            )}
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Running
          </span>
        </div>

        <div className="mb-4 text-center">
          <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
            {formatElapsed(elapsedSec)}
          </span>
        </div>

        {running.kind === 'trading' && (
          <div className="mb-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={inPlan} onChange={(e) => setInPlan(e.target.checked)} className="rounded" />
              Trading stayed in-plan
            </label>
          </div>
        )}

        <div className="space-y-1.5 mb-3">
          <Label htmlFor="note" className="text-xs">Note (optional)</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What did you work on?" />
        </div>

        {error && <p className="text-sm text-destructive mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={onComplete} className="flex-1">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Complete
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <XCircle className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
