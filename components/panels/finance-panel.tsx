'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { FinanceSummary } from '@/lib/server/finance';
import type { Rules } from '@/lib/rules';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PanelProps } from '@/components/chat/chat-view';

const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const short = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-medium tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function FinancePanel({ refreshKey, ask }: PanelProps) {
  const [data, setData] = useState<{ summary: FinanceSummary; rules: Rules } | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiGet('/api/finance'));
      setErr(false);
    } catch {
      setErr(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (err) return <p className="p-5 text-sm text-muted-foreground">Couldn&apos;t load your finances.</p>;
  if (!data) return <Loader2 className="m-5 h-4 w-4 animate-spin text-muted-foreground" />;

  const { summary: f, rules } = data;
  const m = f.thisMonth;
  const rate = rules.finance.per_drop_rate;
  const unlogged = f.recentShifts.filter((s) => !s.logged);

  return (
    <div className="flex flex-col gap-6 p-5">
      <section>
        <h2 className="mb-2 font-medium">This month</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Earned" value={gbp(m.earned)} sub={`${m.drops} drops, ${m.shiftsWorked} shifts`} />
          <Stat label={`Tax set-aside (${rules.finance.tax_set_aside_pct}%)`} value={gbp(m.taxSetAside)} sub={`${gbp(m.afterTax)} after tax`} />
        </div>
        {rate == null && (
          <button type="button" onClick={() => ask("I know my per-drop rate now, let's set it.")} className="mt-2 text-left text-xs text-amber-300 underline">
            Per-drop rate not set, so drops can&apos;t be priced yet. Set it
          </button>
        )}
        {m.unpricedDrops > 0 && rate != null && <p className="mt-2 text-xs text-muted-foreground">{m.unpricedDrops} drops have no rate.</p>}
      </section>

      {unlogged.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Shifts to log</h3>
          {unlogged.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => ask(`Log my shift on ${short(s.date)}: `)}
              className="flex w-full items-center justify-between py-1.5 text-left text-sm hover:text-foreground"
            >
              <span>{short(s.date)}</span>
              <span className="text-xs text-amber-300">
                {s.start}-{s.end}, drops?
              </span>
            </button>
          ))}
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent shifts</h3>
        {f.recentShifts.filter((s) => s.logged).length === 0 && <p className="text-sm text-muted-foreground">None logged yet.</p>}
        {f.recentShifts
          .filter((s) => s.logged)
          .map((s) => (
            <div key={s.id} className="flex items-center justify-between py-1 text-sm">
              <span>{short(s.date)}</span>
              <span className="tabular-nums text-muted-foreground">
                {s.drops} drops{s.pay != null ? ` · ${gbp(s.pay)}` : ''}
              </span>
            </div>
          ))}
        {f.upcomingShifts.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Next: {f.upcomingShifts.slice(0, 3).map((s) => `${short(s.date)} ${s.start}`).join(', ')}
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pots</h3>
        {f.pots.filter((p) => p.status === 'active').map((p) => (
          <div key={p.id} className="py-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate">{p.title}</span>
              <span className="tabular-nums text-xs text-muted-foreground">
                {gbp(p.stats.saved + p.stats.spent)}
                {p.stats.target != null ? ` / ${gbp(p.stats.target)}` : ''}
              </span>
            </div>
            {p.stats.pct != null && (
              <div className="mt-1 h-1 overflow-hidden rounded bg-muted">
                <div className={cn('h-full', p.stats.pct >= 100 ? 'bg-emerald-500' : 'bg-foreground/70')} style={{ width: `${p.stats.pct}%` }} />
              </div>
            )}
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Bills {gbp(f.billsMonthly)} · Subs {gbp(f.subsMonthly)} /mo
        </h3>
        {f.bills.filter((b) => b.active).map((b) => (
          <div key={b.id} className="flex items-center justify-between py-1 text-sm">
            <span className="truncate">
              {b.name}
              {b.kind === 'subscription' && <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">sub</span>}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {gbp(Number(b.amount))}
              {b.cadence !== 'monthly' ? `/${b.cadence === 'weekly' ? 'wk' : 'yr'}` : ''}
            </span>
          </div>
        ))}
      </section>

      {f.payday && (
        <section className="text-sm">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payday {short(f.payday.date)} (in {f.payday.inDays} days)
          </h3>
          <div className="flex justify-between py-0.5 text-muted-foreground">
            <span>Bills</span>
            <span>{gbp(f.payday.plan.billsTotal)}</span>
          </div>
          {f.payday.plan.pots.filter((p) => p.add > 0).map((p) => (
            <div key={p.id} className="flex justify-between py-0.5">
              <span>{p.title}</span>
              <span className="tabular-nums">+{gbp(p.add)}</span>
            </div>
          ))}
          <div className="flex justify-between py-0.5 text-muted-foreground">
            <span>Left over</span>
            <span>{gbp(f.payday.plan.unallocated)}</span>
          </div>
        </section>
      )}
    </div>
  );
}
