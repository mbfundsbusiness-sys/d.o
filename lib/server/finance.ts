import type { SupabaseClient } from '@supabase/supabase-js';
import type { Rules } from '@/lib/rules';
import type { Bill, PaySettings, PotItem, WishlistItem, WorkShift } from '@/lib/supabase/types';
import { buildPlan, daysUntil, nextPayday, type PaydayPlan } from '@/lib/finance/payday';
import { monthEarnings, monthlyEquivalent, potViews, shiftPay, type MonthEarnings, type PotView, type ShiftPay } from '@/lib/finance/summary';
import { addDaysISO, todayISO } from '@/lib/utils/dates';

export type FinanceSummary = {
  today: string;
  thisMonth: MonthEarnings;
  lastMonth: MonthEarnings;
  recentShifts: (ShiftPay & { start: string; end: string; logged: boolean })[];
  upcomingShifts: { id: string; date: string; start: string; end: string }[];
  bills: (Bill & { monthly: number })[];
  billsMonthly: number;
  subsMonthly: number;
  pots: PotView[];
  pay: PaySettings | null;
  payday: { date: string; inDays: number; plan: PaydayPlan } | null;
};

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export async function financeSummary(db: SupabaseClient, userId: string, rules: Rules): Promise<FinanceSummary> {
  const today = todayISO();
  const month = today.slice(0, 7);
  const last = prevMonth(month);
  const [shiftsRes, billsRes, potsRes, itemsRes, payRes] = await Promise.all([
    db.from('work_shifts').select('*').eq('user_id', userId).gte('shift_date', `${last}-01`).lte('shift_date', addDaysISO(today, 21)).order('shift_date'),
    db.from('bills').select('*').eq('user_id', userId).order('name'),
    db.from('wishlist_items').select('*').eq('user_id', userId).order('created_at'),
    db.from('pot_items').select('*').eq('user_id', userId),
    db.from('pay_settings').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  const shifts = (shiftsRes.data ?? []) as WorkShift[];
  const bills = ((billsRes.data ?? []) as Bill[]).map((b) => ({ ...b, monthly: monthlyEquivalent(b) }));
  const pots = (potsRes.data ?? []) as WishlistItem[];
  const items = (itemsRes.data ?? []) as PotItem[];
  const pay = (payRes.data ?? null) as PaySettings | null;
  const { per_drop_rate: rate, tax_set_aside_pct: tax } = rules.finance;

  const active = bills.filter((b) => b.active);
  const sum = (xs: { monthly: number }[]) => Math.round(xs.reduce((t, b) => t + b.monthly, 0) * 100) / 100;

  let payday: FinanceSummary['payday'] = null;
  if (pay?.payday_dom && pay.expected_pay != null) {
    const date = nextPayday(today, pay.payday_dom);
    const plan = buildPlan(
      Number(pay.expected_pay),
      active.map((b) => ({ id: b.id, name: b.name, amount: b.monthly })),
      pots
        .filter((p) => p.status === 'active')
        .map((p) => ({
          id: p.id,
          title: p.title,
          priority: p.priority,
          target_cost: p.target_cost,
          saved_amount: Number(p.saved_amount ?? 0),
          spent: items.filter((i) => i.pot_id === p.id && i.purchased).reduce((t, i) => t + Number(i.cost), 0),
          weight: p.leftover_weight,
          created_at: p.created_at,
        }))
    );
    payday = { date, inDays: daysUntil(today, date), plan };
  }

  return {
    today,
    thisMonth: monthEarnings(month, shifts, rate, tax),
    lastMonth: monthEarnings(last, shifts, rate, tax),
    recentShifts: shifts
      .filter((s) => s.shift_date <= today)
      .slice(-10)
      .reverse()
      .map((s) => ({ ...shiftPay(s, rate), start: (s.actual_start ?? s.start_time).slice(0, 5), end: (s.actual_end ?? s.end_time).slice(0, 5), logged: s.drops != null })),
    upcomingShifts: shifts
      .filter((s) => s.shift_date > today || (s.shift_date === today && s.drops == null))
      .map((s) => ({ id: s.id, date: s.shift_date, start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) })),
    bills,
    billsMonthly: sum(active.filter((b) => b.kind !== 'subscription')),
    subsMonthly: sum(active.filter((b) => b.kind === 'subscription')),
    pots: potViews(pots, items),
    pay,
    payday,
  };
}

/** Compact text for the Finance assistant's prompt. Ids let tools address rows. */
export function describeFinance(f: FinanceSummary): string {
  const m = f.thisMonth;
  const lines = [
    `This month (${m.month}): ${m.shiftsWorked} shifts logged, ${m.drops} drops, earned £${m.earned}${m.unpricedDrops ? ` (+${m.unpricedDrops} drops not priced: per-drop rate unknown)` : ''}, set aside for tax £${m.taxSetAside}, after tax £${m.afterTax}${m.perHour ? `, £${m.perHour}/h` : ''}.`,
    `Last month (${f.lastMonth.month}): earned £${f.lastMonth.earned}, ${f.lastMonth.drops} drops.`,
    'Recent shifts:',
    ...f.recentShifts.map((s) => `  ${s.date} ${s.start}-${s.end} ${s.logged ? `${s.drops} drops${s.pay != null ? ` = £${s.pay}` : ''}` : 'NOT LOGGED'} id=${s.id}`),
    'Upcoming shifts:',
    ...f.upcomingShifts.map((s) => `  ${s.date} ${s.start}-${s.end} id=${s.id}`),
    `Bills £${f.billsMonthly}/mo, subscriptions £${f.subsMonthly}/mo:`,
    ...f.bills.map((b) => `  ${b.active ? '' : '(off) '}${b.name} [${b.kind}] £${b.amount}/${b.cadence}${b.due_dom ? ` due day ${b.due_dom}` : ''} id=${b.id}`),
    'Pots (wishlist):',
    ...f.pots.map(
      (p) =>
        `  ${p.title} [${p.priority}, ${p.status}] saved £${p.stats.saved}${p.stats.target != null ? ` of £${p.stats.target} (${Math.round(p.stats.pct ?? 0)}%)` : ''} id=${p.id}` +
        (p.items.length ? `\n${p.items.map((i) => `    - ${i.name} £${i.cost}${i.purchased ? ' (bought)' : ''} id=${i.id}`).join('\n')}` : '')
    ),
    f.pay ? `Pay settings: payday day ${f.pay.payday_dom ?? 'not set'}, expected £${f.pay.expected_pay ?? 'not set'}.` : 'Pay settings: none.',
  ];
  if (f.payday) {
    lines.push(
      `Next payday ${f.payday.date} (in ${f.payday.inDays} days). Plan: bills £${f.payday.plan.billsTotal}, ` +
        f.payday.plan.pots.filter((p) => p.add > 0).map((p) => `${p.title} +£${p.add}`).join(', ') +
        `, left over £${f.payday.plan.unallocated}.`
    );
  }
  return lines.join('\n');
}
