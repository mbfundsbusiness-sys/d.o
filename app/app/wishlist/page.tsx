'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type WishlistItem } from '@/lib/supabase/client';
import { WishlistList } from '@/components/wishlist-list';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Gift, Wallet } from 'lucide-react';

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const wanted = items.filter((i) => !i.purchased);
  const totalCost = wanted.reduce((sum, i) => sum + (i.price ? Number(i.price) : 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Things you want to buy — prioritised, with an estimated running total.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
              <span className="text-xs font-medium text-muted-foreground">Estimated total</span>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">£{totalCost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
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

      <WishlistList items={items} onChanged={fetchItems} />
    </div>
  );
}
