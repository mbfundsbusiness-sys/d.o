'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type WishlistItem, type FinanceEntry } from '@/lib/supabase/client';
import { WishlistList } from '@/components/wishlist-list';
import { computeSavingsBalance } from '@/lib/finance/savings';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Gift, Wallet, PiggyBank } from 'lucide-react';

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [itemsRes, financeRes] = await Promise.all([
      supabase.from('wishlist_items').select('*').order('created_at', { ascending: false }),
      supabase.from('finance_entries').select('*'),
    ]);
    if (itemsRes.error) setError(itemsRes.error.message);
    setItems(itemsRes.data ?? []);
    setFinanceEntries(financeRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const wanted = items.filter((i) => i.status === 'active');
  const totalCost = wanted.reduce((sum, i) => sum + (i.target_cost ? Number(i.target_cost) : 0), 0);
  const savingsBalance = computeSavingsBalance(financeEntries);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Things you want to buy — prioritised, funded against your real savings balance from
          Finance.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">On the list</span>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{wanted.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Target total</span>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">£{totalCost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Savings balance</span>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">£{savingsBalance.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Purchased</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {items.length - wanted.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <WishlistList items={items} savingsBalance={savingsBalance} onChanged={fetchAll} />
    </div>
  );
}
