'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, type ActivityKind } from '@/lib/supabase/client';

export type RunningSession = {
  id: string;
  kind: ActivityKind;
  started_at: string;
  language?: string;
  activity_type?: string;
  workout_type?: string;
};

const TABLE_MAP: Record<ActivityKind, string> = {
  trading: 'trading_sessions',
  gym: 'gym_sessions',
  language: 'language_sessions',
  job_search: 'job_search_sessions',
};

/**
 * Universal activity timer hook.
 * - On mount, checks all 4 session tables for a row with ended_at IS NULL
 *   (a running session). If found, resumes it.
 * - startSession() inserts a new row with started_at = now(), persisted to DB.
 * - completeSession() writes ended_at + duration_min to the DB.
 * - cancelSession() deletes the running session row (no duration recorded).
 * - The live elapsed time is computed from started_at to now, updating every second.
 */
export function useActivityTimer() {
  const [running, setRunning] = useState<RunningSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Check for a running session on mount
  const checkForRunningSession = useCallback(async () => {
    setLoading(true);
    const kinds: ActivityKind[] = ['trading', 'gym', 'language', 'job_search'];
    for (const kind of kinds) {
      const table = TABLE_MAP[kind];
      const { data, error } = await supabase
        .from(table)
        .select('id, started_at, language, activity_type, workout_type')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        setRunning({ ...data, kind } as RunningSession);
        break;
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkForRunningSession();
  }, [checkForRunningSession]);

  // Live timer
  useEffect(() => {
    if (!running) {
      setElapsedSec(0);
      return;
    }
    const update = () => {
      const start = new Date(running.started_at).getTime();
      const now = Date.now();
      setElapsedSec(Math.max(0, Math.floor((now - start) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const startSession = useCallback(
    async (
      kind: ActivityKind,
      options?: {
        language?: string;
        activity_type?: string;
        workout_type?: string;
        in_plan?: boolean;
      }
    ): Promise<{ error: string | null }> => {
      if (running) return { error: 'A session is already running' };

      const table = TABLE_MAP[kind];
      const insertData: Record<string, unknown> = {
        started_at: new Date().toISOString(),
      };
      if (kind === 'language') {
        insertData.language = options?.language ?? 'General';
        insertData.activity_type = options?.activity_type ?? 'vocabulary';
      }
      if (kind === 'gym') {
        insertData.workout_type = options?.workout_type ?? null;
      }
      if (kind === 'trading') {
        insertData.in_plan = options?.in_plan ?? false;
      }

      const { data, error } = await supabase
        .from(table)
        .insert(insertData)
        .select('id, started_at, language, activity_type, workout_type')
        .single();

      if (error) return { error: error.message };

      setRunning({ ...data, kind } as RunningSession);
      return { error: null };
    },
    [running]
  );

  const completeSession = useCallback(
    async (options?: {
      in_plan?: boolean;
      note?: string;
      workout_type?: string;
      language?: string;
      activity_type?: string;
    }): Promise<{ error: string | null }> => {
      if (!running) return { error: 'No session running' };

      const table = TABLE_MAP[running.kind];
      const endedAt = new Date().toISOString();
      const start = new Date(running.started_at).getTime();
      const durationMin = Math.max(1, Math.round((Date.now() - start) / 60000));

      const updateData: Record<string, unknown> = {
        ended_at: endedAt,
        duration_min: durationMin,
      };
      if (options?.in_plan !== undefined) updateData.in_plan = options.in_plan;
      if (options?.note !== undefined) updateData.note = options.note || null;
      if (options?.workout_type !== undefined)
        updateData.workout_type = options.workout_type || null;
      if (options?.language !== undefined) updateData.language = options.language;
      if (options?.activity_type !== undefined)
        updateData.activity_type = options.activity_type;

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', running.id);

      if (error) return { error: error.message };

      setRunning(null);
      return { error: null };
    },
    [running]
  );

  const cancelSession = useCallback(async (): Promise<{ error: string | null }> => {
    if (!running) return { error: 'No session running' };

    const table = TABLE_MAP[running.kind];
    const { error } = await supabase.from(table).delete().eq('id', running.id);
    if (error) return { error: error.message };

    setRunning(null);
    return { error: null };
  }, [running]);

  return {
    running,
    loading,
    elapsedSec,
    startSession,
    completeSession,
    cancelSession,
    refresh: checkForRunningSession,
  };
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
