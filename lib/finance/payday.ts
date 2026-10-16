import { addDaysISO } from '@/lib/utils/dates';

export type PlanBill = { id: string; name: string; amount: number };
export type PlanItem = {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  target_cost: number | null;
  saved_amount: number;
  /** Cost of sub-items already bought (counts toward the pot's progress). */
  spent?: number;
  /** Share of the leftover after all targeted pots are full (0 = none). */
  weight?: number;
  created_at: string;
};

export type PotLine = { id: string; title: string; add: number; saved: number; target: number; fullyFunded: boolean };
export type PaydayPlan = {
  pay: number;
  bills: PlanBill[];
  billsTotal: number;
  /** Pay left after bills (negative = bills not covered). */
  afterBills: number;
  pots: PotLine[];
  unallocated: number;
};

const RANK = { high: 0, medium: 1, low: 2 } as const;

/**
 * Bills first, then fill goal pots in priority order (oldest first within a priority) until the money
 * runs out. Whatever is left after every targeted pot is full is shared by `weight` (car, BotCouncil...).
 */
export function buildPlan(pay: number, bills: PlanBill[], items: PlanItem[]): PaydayPlan {
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);
  let left = Math.max(0, pay - billsTotal);
  const adds = new Map<string, number>();
  const ordered = items
    .filter((i) => i.target_cost != null && Number(i.target_cost) > 0)
    .sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.created_at.localeCompare(b.created_at));
  for (const i of ordered) {
    const need = Math.max(0, Number(i.target_cost) - Number(i.spent ?? 0) - Number(i.saved_amount));
    const add = Math.round(Math.min(need, left) * 100) / 100;
    left = Math.round((left - add) * 100) / 100;
    adds.set(i.id, add);
  }
  const weighted = items.filter((i) => (i.weight ?? 0) > 0);
  const totalW = weighted.reduce((s, i) => s + (i.weight ?? 0), 0);
  if (left > 0 && totalW > 0) {
    const pool = left;
    for (const i of weighted) {
      let share = Math.round(((pool * (i.weight ?? 0)) / totalW) * 100) / 100;
      if (i.target_cost != null && Number(i.target_cost) > 0) {
        const room = Math.max(0, Number(i.target_cost) - Number(i.spent ?? 0) - Number(i.saved_amount) - (adds.get(i.id) ?? 0));
        share = Math.min(share, room);
      }
      adds.set(i.id, Math.round(((adds.get(i.id) ?? 0) + share) * 100) / 100);
      left = Math.round((left - share) * 100) / 100;
    }
  }
  const rankOf = (id: string) => {
    const i = ordered.findIndex((o) => o.id === id);
    return i === -1 ? 1e6 : i;
  };
  const pots: PotLine[] = items
    .filter((i) => (adds.get(i.id) ?? 0) > 0 || (i.target_cost != null && Number(i.target_cost) > 0))
    .map((i) => {
      const add = adds.get(i.id) ?? 0;
      const target = Number(i.target_cost ?? 0);
      const saved = Number(i.saved_amount) + add;
      return { id: i.id, title: i.title, add, saved, target, fullyFunded: target > 0 && saved + Number(i.spent ?? 0) >= target };
    })
    .sort((a, b) => rankOf(a.id) - rankOf(b.id));
  return { pay, bills, billsTotal, afterBills: Math.round((pay - billsTotal) * 100) / 100, pots, unallocated: left };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Next payday on/after `today` for a monthly pay day-of-month (clamped for short months). */
export function nextPayday(today: string, dom: number): string {
  const [y, m] = today.split('-').map(Number);
  const pick = (yy: number, mm: number) =>
    `${yy}-${String(mm).padStart(2, '0')}-${String(Math.min(dom, daysInMonth(yy, mm))).padStart(2, '0')}`;
  const thisMonth = pick(y, m);
  if (thisMonth >= today) return thisMonth;
  return m === 12 ? pick(y + 1, 1) : pick(y, m + 1);
}

export function daysUntil(today: string, target: string): number {
  let n = 0;
  let d = today;
  while (d < target && n < 400) {
    d = addDaysISO(d, 1);
    n++;
  }
  return n;
}
