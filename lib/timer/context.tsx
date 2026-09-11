'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type ActivityKind } from '@/lib/supabase/client';

export type RunningSession = {
  id: string;
  kind: ActivityKind;
  started_at: string;
  language?: string;
  activity_type?: string;
  workout_type?: string;
  in_plan?: boolean;
  title?: string;
  pages?: number;
  course_name?: string;
  note?: string | null;
};

type TimerContextValue = {
  running: RunningSession | null;
  loading: boolean;
  startSession: (kind: ActivityKind, opts?: {
    language?: string;
    activity_type?: string;
    workout_type?: string;
    in_plan?: boolean;
    title?: string;
    course_name?: string;
    note?: string;
  }) => Promise<void>;
  completeSession: (opts?: { note?: string; in_plan?: boolean }) => Promise<void>;
  cancelSession: () => Promise<void>;
  refresh: () => Promise<void>;
};

const TimerContext = createContext<TimerContextValue>({
  running: null,
  loading: true,
  startSession: async () => {},
  completeSession: async () => {},
  cancelSession: async () => {},
  refresh: async () => {},
});

const TABLE_MAP: Record<ActivityKind, string> = {
  trading: 'trading_sessions',
  gym: 'gym_sessions',
  language: 'language_sessions',
  job_search: 'job_search_sessions',
  reading: 'reading_sessions',
  course: 'course_sessions',
};

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState<RunningSession | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);

  const checkRunning = useCallback(async () => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      setLoading(false);
      return;
    }

    // Check all four tables for an open session (ended_at IS NULL)
    const kinds: ActivityKind[] = ['trading', 'gym', 'language', 'job_search', 'reading', 'course'];
    for (const kind of kinds) {
      const table = TABLE_MAP[kind];
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) continue;
      if (data) {
        setRunning({
          id: data.id,
          kind,
          started_at: data.started_at,
          language: data.language,
          activity_type: data.activity_type,
          workout_type: data.workout_type,
          in_plan: data.in_plan,
          title: data.title,
          pages: data.pages,
          course_name: data.course_name,
          note: data.note,
        });
        setLoading(false);
        return;
      }
    }

    setRunning(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    checkRunning();
  }, [checkRunning]);

  const startSession = useCallback(async (
    kind: ActivityKind,
    opts?: {
      language?: string;
      activity_type?: string;
      workout_type?: string;
      in_plan?: boolean;
      title?: string;
      course_name?: string;
      note?: string;
    }
  ) => {
    if (running) return; // only one at a time

    const table = TABLE_MAP[kind];
    const insert: Record<string, unknown> = {
      started_at: new Date().toISOString(),
    };
    if (opts?.language) insert.language = opts.language;
    if (opts?.activity_type) insert.activity_type = opts.activity_type;
    if (opts?.workout_type) insert.workout_type = opts.workout_type;
    if (opts?.in_plan !== undefined) insert.in_plan = opts.in_plan;
    if (opts?.title) insert.title = opts.title;
    if (opts?.course_name) insert.course_name = opts.course_name;
    if (opts?.note) insert.note = opts.note;

    const { data, error } = await supabase
      .from(table)
      .insert(insert)
      .select()
      .single();

    if (error) throw new Error(error.message);

    setRunning({
      id: data.id,
      kind,
      started_at: data.started_at,
      language: data.language,
      activity_type: data.activity_type,
      workout_type: data.workout_type,
      in_plan: data.in_plan,
      note: data.note,
    });
  }, [running]);

  const completeSession = useCallback(async (opts?: { note?: string; in_plan?: boolean }) => {
    if (!running) return;

    const table = TABLE_MAP[running.kind];
    const endedAt = new Date().toISOString();
    const start = new Date(running.started_at);
    const end = new Date(endedAt);
    const durationMin = Math.round((end.getTime() - start.getTime()) / 60000 * 100) / 100;

    const update: Record<string, unknown> = {
      ended_at: endedAt,
      duration_min: durationMin,
    };
    if (opts?.note !== undefined) update.note = opts.note;
    if (opts?.in_plan !== undefined) update.in_plan = opts.in_plan;

    const { error } = await supabase
      .from(table)
      .update(update)
      .eq('id', running.id);

    if (error) throw new Error(error.message);
    setRunning(null);
  }, [running]);

  const cancelSession = useCallback(async () => {
    if (!running) return;
    const table = TABLE_MAP[running.kind];
    const { error } = await supabase.from(table).delete().eq('id', running.id);
    if (error) throw new Error(error.message);
    setRunning(null);
  }, [running]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await checkRunning();
  }, [checkRunning]);

  return (
    <TimerContext.Provider
      value={{ running, loading, startSession, completeSession, cancelSession, refresh }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  return useContext(TimerContext);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  trading: 'Trading',
  gym: 'Gym',
  language: 'Language',
  job_search: 'Job Search',
  reading: 'Reading',
  course: 'Course',
};
