import { describe, it, expect } from 'vitest';
import { buildPlan, nextPayday, daysUntil } from './payday';

const item = (id: string, priority: 'high' | 'medium' | 'low', target: number | null, saved = 0, created = '2026-01-01') => ({
  id, title: id, priority, target_cost: target, saved_amount: saved, created_at: created,
});

describe('buildPlan', () => {
  it('pays bills first, then fills pots by priority', () => {
    const p = buildPlan(1000, [{ id: 'r', name: 'Phone', amount: 200 }], [item('low', 'low', 100), item('high', 'high', 500), item('med', 'medium', 400)]);
    expect(p.billsTotal).toBe(200);
    expect(p.pots.map((x) => [x.id, x.add])).toEqual([['high', 500], ['med', 300], ['low', 0]]);
    expect(p.unallocated).toBe(0);
  });
  it('counts existing savings and reports leftover', () => {
    const p = buildPlan(1000, [], [item('a', 'high', 300, 250)]);
    expect(p.pots[0].add).toBe(50);
    expect(p.pots[0].fullyFunded).toBe(true);
    expect(p.unallocated).toBe(950);
  });
  it('flags bills not covered', () => {
    const p = buildPlan(100, [{ id: 'b', name: 'Bill', amount: 150 }], [item('a', 'high', 50)]);
    expect(p.afterBills).toBe(-50);
    expect(p.pots[0].add).toBe(0);
  });
});

describe('nextPayday', () => {
  it('today counts, later month rolls, short months clamp', () => {
    expect(nextPayday('2026-10-16', 16)).toBe('2026-10-16');
    expect(nextPayday('2026-10-16', 15)).toBe('2026-11-15');
    expect(nextPayday('2026-12-20', 5)).toBe('2027-01-05');
    expect(nextPayday('2027-02-10', 31)).toBe('2027-02-28');
    expect(daysUntil('2026-10-16', '2026-11-15')).toBe(30);
  });
});
