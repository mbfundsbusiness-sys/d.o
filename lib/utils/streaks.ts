import type { AnchorLog } from '@/lib/supabase/client';

/**
 * Compute the current streak of consecutive days (ending today or yesterday)
 * where all four anchors were completed:
 * - wake_time is non-empty
 * - applications_sent >= 1
 * - trading_in_plan === true
 * - botcouncil_checked === true
 *
 * A day counts if ANY log entry for that day satisfies all four.
 * The streak counts back from the most recent qualifying day; if the most
 * recent qualifying day is today or yesterday, the streak is active.
 */
export function computeAnchorStreak(logs: AnchorLog[]): number {
  if (logs.length === 0) return 0;

  // Build a map: date -> did all anchors hit?
  const dayMap = new Map<string, boolean>();
  for (const log of logs) {
    const allHit =
      !!log.wake_time &&
      log.applications_sent >= 1 &&
      log.trading_in_plan &&
      log.botcouncil_checked;
    if (allHit) {
      dayMap.set(log.log_date, true);
    }
  }

  if (dayMap.size === 0) return 0;

  // Find the most recent qualifying day
  const sortedDays = Array.from(dayMap.keys()).sort().reverse();
  const mostRecent = sortedDays[0];

  // Check if streak is "active" — most recent day is today or yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (mostRecent !== todayStr && mostRecent !== yesterdayStr) {
    return 0; // streak broken
  }

  // Count back consecutively
  let streak = 0;
  const cursor = new Date(mostRecent + 'T00:00:00');
  while (true) {
    const cursorStr = cursor.toISOString().slice(0, 10);
    if (dayMap.has(cursorStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Compute the longest streak ever from the logs.
 */
export function computeLongestStreak(logs: AnchorLog[]): number {
  if (logs.length === 0) return 0;

  const dayMap = new Map<string, boolean>();
  for (const log of logs) {
    const allHit =
      !!log.wake_time &&
      log.applications_sent >= 1 &&
      log.trading_in_plan &&
      log.botcouncil_checked;
    if (allHit) {
      dayMap.set(log.log_date, true);
    }
  }

  if (dayMap.size === 0) return 0;

  const sortedDays = Array.from(dayMap.keys()).sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1] + 'T00:00:00');
    const curr = new Date(sortedDays[i] + 'T00:00:00');
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

/**
 * Return the set of dates (ISO strings) that have at least one qualifying log.
 */
export function getQualifyingDays(logs: AnchorLog[]): Set<string> {
  const set = new Set<string>();
  for (const log of logs) {
    const allHit =
      !!log.wake_time &&
      log.applications_sent >= 1 &&
      log.trading_in_plan &&
      log.botcouncil_checked;
    if (allHit) set.add(log.log_date);
  }
  return set;
}
