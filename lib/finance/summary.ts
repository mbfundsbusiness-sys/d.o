import type { Bill, PotItem, WishlistItem, WorkShift } from '@/lib/supabase/types';
import { potStats, type PotStats } from '@/lib/finance/pots';
import { minutesOfDay } from '@/lib/utils/dates';

// DPD: self-employed, paid per parcel, monthly. Van fuel is covered, so there are
// no running costs to deduct; only tax/NI is set aside.

export type ShiftPay = {
  id: string;
  date: string;
  drops: number | null;
  rate: number | null;
  /** null until both drops and a rate are known. */
  pay: number | null;
  hours: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function shiftPay(s: WorkShift, defaultRate: number | null): ShiftPay {
  const rate = s.rate_per_drop != null ? Number(s.rate_per_drop) : defaultRate;
  const start = s.actual_start ?? s.start_time;
  const end = s.actual_end ?? s.end_time;
  const mins = start && end ? minutesOfDay(end) - minutesOfDay(start) : null;
  return {
    id: s.id,
    date: s.shift_date,
    drops: s.drops,
    rate,
    pay: s.drops != null && rate != null ? round2(s.drops * rate) : null,
    hours: mins != null && mins > 0 ? round2(mins / 60) : null,
  };
}

export function monthlyEquivalent(b: Pick<Bill, 'amount' | 'cadence'>): number {
  const a = Number(b.amount);
  if (b.cadence === 'weekly') return round2((a * 52) / 12);
  if (b.cadence === 'yearly') return round2(a / 12);
  return round2(a);
}

export type MonthEarnings = {
  month: string; // YYYY-MM
  shiftsWorked: number;
  drops: number;
  /** Drops on shifts with no rate yet, so not counted in `earned`. */
  unpricedDrops: number;
  earned: number;
  taxSetAside: number;
  afterTax: number;
  perDrop: number | null;
  perHour: number | null;
};

/** Earnings for the shifts in one calendar month that have drops logged. */
export function monthEarnings(month: string, shifts: WorkShift[], defaultRate: number | null, taxPct: number): MonthEarnings {
  const lines = shifts.filter((s) => s.shift_date.startsWith(month) && s.drops != null).map((s) => shiftPay(s, defaultRate));
  const earned = round2(lines.reduce((t, l) => t + (l.pay ?? 0), 0));
  const drops = lines.reduce((t, l) => t + (l.drops ?? 0), 0);
  const unpricedDrops = lines.filter((l) => l.pay == null).reduce((t, l) => t + (l.drops ?? 0), 0);
  const priced = lines.filter((l) => l.pay != null);
  const pricedHours = priced.reduce((t, l) => t + (l.hours ?? 0), 0);
  const taxSetAside = round2((earned * taxPct) / 100);
  return {
    month,
    shiftsWorked: lines.length,
    drops,
    unpricedDrops,
    earned,
    taxSetAside,
    afterTax: round2(earned - taxSetAside),
    perDrop: drops - unpricedDrops > 0 ? round2(earned / (drops - unpricedDrops)) : null,
    perHour: pricedHours > 0 ? round2(earned / pricedHours) : null,
  };
}

export type PotView = { id: string; title: string; priority: string; status: string; stats: PotStats; items: PotItem[] };

export function potViews(pots: WishlistItem[], items: PotItem[]): PotView[] {
  return pots.map((p) => ({
    id: p.id,
    title: p.title,
    priority: p.priority,
    status: p.status,
    stats: potStats(p, items),
    items: items.filter((i) => i.pot_id === p.id).sort((a, b) => a.sort - b.sort),
  }));
}
