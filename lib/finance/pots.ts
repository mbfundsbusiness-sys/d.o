import type { PotItem, WishlistItem } from '@/lib/supabase/types';

export type PotStats = {
  /** Sub-item total when the pot has sub-items, otherwise the pot's own target (null = open-ended). */
  target: number | null;
  /** Cost of sub-items already bought. */
  spent: number;
  /** Money set aside but not yet spent. */
  saved: number;
  /** 0-100, or null for an open-ended pot. */
  pct: number | null;
};

export function potStats(item: WishlistItem, subs: PotItem[]): PotStats {
  const mine = subs.filter((s) => s.pot_id === item.id);
  const target = mine.length > 0 ? mine.reduce((t, s) => t + Number(s.cost), 0) : item.target_cost != null ? Number(item.target_cost) : null;
  const spent = mine.filter((s) => s.purchased).reduce((t, s) => t + Number(s.cost), 0);
  const saved = Number(item.saved_amount ?? 0);
  const pct = target && target > 0 ? Math.min(100, ((spent + saved) / target) * 100) : null;
  return { target, spent, saved, pct };
}
