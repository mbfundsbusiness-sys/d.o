import { addDaysISO } from '@/lib/utils/dates';

export type PlanBill = { id: string; name: string; amount: number };
export type PlanItem = {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  target_cost: number | null;
  saved_amount: number;
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

/** Bills first, then fill goal pots in priority order (oldest first within a priority) until the money runs out. */
export function buildPlan(pay: number, bills: PlanBill[], items: PlanItem[]): PaydayPlan {
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);
  let left = Math.max(0, pay - billsTotal);
  const ordered = items
    .filter((i) => i.target_cost != null && Number(i.target_cost) > 0)
    .sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.created_at.localeCompare(b.created_at));
  const pots: PotLine[] = [];
  for (const i of ordered) {
    const target = Number(i.target_cost);
    const saved = Number(i.saved_amount);
    const need = Math.max(0, target - saved);
    const add = Math.round(Math.min(need, left) * 100) / 100;
    left = Math.round((left - add) * 100) / 100;
    pots.push({ id: i.id, title: i.title, add, saved: saved + add, target, fullyFunded: saved + add >= target });
  }
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
