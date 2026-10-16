'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { addDaysISO, todayISO } from '@/lib/utils/dates';
import { EMPTY_TOTALS, GOALS, summariseGoals, type GoalStreak, type SessionRow } from '@/lib/utils/streaks';

const HISTORY_DAYS = 400;

export const EMPTY_GOAL_STREAK: GoalStreak = {
  current: 0,
  longest: 0,
  today: { ...EMPTY_TOTALS },
  todayQualifies: false,
  todayGoals: GOALS,
  recent: [],
  qualifyingLast30: 0,
};

async function sessions(table: string, sinceISO: string): Promise<SessionRow[]> {
  const { data } = await supabase
    .from(table)
    .select('started_at, duration_min')
    .gte('started_at', sinceISO)
    .not('ended_at', 'is', null);
  return (data ?? []) as SessionRow[];
}

/** Everything the streak needs, fetched in parallel. */
export async function fetchGoalStreak(): Promise<GoalStreak> {
  const today = todayISO();
  const sinceDate = addDaysISO(today, -HISTORY_DAYS);
  const sinceISO = new Date(sinceDate + 'T00:00:00Z').toISOString();

  const [anchors, shiftRows, lectureRows, botcouncil, reading, language, course, gym] = await Promise.all([
    supabase.from('anchor_logs').select('log_date, wake_time').gte('log_date', sinceDate),
    supabase.from('work_shifts').select('shift_date').gte('shift_date', sinceDate),
    supabase.from('recurring_commitments').select('applies_days').eq('active', true).ilike('label', 'Uni Lecture%'),
    sessions('botcouncil_sessions', sinceISO),
    sessions('reading_sessions', sinceISO),
    sessions('language_sessions', sinceISO),
    sessions('course_sessions', sinceISO),
    sessions('gym_sessions', sinceISO),
  ]);

  return summariseGoals(
    {
      anchorLogs: anchors.data ?? [],
      botcouncil,
      learning: [...reading, ...language, ...course],
      gym,
      shiftDates: ((shiftRows.data ?? []) as { shift_date: string }[]).map((r) => r.shift_date),
      lectureDows: ((lectureRows.data ?? []) as { applies_days: number[] | null }[]).flatMap((r) => r.applies_days ?? []),
    },
    today
  );
}

/** Goal streak for the current user; `refresh` re-reads after a log/timer change. */
export function useGoalStreak() {
  const [data, setData] = useState<GoalStreak>(EMPTY_GOAL_STREAK);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setData(await fetchGoalStreak());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...data, loading, refresh };
}
