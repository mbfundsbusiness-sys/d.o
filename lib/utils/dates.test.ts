import { describe, it, expect, vi, afterEach } from 'vitest';
import { addDaysISO, dayStreak, londonDateISO, todayISO, workingDaysBetween, londonToUtcISO } from './dates';

afterEach(() => vi.useRealTimers());

describe('London date handling (regression: streaks read 0 in BST)', () => {
  it('todayISO is the London date, not the UTC date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T23:30:00Z')); // 00:30 BST on the 17th
    expect(todayISO()).toBe('2026-10-17');
  });

  it('londonDateISO converts instants to London calendar dates', () => {
    expect(londonDateISO('2026-10-16T23:30:00Z')).toBe('2026-10-17');
    expect(londonDateISO('2026-12-16T23:30:00Z')).toBe('2026-12-16');
  });

  it('addDaysISO is pure calendar arithmetic across the DST change', () => {
    expect(addDaysISO('2026-10-26', -1)).toBe('2026-10-25');
    expect(addDaysISO('2026-10-25', -1)).toBe('2026-10-24');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('dayStreak counts back from today, or yesterday if today is unfinished', () => {
    const days = new Set(['2026-10-14', '2026-10-15', '2026-10-16']);
    expect(dayStreak(days, '2026-10-16')).toBe(3);
    expect(dayStreak(new Set(['2026-10-15']), '2026-10-16')).toBe(1);
    expect(dayStreak(new Set(['2026-10-14']), '2026-10-16')).toBe(0);
  });

  it('workingDaysBetween skips the summer bank holiday in BST', () => {
    // Mon 24 Aug -> Fri 4 Sep 2026: 9 weekdays, Mon 31 Aug is a bank holiday => 8 + (4 Sep exclusive)
    expect(workingDaysBetween(new Date('2026-08-24T00:00:00+01:00'), new Date('2026-09-04T00:00:00+01:00'))).toBe(8);
  });
});

describe('londonToUtcISO', () => {
  it('handles GMT and BST', () => {
    expect(londonToUtcISO('2026-12-01', '09:00')).toBe('2026-12-01T09:00:00.000Z');
    expect(londonToUtcISO('2026-07-01', '09:00')).toBe('2026-07-01T08:00:00.000Z');
  });
});
