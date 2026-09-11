'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type PlayableQuestion, type AnswerVerdict, type NextQuestionResponse } from '@/lib/supabase/client';
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
type Summary = { correctCount: number; totalCount: number };

export function LanguageLessonPlayer({
  lessonId,
  language,
  focusArea,
  reviewMode = false,
  onExit,
  onPassed,
}: {
  lessonId: string;
  language: string;
  focusArea: string;
  /** True when reviewing an already-completed lesson (spaced repetition) rather than learning it for the first time. */
  reviewMode?: boolean;
  onExit: () => void;
  onPassed: (accuracy: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<PlayableQuestion | null>(null);
  const [progress, setProgress] = useState({ answered: 0, total: 8 });
  const [ability, setAbility] = useState(50);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [checking, setChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const fetchNext = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/language/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ moduleId: lessonId, reset }),
      });
      const data: NextQuestionResponse = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || 'Failed to load question');

      setAbility(data.ability);
      setProgress({ answered: data.answeredCount, total: data.totalCount });
      setFeedback(null);
      setSelectedOption(null);
      setTextAnswer('');
      setShowHint(false);

      if (data.done) {
        setSummary({ correctCount: data.correctCount ?? 0, totalCount: data.totalCount });
        setQuestion(null);
      } else {
        setSummary(null);
        setQuestion(data.question);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load question');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    // A review always starts a fresh question set — the lesson's original 8
    // are already fully answered from when it was first completed.
    fetchNext(reviewMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchNext]);

  async function handleCheck() {
    if (!question) return;
    const given = question.question_type === 'multiple_choice' ? selectedOption ?? '' : textAnswer;
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
        body: JSON.stringify({ questionId: question.id, answer: given, hintUsed: showHint }),
      });
      const data: AnswerVerdict = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || 'Failed to check answer');

      setFeedback({ verdict: data, givenAnswer: given });
      setAbility(data.ability);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check answer');
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Preparing your next question...</p>
        </CardContent>
      </Card>
    );
  }

  if (error && !question && !summary) {
    return (
      <Card className="border-destructive">
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchNext()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (summary) {
    const accuracy = summary.totalCount > 0 ? summary.correctCount / summary.totalCount : 0;
    const passed = accuracy >= PASS_THRESHOLD;

    const heading = passed
      ? reviewMode ? 'Review complete' : 'Lesson complete'
      : reviewMode ? "Needs another look" : 'Not quite there yet';
    const actionLabel = reviewMode ? 'Done' : 'Finish lesson';
    const failedHint = reviewMode
      ? `— below ${Math.round(PASS_THRESHOLD * 100)}%, this concept's review interval resets`
      : `— need ${Math.round(PASS_THRESHOLD * 100)}% to complete this lesson`;

    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <h3 className="text-lg font-semibold">{heading}</h3>
          <p className="text-3xl font-semibold tabular-nums">{Math.round(accuracy * 100)}%</p>
          <p className="text-sm text-muted-foreground">
            {summary.correctCount} of {summary.totalCount} correct
            {!passed && ` ${failedHint}`}
          </p>
          <div className="flex justify-center gap-2">
            {passed ? (
              <Button onClick={() => onPassed(accuracy)}>{actionLabel}</Button>
            ) : reviewMode ? (
              <Button onClick={() => onPassed(accuracy)}>Done</Button>
            ) : (
              <Button onClick={() => fetchNext(true)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Practice again
              </Button>
            )}
            <Button variant="ghost" onClick={onExit}>Exit</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!question) return null;

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
              style={{ width: `${(progress.answered / progress.total) * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {progress.answered + 1}/{progress.total}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Difficulty{' '}
            <span className="font-mono tabular-nums">
              {'●'.repeat(question.difficulty)}
              {'○'.repeat(5 - question.difficulty)}
            </span>
          </span>
          <span className="capitalize">{focusArea} ability {Math.round(ability)}%</span>
        </div>

        <div className="space-y-3">
          <p className="flex items-start gap-1.5 text-lg font-medium leading-relaxed">
            {question.prompt}
            {(question.question_type === 'translation' || question.question_type === 'fill_blank') && (
              <SpeakButton text={question.prompt.replace(/___/g, '')} language={language} />
            )}
          </p>

          {question.question_type === 'multiple_choice' && question.options && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {question.options.map((opt) => (
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

          {question.question_type !== 'multiple_choice' && (
            <Input
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !feedback && handleCheck()}
              placeholder={`Type your answer in ${language}...`}
              disabled={!!feedback}
              autoFocus
            />
          )}

          {question.hint && !feedback && (
            <div>
              {showHint ? (
                <p className="text-xs text-muted-foreground">
                  <Lightbulb className="mr-1 inline h-3.5 w-3.5" />
                  {question.hint}
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
          onClick={feedback ? () => fetchNext() : handleCheck}
          disabled={
            checking ||
            (!feedback &&
              (question.question_type === 'multiple_choice' ? !selectedOption : !textAnswer.trim()))
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
