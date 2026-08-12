'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type LanguageSession, type LanguageActivityType } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Languages, Clock } from 'lucide-react';
import { formatDateUK } from '@/lib/utils/dates';

const ACTIVITY_LABELS: Record<LanguageActivityType, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  listening: 'Listening',
  speaking: 'Speaking',
  reading: 'Reading',
};

export function LanguageModule() {
  const [sessions, setSessions] = useState<LanguageSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('language_sessions')
      .select('*')
      .order('started_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setSessions(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const completed = sessions.filter((s) => s.ended_at !== null && s.duration_min !== null);

  // Streak: consecutive days with at least one completed session
  const streak = computeLanguageStreak(completed);

  // Weekly time: last 7 days
  const weeklyMinutes = computeWeeklyMinutes(completed);
  const weeklyLanguages = getUniqueLanguages(completed);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Current streak</span>
              <Languages className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{streak}</span>
              <span className="text-xs text-muted-foreground">{streak === 1 ? 'day' : 'days'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">This week</span>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{weeklyMinutes}</span>
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Languages</span>
              <Languages className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {weeklyLanguages.length > 0 ? (
                weeklyLanguages.map((lang) => (
                  <Badge key={lang} variant="secondary" className="text-xs">{lang}</Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">None yet</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly bar view */}
      <WeeklyBars sessions={completed} />

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed sessions yet. Start a language session from the timer above.
            </p>
          ) : (
            completed.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{s.language}</span>
                    <Badge variant="secondary" className="text-xs">
                      {ACTIVITY_LABELS[s.activity_type]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateUK(s.started_at.slice(0, 10))} · {new Date(s.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {s.note && <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>}
                </div>
                <span className="ml-3 shrink-0 text-sm font-semibold tabular-nums">
                  {s.duration_min}m
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function computeLanguageStreak(sessions: LanguageSession[]): number {
  if (sessions.length === 0) return 0;
  const days = new Set<string>();
  for (const s of sessions) {
    days.add(s.started_at.slice(0, 10));
  }
  const sorted = Array.from(days).sort().reverse();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (sorted[0] !== todayStr && sorted[0] !== yesterdayStr) return 0;

  let streak = 0;
  const cursor = new Date(sorted[0] + 'T00:00:00');
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeWeeklyMinutes(sessions: LanguageSession[]): number {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return sessions
    .filter((s) => new Date(s.started_at) >= sevenDaysAgo)
    .reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
}

function getUniqueLanguages(sessions: LanguageSession[]): string[] {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recent = sessions.filter((s) => new Date(s.started_at) >= sevenDaysAgo);
  return Array.from(new Set(recent.map((s) => s.language)));
}

function WeeklyBars({ sessions }: { sessions: LanguageSession[] }) {
  const days: { label: string; minutes: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const minutes = sessions
      .filter((s) => s.started_at.slice(0, 10) === dateStr)
      .reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
    days.push({
      label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      minutes,
    });
  }

  const maxMinutes = Math.max(...days.map((d) => d.minutes), 60);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">This week</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2 h-32">
          {days.map((day, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-md transition-all ${
                    day.minutes > 0 ? 'bg-accent' : 'bg-muted'
                  }`}
                  style={{ height: `${Math.max(2, (day.minutes / maxMinutes) * 100)}%` }}
                  title={`${day.minutes} min`}
                />
              </div>
              <span className="text-xs text-muted-foreground">{day.label}</span>
              <span className="text-xs font-medium tabular-nums">{day.minutes}m</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
