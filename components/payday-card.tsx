'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type Bill, type PaySettings, type PotItem, type WishlistItem } from '@/lib/supabase/client';
import { potStats } from '@/lib/finance/pots';
import { buildPlan, daysUntil, nextPayday } from '@/lib/finance/payday';
import { todayISO } from '@/lib/utils/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Plus, X } from 'lucide-react';

const gbp = (n: number) => `£${n.toFixed(2)}`;

/** Monthly payday planner: bills first, then pots filled in priority order. Confirming adds the amounts to each pot. */
export function PaydayCard({ items, potItems, onChanged }: { items: WishlistItem[]; potItems: PotItem[]; onChanged: () => void }) {
  const [settings, setSettings] = useState<PaySettings | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [dom, setDom] = useState('');
  const [expected, setExpected] = useState('');
  const [pay, setPay] = useState('');
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([
      supabase.from('pay_settings').select('*').maybeSingle(),
      supabase.from('bills').select('*').eq('active', true).order('created_at'),
    ]);
    const st = (s.data as PaySettings | null) ?? null;
    setSettings(st);
    setDom(st?.payday_dom ? String(st.payday_dom) : '');
    setExpected(st?.expected_pay != null ? String(st.expected_pay) : '');
    setBills((b.data ?? []) as Bill[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    setError(null);
    const d = parseInt(dom, 10);
    const row = {
      payday_dom: Number.isFinite(d) && d >= 1 && d <= 31 ? d : null,
      expected_pay: expected.trim() ? parseFloat(expected) || null : null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = settings
      ? await supabase.from('pay_settings').update(row).eq('user_id', settings.user_id)
      : await supabase.from('pay_settings').insert(row);
    if (err) setError(err.message);
    await load();
  }

  async function addBill() {
    const amount = parseFloat(billAmount);
    if (!billName.trim() || !Number.isFinite(amount)) return;
    const { error: err } = await supabase.from('bills').insert({ name: billName.trim(), amount });
    if (err) setError(err.message);
    setBillName('');
    setBillAmount('');
    await load();
  }

  async function removeBill(id: string) {
    await supabase.from('bills').update({ active: false }).eq('id', id);
    await load();
  }

  const payNum = parseFloat(pay || expected || '0') || 0;
  const active = useMemo(() => items.filter((i) => i.status === 'active'), [items]);
  const plan = useMemo(
    () =>
      buildPlan(
        payNum,
        bills.map((b) => ({ id: b.id, name: b.name, amount: Number(b.amount) })),
        active.map((i) => {
          const st = potStats(i, potItems);
          return { id: i.id, title: i.title, priority: i.priority, target_cost: st.target, saved_amount: st.saved, spent: st.spent, weight: Number(i.leftover_weight ?? 0), created_at: i.created_at };
        })
      ),
    [payNum, bills, active, potItems]
  );

  async function confirm() {
    if (busy || payNum <= 0) return;
    setBusy(true);
    setError(null);
    for (const p of plan.pots) {
      if (p.add <= 0) continue;
      const { error: err } = await supabase.from('wishlist_items').update({ saved_amount: p.saved }).eq('id', p.id);
      if (err) {
        setError(err.message);
        setBusy(false);
        return;
      }
    }
    const { error: runErr } = await supabase.from('payday_runs').insert({ pay_date: todayISO(), pay_amount: payNum, plan });
    if (runErr) setError(runErr.message);
    setPay('');
    setBusy(false);
    onChanged();
  }

  const next = settings?.payday_dom ? nextPayday(todayISO(), settings.payday_dom) : null;
  const inDays = next ? daysUntil(todayISO(), next) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Payday plan</CardTitle>
        <p className="text-xs text-muted-foreground">
          {next ? `Next payday: ${next} (${inDays === 0 ? 'today' : `in ${inDays} day${inDays === 1 ? '' : 's'}`}). You get a phone alert with the split.` : 'Set your payday below to get an alert with the split.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Payday (day of month)</Label>
            <Input type="number" min="1" max="31" value={dom} onChange={(e) => setDom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Usual monthly pay (£)</Label>
            <Input type="number" step="0.01" min="0" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={saveSettings}>Save</Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fixed bills (paid first)</p>
          {bills.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
              <span>{b.name}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {gbp(Number(b.amount))}
                <button aria-label={`Remove ${b.name}`} onClick={() => removeBill(b.id)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Bill (rent, phone…)" value={billName} onChange={(e) => setBillName(e.target.value)} />
            <Input className="w-28" type="number" step="0.01" min="0" placeholder="£" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} />
            <Button size="sm" variant="outline" onClick={addBill} aria-label="Add bill"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Pay received (£)</Label>
              <Input className="w-40" type="number" step="0.01" min="0" placeholder={expected || '0.00'} value={pay} onChange={(e) => setPay(e.target.value)} />
            </div>
            <p className="pb-2 text-xs text-muted-foreground">Enter what actually landed to see where it goes.</p>
          </div>

          {payNum > 0 && (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Bills</span><span className="tabular-nums">{gbp(plan.billsTotal)}</span></div>
              {plan.afterBills < 0 && <p className="text-xs text-amber-400">Bills are {gbp(-plan.afterBills)} more than this pay.</p>}
              {plan.pots.filter((p) => p.add > 0).map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{p.title}{p.fullyFunded && <span className="ml-2 text-xs text-muted-foreground">fully funded</span>}</span>
                  <span className="tabular-nums">+ {gbp(p.add)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-1.5"><span className="text-muted-foreground">Left over</span><span className="tabular-nums">{gbp(plan.unallocated)}</span></div>
              <Button size="sm" onClick={confirm} disabled={busy} className="mt-2">
                {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
                I&apos;ve moved the money
              </Button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
