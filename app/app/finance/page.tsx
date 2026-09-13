'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, type FinanceEntry, type FinanceType } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { DeleteButton } from '@/components/delete-button';
import { todayISO, formatDateUK } from '@/lib/utils/dates';

export default function FinancePage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<FinanceType>('out');
  const [note, setNote] = useState('');
  const [entryDate, setEntryDate] = useState(todayISO());
  const [submitting, setSubmitting] = useState(false);

  // View state
  const [view, setView] = useState<'recent' | 'weekly' | 'monthly'>('recent');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('finance_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setEntries(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/finance/entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          type,
          note: note.trim() || undefined,
          entryDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add entry');

      setAmount('');
      setNote('');
      fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setSubmitting(false);
    }
  }

  // Totals
  const totals = useMemo(() => {
    const totalIn = entries.filter(e => e.type === 'in').reduce((s, e) => s + Number(e.amount), 0);
    const totalOut = entries.filter(e => e.type === 'out').reduce((s, e) => s + Number(e.amount), 0);
    const net = totalIn - totalOut;
    const income = entries.filter(e => e.type === 'in' && e.category === 'income').reduce((s, e) => s + Number(e.amount), 0);
    return { totalIn, totalOut, net, income };
  }, [entries]);

  // Weekly breakdown
  const weeklyData = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);

    const weekEntries = entries.filter(e => new Date(e.entry_date + 'T00:00:00') >= weekStart);
    return breakdownByCategory(weekEntries);
  }, [entries]);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthEntries = entries.filter(e => new Date(e.entry_date + 'T00:00:00') >= monthStart);
    return breakdownByCategory(monthEntries);
  }, [entries]);

  const recentEntries = entries.slice(0, 20);

  async function handleDeleteEntry(id: string) {
    await supabase.from('finance_entries').delete().eq('id', id);
    fetchEntries();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
        <p className="text-sm text-muted-foreground">
          Quick log in and out. AI auto-categorises from your note.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Money in" value={`£${totals.totalIn.toFixed(2)}`} icon={ArrowDownLeft} tone="text-success" />
        <StatCard label="Money out" value={`£${totals.totalOut.toFixed(2)}`} icon={ArrowUpRight} tone="text-error" />
        <StatCard label="Net" value={`£${totals.net.toFixed(2)}`} icon={Wallet} tone={totals.net >= 0 ? 'text-success' : 'text-error'} />
        <StatCard label="Income tracked" value={`£${totals.income.toFixed(2)}`} icon={PiggyBank} tone="text-primary" />
      </div>

      {/* Quick entry form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as FinanceType)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="out">Out</SelectItem>
                  <SelectItem value="in">In</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Amount (£)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-32"
                required
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label className="text-xs">Note (AI categorises from this)</Label>
              <Input
                placeholder="e.g. groceries at Tesco, train to London..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-36"
              />
            </div>
            <Button type="submit" disabled={submitting || !amount}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* View toggle */}
      <div className="flex gap-2">
        {(['recent', 'weekly', 'monthly'] as const).map((v) => (
          <Button
            key={v}
            variant={view === v ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView(v)}
          >
            {v === 'recent' ? 'Recent' : v === 'weekly' ? 'This week' : 'This month'}
          </Button>
        ))}
      </div>

      {/* Views */}
      {view === 'recent' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet. Add one above.</p>
            ) : (
              recentEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      e.type === 'in' ? 'bg-success/10' : 'bg-error/10'
                    }`}>
                      {e.type === 'in' ? (
                        <ArrowDownLeft className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-error" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {e.type === 'in' ? '+' : '-'}£{Number(e.amount).toFixed(2)}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">{e.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateUK(e.entry_date)}{e.note ? ` · ${e.note}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.ai_categorised && (
                      <span className="text-[10px] text-muted-foreground/60">AI</span>
                    )}
                    <DeleteButton onDelete={() => handleDeleteEntry(e.id)} confirmText="Delete this entry?" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {view === 'weekly' && (
        <CategoryBreakdown title="This week" data={weeklyData} />
      )}

      {view === 'monthly' && (
        <CategoryBreakdown title="This month" data={monthlyData} />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Wallet; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
        <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

type CategoryBreakdownData = { category: string; in: number; out: number; net: number }[];

function breakdownByCategory(entries: FinanceEntry[]): CategoryBreakdownData {
  const map = new Map<string, { in: number; out: number }>();
  for (const e of entries) {
    const cat = e.category || 'uncategorised';
    if (!map.has(cat)) map.set(cat, { in: 0, out: 0 });
    const entry = map.get(cat)!;
    if (e.type === 'in') entry.in += Number(e.amount);
    else entry.out += Number(e.amount);
  }
  return Array.from(map.entries())
    .map(([category, v]) => ({ category, ...v, net: v.in - v.out }))
    .sort((a, b) => b.out - a.out || b.in - a.in);
}

function CategoryBreakdown({ title, data }: { title: string; data: CategoryBreakdownData }) {
  const maxOut = Math.max(...data.map(d => d.out), 1);
  const maxIn = Math.max(...data.map(d => d.in), 1);
  const maxBar = Math.max(maxOut, maxIn);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No entries for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title} — by category</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {data.map((d) => (
          <div key={d.category} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium capitalize">{d.category}</span>
              <span className="tabular-nums text-muted-foreground">
                {d.in > 0 && <span className="text-success">+£{d.in.toFixed(2)} </span>}
                {d.out > 0 && <span className="text-error">-£{d.out.toFixed(2)}</span>}
                {d.in === 0 && d.out === 0 && <span>£0.00</span>}
              </span>
            </div>
            <div className="flex gap-1">
              {d.out > 0 && (
                <div className="h-2 rounded-full bg-error/60" style={{ width: `${(d.out / maxBar) * 100}%` }} />
              )}
              {d.in > 0 && (
                <div className="h-2 rounded-full bg-success/60" style={{ width: `${(d.in / maxBar) * 100}%` }} />
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
