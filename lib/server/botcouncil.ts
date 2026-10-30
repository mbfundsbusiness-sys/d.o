// BotCouncil status for the Freelance assistant, read from BotCouncil's own
// Supabase (bot-council-v1) through its read-only do_status_summary function
// (supabase/external/botcouncil_do_status.sql). Aggregates only, never user rows.
// The publishable key is public by design; the token is what the function checks.

const URL_DEFAULT = 'https://etjvracioouhmquqalyq.supabase.co';
const KEY_DEFAULT = 'sb_publishable_1f77bhFiQIBxzG9mpCYeLQ_p6fGOheG';

export type BotCouncilStatus = {
  generated_at: string;
  sweeps: { timeframe: string; status: string; last_completed_at: string | null; assets_succeeded: number; assets_failed: number }[];
  forecasts: { last_at: string | null; last_24h: number; last_7d: number };
  accuracy_30d: { resolved: number; correct: number };
  readiness: { council: string; ready: boolean; accuracy: number | null; n: number; checked_at: string }[];
  ai_cost_usd: { today: number; last_7d: number; month: number };
  users: { total: number; active_7d: number; new_7d: number };
};

export type BotCouncilResult = { status: BotCouncilStatus } | { error: string };

let cache: { at: number; result: BotCouncilResult } | null = null;

export async function botCouncilStatus(): Promise<BotCouncilResult> {
  if (cache && Date.now() - cache.at < 60_000) return cache.result;
  const token = process.env.BOTCOUNCIL_STATUS_TOKEN || process.env.CRON_SECRET;
  if (!token) return { error: 'not linked (no token set on the server)' };
  const key = process.env.BOTCOUNCIL_SUPABASE_KEY || KEY_DEFAULT;
  let result: BotCouncilResult;
  try {
    const res = await fetch(`${process.env.BOTCOUNCIL_SUPABASE_URL || URL_DEFAULT}/rest/v1/rpc/do_status_summary`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) result = { error: 'BotCouncil link not set up yet (the status function is missing in bot-council-v1)' };
    else if (res.status === 401 || res.status === 403) result = { error: 'BotCouncil refused the token' };
    else if (!res.ok) result = { error: `BotCouncil answered ${res.status}` };
    else result = { status: (await res.json()) as BotCouncilStatus };
  } catch (e) {
    result = { error: `couldn't reach BotCouncil (${e instanceof Error ? e.message : String(e)})` };
  }
  cache = { at: Date.now(), result };
  return result;
}

const ago = (iso: string | null, now = Date.now()) => {
  if (!iso) return 'never';
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 60) return `${min} min ago`;
  if (min < 48 * 60) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
};

export function describeBotCouncil(r: BotCouncilResult): string {
  if ('error' in r) return `BotCouncil status unavailable: ${r.error}.`;
  const s = r.status;
  const acc = s.accuracy_30d.resolved ? Math.round((s.accuracy_30d.correct / s.accuracy_30d.resolved) * 100) : null;
  const ready = s.readiness.filter((c) => c.ready).map((c) => c.council);
  return [
    `Sweeps: ${s.sweeps.map((w) => `${w.timeframe} ${w.status} ${ago(w.last_completed_at)}${w.assets_failed ? `, ${w.assets_failed} assets failed` : ''}`).join('; ') || 'none'}.`,
    `Forecasts: ${s.forecasts.last_24h} in 24h, ${s.forecasts.last_7d} in 7 days, last ${ago(s.forecasts.last_at)}.`,
    `Direction accuracy, last 30 days: ${acc === null ? 'nothing resolved' : `${acc}% (${s.accuracy_30d.correct}/${s.accuracy_30d.resolved})`}.`,
    `Councils ready: ${ready.length ? ready.join(', ') : 'none'} of ${s.readiness.length}; latest check ${ago(s.readiness[0]?.checked_at ?? null)} (${s.readiness.map((c) => `${c.council} ${c.accuracy ?? '?'}%`).join(', ')}).`,
    `AI spend: $${Number(s.ai_cost_usd.today).toFixed(2)} today, $${Number(s.ai_cost_usd.last_7d).toFixed(2)} 7 days, $${Number(s.ai_cost_usd.month).toFixed(2)} this month.`,
    `Users: ${s.users.total} total, ${s.users.active_7d} active this week, ${s.users.new_7d} new.`,
  ].join('\n');
}
