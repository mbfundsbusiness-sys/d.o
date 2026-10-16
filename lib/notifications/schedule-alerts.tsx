'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase, type ScheduleBlock, type UserSettings, type TodoItem, type WorkShift } from '@/lib/supabase/client';
import { fetchShifts, shiftsOn } from '@/lib/schedule/shifts';
import { useAuth } from '@/lib/auth/provider';
import { londonNow } from '@/lib/utils/dates';
import { effectiveBlocksForDay } from '@/lib/schedule/effective';

export type ScheduleBanner = {
  id: string; // dedupe key
  kind: 't15' | 'start' | 'prep';
  title: string;
  body: string;
};

type ScheduleAlertsContextValue = {
  banners: ScheduleBanner[];
  dismiss: (id: string) => void;
};

const ScheduleAlertsContext = createContext<ScheduleAlertsContextValue>({
  banners: [],
  dismiss: () => {},
});

const FIRED_KEY = 'schedule-alerts-fired';
const TICK_MS = 20_000;
const DATA_REFRESH_MS = 5 * 60_000;

function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistFired(fired: Set<string>) {
  try {
    // Keep it from growing forever — cap at the most recent 200 keys.
    const arr = Array.from(fired).slice(-200);
    localStorage.setItem(FIRED_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export function ScheduleAlertsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [banners, setBanners] = useState<ScheduleBanner[]>([]);
  const blocksRef = useRef<ScheduleBlock[]>([]);
  const settingsRef = useRef<UserSettings | null>(null);
  const todosRef = useRef<TodoItem[]>([]);
  const shiftsRef = useRef<WorkShift[]>([]);
  const firedRef = useRef<Set<string>>(new Set());

  const dismiss = useCallback((id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const fire = useCallback((banner: ScheduleBanner) => {
    setBanners((prev) => (prev.some((b) => b.id === banner.id) ? prev : [...prev, banner]));

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        // Best-effort native notification (only while the tab is open — no
        // service worker, so this does not fire in the background).
        new Notification(banner.title, { body: banner.body });
      } catch {
        // ignore — the in-app banner is the reliable path
      }
    }

    if (banner.kind === 'start') {
      setTimeout(() => dismiss(banner.id), 60_000);
    }
  }, [dismiss]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const todayStr = londonNow().dateISO;
    shiftsRef.current = await fetchShifts(todayStr, todayStr);
    const [blocksRes, settingsRes, todosRes] = await Promise.all([
      supabase.from('schedule_blocks').select('*'),
      supabase.from('user_settings').select('*').maybeSingle(),
      supabase.from('todo_items').select('*').eq('completed', false).not('due_at', 'is', null),
    ]);
    if (!blocksRes.error) blocksRef.current = (blocksRes.data ?? []) as ScheduleBlock[];
    if (!settingsRes.error) settingsRef.current = (settingsRes.data ?? null) as UserSettings | null;
    if (!todosRes.error) todosRef.current = (todosRes.data ?? []) as TodoItem[];
  }, [user]);

  const check = useCallback(() => {
    if (!user) return;
    const now = londonNow();
    // Prayer used to be a separate settings.prayer_times-driven virtual
    // block here; it's now a real schedule_blocks row (source='auto',
    // activity_type='prayer', written by lib/prayer/schedule-sync.ts) and
    // gets its alert from this same loop like every other module.
    const today = effectiveBlocksForDay(blocksRef.current, settingsRef.current, now.dayOfWeek, shiftsOn(shiftsRef.current, now.dateISO));

    for (const block of today) {
      const minsUntil = block.startMin - now.minutesOfDay;

      // On a shift day the shift wins: don't buzz you about gym/work/learning blocks that
      // fall inside it. Lectures and prayers still alert (flagged as a clash in the text).
      const isLectureOrPrayer = /^uni lecture/i.test(block.label) || block.activity_type === 'prayer';
      if (block.clashesWith && !isLectureOrPrayer) continue;
      const clashNote = block.clashesWith ? ` — clashes with ${block.clashesWith}` : '';

      // Early heads-up for a shift (getting out the door), on top of the normal 15-minute alert.
      if (block.kind === 'shift') {
        const prepKey = `${block.id}:${now.dateISO}:prep`;
        if (minsUntil > 15 && minsUntil <= 60 && !firedRef.current.has(prepKey)) {
          firedRef.current.add(prepKey);
          persistFired(firedRef.current);
          fire({ id: prepKey, kind: 'prep', title: `Shift in ${minsUntil} min`, body: `${block.label} starts at ${block.start_time}` });
        }
      }

      const isPointInTime = block.start_time === block.end_time;
      const range = isPointInTime ? block.start_time : `${block.start_time}–${block.end_time}`;

      const t15Key = `${block.id}:${now.dateISO}:t15`;
      if (minsUntil > 0 && minsUntil <= 15 && !firedRef.current.has(t15Key)) {
        firedRef.current.add(t15Key);
        persistFired(firedRef.current);
        fire({
          id: t15Key,
          kind: 't15',
          title: `${block.label} in ${minsUntil} min`,
          body: `Starts at ${range}${clashNote}`,
        });
      }

      const startKey = `${block.id}:${now.dateISO}:start`;
      if (minsUntil <= 0 && minsUntil > -3 && !firedRef.current.has(startKey)) {
        firedRef.current.add(startKey);
        persistFired(firedRef.current);
        fire({
          id: startKey,
          kind: 'start',
          title: `${block.label} — starting now`,
          body: `${range}${clashNote}`,
        });
      }
    }

    // To-dos: a one-off absolute due time rather than a recurring
    // time-of-day, so this is a plain millisecond diff, not the
    // day-of-week/minutes-of-day machinery above.
    const nowMs = Date.now();
    for (const todo of todosRef.current) {
      if (!todo.due_at) continue;
      const dueMs = new Date(todo.due_at).getTime();
      const minsUntil = Math.round((dueMs - nowMs) / 60_000);
      const due = new Date(todo.due_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      const t15Key = `todo-${todo.id}:t15`;
      if (minsUntil > 0 && minsUntil <= 15 && !firedRef.current.has(t15Key)) {
        firedRef.current.add(t15Key);
        persistFired(firedRef.current);
        fire({
          id: t15Key,
          kind: 't15',
          title: `${todo.title} in ${minsUntil} min`,
          body: `Due at ${due}`,
        });
      }

      const startKey = `todo-${todo.id}:start`;
      if (minsUntil <= 0 && minsUntil > -3 && !firedRef.current.has(startKey)) {
        firedRef.current.add(startKey);
        persistFired(firedRef.current);
        fire({
          id: startKey,
          kind: 'start',
          title: `${todo.title} — due now`,
          body: due,
        });
      }
    }
  }, [user, fire]);

  useEffect(() => {
    firedRef.current = loadFired();
  }, []);

  useEffect(() => {
    if (!user) {
      blocksRef.current = [];
      settingsRef.current = null;
      setBanners([]);
      return;
    }

    let cancelled = false;
    void loadData().then(() => {
      if (!cancelled) check();
    });

    const tick = setInterval(check, TICK_MS);
    const dataTimer = setInterval(() => void loadData(), DATA_REFRESH_MS);
    const onFocus = () => void loadData().then(() => check());
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(dataTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, loadData, check]);

  return (
    <ScheduleAlertsContext.Provider value={{ banners, dismiss }}>
      {children}
    </ScheduleAlertsContext.Provider>
  );
}

export function useScheduleAlerts() {
  return useContext(ScheduleAlertsContext);
}
