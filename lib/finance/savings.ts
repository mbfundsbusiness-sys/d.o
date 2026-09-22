import type { FinanceEntry } from '@/lib/supabase/client';

export const SAVINGS_CATEGORY = 'savings';

/**
 * A finance_entries row with category='savings' IS a savings transfer:
 * type='out' moves money from spendable into savings, type='in' moves it
 * back out (a withdrawal). No separate savings table — this is the whole
 * convention. Spendable net needs no special-casing: the existing total
 * net (in - out across everything) already reflects it correctly, since a
 * savings transfer is a real flow either way.
 */
export function computeSavingsBalance(entries: FinanceEntry[]): number {
  let balance = 0;
  for (const e of entries) {
    if (e.category !== SAVINGS_CATEGORY) continue;
    balance += e.type === 'out' ? Number(e.amount) : -Number(e.amount);
  }
  return balance;
}
