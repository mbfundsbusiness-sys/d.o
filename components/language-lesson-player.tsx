'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type PlayableQuestion, type AnswerVerdict } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, X, Check, Lightbulb, RotateCcw } from 'lucide-react';
import { SpeakButton } from '@/components/speak-button';
import { cn } from '@/lib/utils';

// A lesson passes at 70% — matches "minimum accuracy achieved" from the
// completion spec without pretending a single hard-coded number is science.
const PASS_THRESHOLD = 0.7;

type Feedback = { verdict: AnswerVerdict; givenAnswer: string } | null;

export function LanguageLessonPlayer({
  lessonId,
  language,
  onExit,
  onPassed,
}: {
  lessonId: string;
  language: string;
  onExit: () => void;
  onPassed: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PlayableQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [checking, setChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);

  const loadQuestions = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/language/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ moduleId: lessonId, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load questions');

      setQuestions(data.questions ?? []);
      setIndex(0);
      setResults([]);
      setFeedback(null);
      setSelectedOption(null);
      setTextAnswer('');
      setShowHint(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }, [lessonId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const current = questions[index];
  const finished = questions.length > 0 && index >= questions.length;

  async function handleCheck() {
    if (!current) return;
    const given = current.question_type === 'multiple_choice' ? selectedOption ?? '' : textAnswer;
    if (!given.trim()) return;

    setChecking(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/language/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ questionId: current.id, answer: given, hintUsed: showHint }),
      });
      const data: AnswerVerdict = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || 'Failed to check answer');

      setFeedback({ verdict: data, givenAnswer: given });
      setResults((prev) => [...prev, data.correct]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check answer');
    } finally {
      setChecking(false);
    }
  }

  function handleContinue() {
    setFeedback(null);
    setSelectedOption(null);
    setTextAnswer('');
    setShowHint(false);
    setIndex((i) => i + 1);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Preparing your lesson...</p>
        </CardContent>
      </Card>
    );
  }

  if (error && questions.length === 0) {
    return (
      <Card className="border-destructive">
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => loadQuestions()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (finished) {
    const correctCount = results.filter(Boolean).length;
    const accuracy = questions.length > 0 ? correctCount / questions.length : 0;
    const passed = accuracy >= PASS_THRESHOLD;

    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <h3 className="text-lg font-semibold">{passed ? 'Lesson complete' : 'Not quite there yet'}</h3>
          <p className="text-3xl font-semibold tabular-nums">{Math.round(accuracy * 100)}%</p>
          <p className="text-sm text-muted-foreground">
            {correctCount} of {questions.length} correct
            {!passed && ` — need ${Math.round(PASS_THRESHOLD * 100)}% to complete this lesson`}
          </p>
          <div className="flex justify-center gap-2">
            {passed ? (
              <Button onClick={onPassed}>Finish lesson</Button>
            ) : (
              <Button
                onClick={() => {
                  setRegenerating(true);
                  loadQuestions(true);
                }}
                disabled={regenerating}
              >
                {regenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                Practice again
              </Button>
            )}
            <Button variant="ghost" onClick={onExit}>Exit</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!current) return null;

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="text-muted-foreground hover:text-foreground" title="Exit lesson">
            <X className="h-4 w-4" />
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(index / questions.length) * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {index + 1}/{questions.length}
          </span>
        </div>

        <div className="space-y-3">
          <p className="flex items-start gap-1.5 text-lg font-medium leading-relaxed">
            {current.prompt}
            {(current.question_type === 'translation' || current.question_type === 'fill_blank') && (
              <SpeakButton text={current.prompt.replace(/___/g, '')} language={language} />
            )}
          </p>

          {current.question_type === 'multiple_choice' && current.options && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {current.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => !feedback && setSelectedOption(opt)}
                  disabled={!!feedback}
                  className={cn(
                    'rounded-lg border p-3 text-left text-sm transition-colors',
                    selectedOption === opt
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/5',
                    feedback && opt === feedback.verdict.correctAnswer && 'border-success bg-success/10',
                    feedback && selectedOption === opt && !feedback.verdict.correct && 'border-destructive bg-destructive/10'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {current.question_type !== 'multiple_choice' && (
            <Input
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !feedback && handleCheck()}
              placeholder={`Type your answer in ${language}...`}
              disabled={!!feedback}
              autoFocus
            />
          )}

          {current.hint && !feedback && (
            <div>
              {showHint ? (
                <p className="text-xs text-muted-foreground">
                  <Lightbulb className="mr-1 inline h-3.5 w-3.5" />
                  {current.hint}
                </p>
              ) : (
                <button
                  onClick={() => setShowHint(true)}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Show hint
                </button>
              )}
            </div>
          )}
        </div>

        {feedback && (
          <div
            className={cn(
              'space-y-1 rounded-lg border-2 p-3',
              feedback.verdict.correct ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5'
            )}
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {feedback.verdict.correct ? (
                <>
                  <Check className="h-4 w-4" /> {feedback.verdict.minorError ? 'Correct (minor typo)' : 'Correct!'}
                </>
              ) : (
                <>
                  <X className="h-4 w-4" /> Not quite.
                </>
              )}
            </p>
            {!feedback.verdict.correct && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                Correct answer: <span className="font-medium text-foreground">{feedback.verdict.correctAnswer}</span>
                <SpeakButton text={feedback.verdict.correctAnswer} language={language} />
              </p>
            )}
            {feedback.verdict.explanation && (
              <p className="text-xs text-muted-foreground">{feedback.verdict.explanation}</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={feedback ? handleContinue : handleCheck}
          disabled={
            checking ||
            (!feedback &&
              (current.question_type === 'multiple_choice' ? !selectedOption : !textAnswer.trim()))
          }
          className="w-full"
        >
          {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {feedback ? 'Continue' : 'Check'}
        </Button>
      </CardContent>
    </Card>
  );
}
