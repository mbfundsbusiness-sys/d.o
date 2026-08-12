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
import { Loader2, Sparkles, Check } from 'lucide-react';
import type { LanguageAssessment, LanguageLevel, LearningStyle } from '@/lib/supabase/client';

type AssessmentDialogProps = {
  open: boolean;
  language: string;
  onClose: () => void;
  onComplete: (assessment: LanguageAssessment) => void;
};

const LEVEL_OPTIONS: { value: LanguageLevel; label: string; desc: string }[] = [
  { value: 'beginner', label: 'Complete beginner', desc: 'Starting from scratch' },
  { value: 'some_knowledge', label: 'Some knowledge', desc: 'I know basics — words, some grammar' },
  { value: 'conversational', label: 'Conversational', desc: 'I can hold basic conversations' },
];

const STYLE_OPTIONS: { value: LearningStyle; label: string; desc: string }[] = [
  { value: 'vocabulary_heavy', label: 'Vocabulary-heavy', desc: 'Learn through words and phrases' },
  { value: 'grammar_first', label: 'Grammar-first', desc: 'Understand the rules first' },
  { value: 'conversation_first', label: 'Conversation-first', desc: 'Jump into speaking and listening' },
];

export function AssessmentDialog({ open, language, onClose, onComplete }: AssessmentDialogProps) {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<LanguageLevel | ''>('');
  const [goal, setGoal] = useState('');
  const [style, setStyle] = useState<LearningStyle | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = ['Level', 'Goal', 'Style', 'Review'];

  function handleReset() {
    setStep(0);
    setLevel('');
    setGoal('');
    setStyle('');
    setError(null);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await import('@/lib/supabase/client').then(m => m.supabase.auth.getSession());
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/language/assess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ language, level, goal, style }),
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
    if (step === 0) return level !== '';
    if (step === 1) return goal.trim().length > 0;
    if (step === 2) return style !== '';
    return true;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {language} Assessment
          </DialogTitle>
          <DialogDescription>
            Step {step + 1} of {steps.length} — Let's set up your personalised curriculum.
          </DialogDescription>
        </DialogHeader>

        {/* Progress dots */}
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
              <Label>What's your current level in {language}?</Label>
              {LEVEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLevel(opt.value)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    level === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/5'
                  }`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    level === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {level === opt.value && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
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
            <div className="space-y-2">
              <Label htmlFor="goal">What does "progress" mean to you for {language}?</Label>
              <Textarea
                id="goal"
                placeholder="e.g. I want to travel in Spain and have basic conversations. Or: I need it for work emails."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={4}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This helps the AI tailor your curriculum to what matters to you.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Label>How do you prefer to learn?</Label>
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStyle(opt.value)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    style === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/5'
                  }`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    style === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {style === opt.value && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Level</span>
                  <span className="font-medium">{LEVEL_OPTIONS.find(o => o.value === level)?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Goal</span>
                  <span className="font-medium text-right max-w-[70%]">{goal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Style</span>
                  <span className="font-medium">{STYLE_OPTIONS.find(o => o.value === style)?.label}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The AI will generate your first 3-5 modules based on this assessment.
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
                  Creating curriculum...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate my curriculum
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
