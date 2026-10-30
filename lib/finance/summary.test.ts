import { describe, expect, it } from 'vitest';
import { monthEarnings, monthlyEquivalent, shiftPay } from '@/lib/finance/summary';
import type { WorkShift } from '@/lib/supabase/types';

const s = (over: Partial<WorkShift>): WorkShift => ({
  id: 'x', user_id: 'u', shift_date: '2026-10-28', start_time: '07:00', end_time: '15:00', title: 'DPD', note: null,
  actual_start: null, actual_end: null, drops: null, rate_per_drop: null, created_at: '', updated_at: '', ...over,
});

describe('DPD pay', () => {
  it('prices drops once a rate is known', () => {
    expect(shiftPay(s({ drops: 100 }), null).pay).toBeNull();
    expect(shiftPay(s({ drops: 100 }), 1.2).pay).toBe(120);
    expect(shiftPay(s({ drops: 100, rate_per_drop: 1.5 }), 1.2).pay).toBe(150);
    expect(shiftPay(s({ actual_start: '07:30', actual_end: '15:30' }), 1).hours).toBe(8);
  });

  it('totals a month with the tax set-aside', () => {
    const m = monthEarnings('2026-10', [s({ drops: 100 }), s({ id: 'y', drops: 50, shift_date: '2026-10-29' }), s({ id: 'z', drops: 80, shift_date: '2026-09-30' })], 1, 20);
    expect(m).toMatchObject({ shiftsWorked: 2, drops: 150, earned: 150, taxSetAside: 30, afterTax: 120, unpricedDrops: 0 });
    expect(monthEarnings('2026-10', [s({ drops: 100 })], null, 20)).toMatchObject({ earned: 0, unpricedDrops: 100 });
  });

  it('converts bill cadences to monthly', () => {
    expect(monthlyEquivalent({ amount: 12, cadence: 'weekly' })).toBe(52);
    expect(monthlyEquivalent({ amount: 120, cadence: 'yearly' })).toBe(10);
  });
});
