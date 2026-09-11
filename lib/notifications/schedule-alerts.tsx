'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase, type ScheduleBlock, type UserSettings, type PrayerName } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/provider';
import { londonNow, minutesOfDay, fmtHM } from '@/lib/utils/dates';
import { effectiveBlocksForDay } from '@/lib/schedule/effective';

const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

type AlertableBlock = { id: string; label: string; startMin: number; start_time: string; end_time: string };

export type ScheduleBanner = {
  id: string; // dedupe key
  kind: 't15' | 'start';
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
    const [blocksRes, settingsRes] = await Promise.all([
      supabase.from('schedule_blocks').select('*'),
      supabase.from('user_settings').select('*').maybeSingle(),
    ]);
    if (!blocksRes.error) blocksRef.current = (blocksRes.data ?? []) as ScheduleBlock[];
    if (!settingsRes.error) settingsRef.current = (settingsRes.data ?? null) as UserSettings | null;
  }, [user]);

  const check = useCallback(() => {
    if (!user) return;
    const now = londonNow();
    const scheduleToday = effectiveBlocksForDay(blocksRef.current, settingsRef.current, now.dayOfWeek);

    const prayerTimes = settingsRef.current?.prayer_times ?? {};
    const prayerBlocks: AlertableBlock[] = (Object.keys(prayerTimes) as PrayerName[])
      .filter((name) => prayerTimes[name])
      .map((name) => {
        const startMin = minutesOfDay(prayerTimes[name]!);
        return {
          id: `prayer-${name}`,
          label: PRAYER_LABELS[name],
          startMin,
          start_time: fmtHM(prayerTimes[name]!),
          end_time: fmtHM(prayerTimes[name]!),
        };
      });

    const today: AlertableBlock[] = [...scheduleToday, ...prayerBlocks];

    for (const block of today) {
      const minsUntil = block.startMin - now.minutesOfDay;

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
          body: `Starts at ${range}`,
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
          body: range,
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
