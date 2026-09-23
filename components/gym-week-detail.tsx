'use client';

import { useState, useEffect } from 'react';
import { supabase, type GymPlan } from '@/lib/supabase/client';
import { useTimer, formatDuration } from '@/lib/timer/context';
import { markAnchorField } from '@/lib/anchors/mark-done';
import { GymCheckinDialog } from '@/components/gym-checkin-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Play, Square, Check, Loader2, Moon } from 'lucide-react';

type GymWeekDetailProps = {
  plan: GymPlan;
  isLatest: boolean;
  onBack: () => void;
  onWeekCompleted: () => void;
};

export function GymWeekDetail({ plan, isLatest, onBack, onWeekCompleted }: GymWeekDetailProps) {
  const { running, startSession, completeSession } = useTimer();
  const [selectedDay, setSelectedDay] = useState(plan.content_json.days?.[0]?.day_label ?? '');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const isThisWeekRunning = running?.kind === 'gym';

  useEffect(() => {
    if (isThisWeekRunning && running) {
      const start = new Date(running.started_at).getTime();
      const update = () => setElapsed(Date.now() - start);
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [isThisWeekRunning, running]);

  async function handleStartTimer() {
    setError(null);
    try {
      await startSession('gym', {
        workout_type: selectedDay,
        note: `Week ${plan.week_number}: ${plan.title}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start timer');
    }
  }

  async function handleCompleteSession() {
    setError(null);
    try {
      await completeSession({});
      await markAnchorField('gym_done', true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete session');
    }
  }

  async function handleCheckinSubmit(data: {
    soreness: number;
    sleep_quality: number;
    motivation: number;
    pain_flag: boolean;
    notes: string;
  }) {
    const { error: checkinError } = await supabase.from('gym_checkins').insert({
      week_number: plan.week_number,
      soreness: data.soreness,
      sleep_quality: data.sleep_quality,
      motivation: data.motivation,
      pain_flag: data.pain_flag,
      notes: data.notes || null,
    });
    if (checkinError) throw new Error(checkinError.message);

    const { error: updateError } = await supabase
      .from('gym_plans')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', plan.id);
    if (updateError) throw new Error(updateError.message);

    setFinishing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) {
        const res = await fetch('/api/gym/next-week', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ planId: plan.id }),
        });
        if (!res.ok) {
          const data = await res.json();
          console.error('Failed to generate next week:', data.error);
        }
      }
    } finally {
      setFinishing(false);
      setCheckinOpen(false);
      onWeekCompleted();
    }
  }

  const content = plan.content_json;
  const days = content.days ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Week {plan.week_number}</span>
            {plan.is_deload && (
              <Badge variant="secondary" className="text-[10px]">
                <Moon className="mr-1 h-3 w-3" />
                Deload
              </Badge>
            )}
            {plan.completed && (
              <Badge className="text-[10px] bg-success/10 text-success border-success/20">
                <Check className="mr-1 h-3 w-3" />
                Completed
              </Badge>
            )}
          </div>
          <h2 className="text-lg font-semibold">{plan.title}</h2>
        </div>
      </div>

      {content.intro && <p className="text-sm text-muted-foreground leading-relaxed">{content.intro}</p>}

      {/* Timer bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
        {isThisWeekRunning ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-lg font-semibold tabular-nums text-primary">
                {formatDuration(elapsed)}
              </span>
              <span className="text-xs text-muted-foreground">training</span>
            </div>
            <div className="flex-1" />
            <Button size="sm" onClick={handleCompleteSession}>
              <Square className="mr-2 h-3.5 w-3.5" />
              Complete session
            </Button>
          </>
        ) : (
          <>
            {days.length > 0 && (
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="h-9 w-full text-sm sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d) => (
                    <SelectItem key={d.day_label} value={d.day_label}>
                      {d.day_label} — {d.focus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex-1" />
            <Button size="sm" onClick={handleStartTimer} disabled={!!running}>
              <Play className="mr-2 h-3.5 w-3.5" />
              Start session
            </Button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Days / exercises */}
      <div className="space-y-3">
        {days.map((day) => (
          <Card key={day.day_label}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">{day.day_label}</h4>
                <Badge variant="secondary" className="text-[10px]">{day.focus}</Badge>
              </div>
              <div className="space-y-2">
                {day.exercises.map((ex, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{ex.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {ex.sets} × {ex.reps}
                      </span>
                    </div>
                    {(ex.rest_sec || ex.notes) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ex.rest_sec ? `Rest ${ex.rest_sec}s` : ''}
                        {ex.rest_sec && ex.notes ? ' · ' : ''}
                        {ex.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {content.recovery_notes && (
        <Card>
          <CardContent className="pt-6">
            <h4 className="mb-1 text-sm font-semibold">Recovery notes</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{content.recovery_notes}</p>
          </CardContent>
        </Card>
      )}

      {!plan.completed && isLatest && (
        <Button className="w-full" variant="outline" onClick={() => setCheckinOpen(true)}>
          Mark week complete
        </Button>
      )}

      {finishing && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating next week...
        </div>
      )}

      <GymCheckinDialog
        open={checkinOpen}
        weekNumber={plan.week_number}
        onClose={() => setCheckinOpen(false)}
        onSubmit={handleCheckinSubmit}
      />
    </div>
  );
}
