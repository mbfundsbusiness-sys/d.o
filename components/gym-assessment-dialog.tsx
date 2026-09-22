'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Check } from 'lucide-react';
import { supabase, type GymAssessment, type GymEquipment, type GymExperienceLevel, type GymGoal } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type GymAssessmentDialogProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (assessment: GymAssessment) => void;
};

const GOAL_OPTIONS: { value: GymGoal; label: string; desc: string }[] = [
  { value: 'strength', label: 'Strength', desc: 'Get stronger — low reps, heavy weight' },
  { value: 'hypertrophy', label: 'Hypertrophy', desc: 'Build muscle — moderate reps and volume' },
  { value: 'general_fitness', label: 'General fitness', desc: 'Balanced mix, stay in shape' },
  { value: 'endurance', label: 'Endurance', desc: 'Higher reps, conditioning-focused' },
];

const EXPERIENCE_OPTIONS: { value: GymExperienceLevel; label: string; desc: string }[] = [
  { value: 'beginner', label: 'Beginner', desc: 'New to structured training' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Consistent training for 6+ months' },
  { value: 'advanced', label: 'Advanced', desc: 'Years of consistent, progressive training' },
];

const EQUIPMENT_OPTIONS: { value: GymEquipment; label: string; desc: string }[] = [
  { value: 'full_gym', label: 'Full gym', desc: 'Barbells, machines, cables — everything' },
  { value: 'home_dumbbells', label: 'Home — dumbbells', desc: 'Dumbbells and bodyweight only' },
  { value: 'bodyweight', label: 'Bodyweight only', desc: 'No equipment at all' },
];

export function GymAssessmentDialog({ open, onClose, onComplete }: GymAssessmentDialogProps) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GymGoal | ''>('');
  const [experienceLevel, setExperienceLevel] = useState<GymExperienceLevel | ''>('');
  const [trainingDays, setTrainingDays] = useState<number[]>([1, 3, 5]);
  const [equipment, setEquipment] = useState<GymEquipment | ''>('');
  const [injuriesNotes, setInjuriesNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = ['Goal', 'Experience', 'Setup', 'Review'];

  function handleReset() {
    setStep(0);
    setGoal('');
    setExperienceLevel('');
    setTrainingDays([1, 3, 5]);
    setEquipment('');
    setInjuriesNotes('');
    setError(null);
  }

  function toggleTrainingDay(day: number) {
    setTrainingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/gym/assess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          goal,
          experience_level: experienceLevel,
          days_per_week: trainingDays.length,
          training_days: trainingDays,
          equipment,
          injuries_notes: injuriesNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assessment failed');

      handleReset();
      onComplete(data.assessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment');
    } finally {
      setLoading(false);
    }
  }

  function canProceed() {
    if (step === 0) return goal !== '';
    if (step === 1) return experienceLevel !== '';
    if (step === 2) return equipment !== '' && trainingDays.length >= 1;
    return true;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gym Assessment
          </DialogTitle>
          <DialogDescription>
            Step {step + 1} of {steps.length} — Let's set up your first training week.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  i < step
                    ? 'bg-primary text-primary-foreground'
                    : i === step
                    ? 'bg-primary/10 text-primary ring-2 ring-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className="text-[10px] text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>

        <div className="min-h-[140px]">
          {step === 0 && (
            <div className="space-y-3">
              <Label>What's your main training goal?</Label>
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGoal(opt.value)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    goal === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/5'
                  }`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    goal === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {goal === opt.value && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <Label>What's your training experience?</Label>
              {EXPERIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setExperienceLevel(opt.value)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    experienceLevel === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/5'
                  }`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    experienceLevel === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {experienceLevel === opt.value && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Which days can you train?</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((d, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => toggleTrainingDay(i)}
                      className={cn(
                        'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                        trainingDays.includes(i)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {trainingDays.length} day{trainingDays.length === 1 ? '' : 's'} a week — this also
                  registers your gym schedule automatically.
                </p>
              </div>
              <div className="space-y-3">
                <Label>What equipment do you have?</Label>
                {EQUIPMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEquipment(opt.value)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      equipment === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/5'
                    }`}
                  >
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      equipment === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}>
                      {equipment === opt.value && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="injuries">Injuries or limitations (optional)</Label>
                <Textarea
                  id="injuries"
                  placeholder="e.g. bad left knee, avoid overhead pressing..."
                  value={injuriesNotes}
                  onChange={(e) => setInjuriesNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Goal</span>
                  <span className="font-medium">{GOAL_OPTIONS.find((o) => o.value === goal)?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Experience</span>
                  <span className="font-medium">{EXPERIENCE_OPTIONS.find((o) => o.value === experienceLevel)?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Training days</span>
                  <span className="font-medium">
                    {trainingDays.map((d) => DAY_LABELS[d]).join(', ')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Equipment</span>
                  <span className="font-medium">{EQUIPMENT_OPTIONS.find((o) => o.value === equipment)?.label}</span>
                </div>
                {injuriesNotes.trim() && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Notes</span>
                    <span className="font-medium text-right max-w-[70%]">{injuriesNotes}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The AI will generate your first week's training plan based on this.
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="flex-row items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step === 0 ? handleClose() : setStep(step - 1))}
            disabled={loading}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < 3 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Continue
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Save assessment
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
