'use client';

import { useState, FormEvent } from 'react';
import { supabase, type PotItem, type WishlistItem, type WishlistPriority } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DeleteButton } from '@/components/delete-button';
import { potStats } from '@/lib/finance/pots';
import { Loader2, Plus, ExternalLink, Check, RotateCcw } from 'lucide-react';

const PRIORITY_ORDER: WishlistPriority[] = ['high', 'medium', 'low'];
const PRIORITY_LABEL: Record<WishlistPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export function WishlistList({
  items,
  potItems,
  savingsBalance,
  onChanged,
}: {
  items: WishlistItem[];
  potItems: PotItem[];
  savingsBalance: number;
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [targetCost, setTargetCost] = useState('');
  const [priority, setPriority] = useState<WishlistPriority>('medium');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);

    const { error: insErr } = await supabase.from('wishlist_items').insert({
      title: title.trim(),
      url: url.trim() || null,
      target_cost: targetCost.trim() ? parseFloat(targetCost) || null : null,
      priority,
      notes: notes.trim() || null,
    });

    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setTitle('');
    setUrl('');
    setTargetCost('');
    setPriority('medium');
    setNotes('');
    setShowAdd(false);
    onChanged();
  }

  async function toggleStatus(item: WishlistItem) {
    setBusyId(item.id);
    setError(null);
    const nowPurchased = item.status !== 'purchased';
    const { error: updErr } = await supabase
      .from('wishlist_items')
      .update({
        status: nowPurchased ? 'purchased' : 'active',
        purchased_at: nowPurchased ? new Date().toISOString() : null,
      })
      .eq('id', item.id);
    if (updErr) setError(updErr.message);
    setBusyId(null);
    onChanged();
  }

  async function handleDelete(id: string) {
    await supabase.from('wishlist_items').delete().eq('id', id);
    onChanged();
  }

  const wanted = items.filter((i) => i.status === 'active');
  const purchased = items.filter((i) => i.status === 'purchased');

  const sortedWanted = PRIORITY_ORDER.flatMap((p) => wanted.filter((i) => i.priority === p));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Wishlist</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowAdd((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" />
          Add item
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="wishlist-title" className="text-xs">Item</Label>
                <Input id="wishlist-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wishlist-target-cost" className="text-xs">Target cost (£)</Label>
                <Input
                  id="wishlist-target-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetCost}
                  onChange={(e) => setTargetCost(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wishlist-priority" className="text-xs">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as WishlistPriority)}>
                  <SelectTrigger id="wishlist-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="wishlist-url" className="text-xs">Link (optional)</Label>
                <Input id="wishlist-url" type="url" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="wishlist-notes" className="text-xs">Notes (optional)</Label>
                <Textarea id="wishlist-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving || !title.trim()}>
                {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Add
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!error && items.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground">Nothing on your wishlist yet.</p>
        )}

        {sortedWanted.length > 0 && (
          <div className="space-y-2">
            {sortedWanted.map((item) => (
              <WishlistRow
                key={item.id}
                item={item}
                savingsBalance={savingsBalance}
                subs={potItems.filter((p) => p.pot_id === item.id)}
                onChanged={onChanged}
                busy={busyId === item.id}
                onToggle={() => toggleStatus(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        )}

        {purchased.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purchased</p>
            {purchased.map((item) => (
              <WishlistRow
                key={item.id}
                item={item}
                savingsBalance={savingsBalance}
                subs={potItems.filter((p) => p.pot_id === item.id)}
                onChanged={onChanged}
                busy={busyId === item.id}
                onToggle={() => toggleStatus(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PRIORITY_BADGE: Record<WishlistPriority, string> = {
  high: 'border-foreground bg-foreground/10',
  medium: 'border-border bg-secondary',
  low: 'border-border bg-transparent text-muted-foreground',
};

function WishlistRow({
  item,
  subs,
  onChanged,
  savingsBalance,
  busy,
  onToggle,
  onDelete,
}: {
  item: WishlistItem;
  subs: PotItem[];
  onChanged: () => void;
  savingsBalance: number;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const purchased = item.status === 'purchased';
  const stats = potStats(item, subs);
  const targetCost = stats.target;
  const [subName, setSubName] = useState('');
  const [subCost, setSubCost] = useState('');

  async function toggleSub(sub: PotItem) {
    const now = !sub.purchased;
    await supabase.from('pot_items').update({ purchased: now, purchased_at: now ? new Date().toISOString() : null }).eq('id', sub.id);
    if (now) {
      // Paying for it uses up saved money in this pot (never below zero).
      await supabase.from('wishlist_items').update({ saved_amount: Math.max(0, stats.saved - Number(sub.cost)) }).eq('id', item.id);
    }
    onChanged();
  }

  async function addSub() {
    const cost = parseFloat(subCost);
    if (!subName.trim() || !Number.isFinite(cost)) return;
    await supabase.from('pot_items').insert({ pot_id: item.id, name: subName.trim(), cost, sort: subs.length + 1 });
    setSubName('');
    setSubCost('');
    onChanged();
  }

  async function removeSub(id: string) {
    await supabase.from('pot_items').delete().eq('id', id);
    onChanged();
  }
  const fundedPct = stats.pct;
  const shortfall = targetCost != null ? Math.max(0, targetCost - stats.saved - stats.spent) : null;

  return (
    <div className={`rounded-lg border p-3 ${purchased ? 'border-border opacity-60' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-medium ${purchased ? 'line-through' : ''}`}>{item.title}</span>
            {!purchased && (
              <Badge variant="outline" className={`text-[10px] ${PRIORITY_BADGE[item.priority]}`}>
                {PRIORITY_LABEL[item.priority]}
              </Badge>
            )}
            {targetCost != null && (
              <span className="text-xs tabular-nums text-muted-foreground">£{targetCost.toFixed(2)}</span>
            )}
          </div>
          {item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="outline" disabled={busy} onClick={onToggle}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : purchased ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </Button>
          <DeleteButton onDelete={async () => onDelete()} confirmText={`Remove "${item.title}" from your wishlist?`} />
        </div>
      </div>

      {!purchased && (
        <div className="mt-2 space-y-1">
          {fundedPct != null ? (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${fundedPct >= 100 ? 'bg-success' : 'bg-foreground/60'}`} style={{ width: `${fundedPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                £{(stats.saved + stats.spent).toFixed(2)} of £{targetCost!.toFixed(2)}
                {stats.spent > 0 && ` (£${stats.spent.toFixed(2)} already bought)`}
                {fundedPct >= 100 ? ' · pot is full' : ` · £${shortfall!.toFixed(2)} to go`}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">£{stats.saved.toFixed(2)} saved (no target set)</p>
          )}
        </div>
      )}

      {!purchased && (subs.length > 0 || item.leftover_weight > 0 || targetCost == null) && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-2">
          {subs.map((sub) => (
            <label key={sub.id} className="flex cursor-pointer items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={sub.purchased} onChange={() => toggleSub(sub)} className="h-3.5 w-3.5 accent-foreground" />
                <span className={sub.purchased ? 'text-muted-foreground line-through' : ''}>{sub.name}</span>
              </span>
              <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                £{Number(sub.cost).toFixed(2)}
                <button type="button" aria-label={`Remove ${sub.name}`} onClick={(e) => { e.preventDefault(); void removeSub(sub.id); }} className="hover:text-foreground">×</button>
              </span>
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <Input className="h-8 text-xs" placeholder="Add an item (e.g. FundingPips 50K)" value={subName} onChange={(e) => setSubName(e.target.value)} />
            <Input className="h-8 w-24 text-xs" type="number" step="0.01" min="0" placeholder="£" value={subCost} onChange={(e) => setSubCost(e.target.value)} />
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={addSub}>Add</Button>
          </div>
        </div>
      )}
    </div>
  );
}
