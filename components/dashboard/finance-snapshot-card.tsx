'use client';

import { useEffect, useState } from 'react';
import { supabase, type FinanceEntry } from '@/lib/supabase/client';
import { DashCard } from '@/components/ui/glass-card';
import { Wallet } from 'lucide-react';

export function FinanceSnapshotCard() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data, error } = await supabase.from('finance_entries').select('*').gte('entry_date', weekAgo.toISOString().slice(0, 10));
      if (error) setError(error.message);
      setEntries(data ?? []);
      setLoading(false);
    })();
  }, []);

  const spend = entries.filter((e) => e.type === 'out' && e.category !== 'savings').reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== 'out' || e.category === 'savings') continue;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  const top = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <DashCard title="Finance" icon={Wallet} href="/app/invest?tab=finance" loading={loading} error={error} empty={entries.length === 0}>
      <div className="space-y-1.5">
        <p className="text-2xl font-semibold tabular-nums">£{spend.toFixed(2)}</p>
        <p className="text-xs text-muted-foreground">spent this week</p>
        {top.length > 0 && (
          <ul className="space-y-0.5 pt-1">
            {top.map(([cat, amt]) => (
              <li key={cat} className="flex justify-between text-xs text-muted-foreground">
                <span className="capitalize">{cat}</span>
                <span>£{amt.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashCard>
  );
}
