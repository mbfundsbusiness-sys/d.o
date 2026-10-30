import type { SupabaseClient } from '@supabase/supabase-js';
import type { Rules } from '@/lib/rules';
import type { PlanItem } from '@/lib/supabase/types';
import { loadDay, loadRules } from '@/lib/server/data';
import { eveningReview, morningBrief, pingText } from '@/lib/server/brief';
import { claimOnce, ntfyTopic, pingOnce, releaseClaim, sendPing } from '@/lib/server/notify';
import { replanDay } from '@/lib/server/plan';
import { fmtHM, londonNow, minutesOfDay, minutesToHM } from '@/lib/utils/dates';

// Runs every 5 minutes (pg_cron -> /api/cron/tick). Sends the morning brief at
// wake, block start pings, slacking callouts and the evening review. When a block
// is missed it re-plans the rest of the day by itself (moving is free) and says
// where the work went; if it no longer fits, it asks rather than dropping it.

const TICK = 5;

export function inQuiet(rules: Rules, nowMin: number): boolean {
  const s = minutesOfDay(rules.pings.quiet_start);
  const e = minutesOfDay(rules.pings.quiet_end);
  return s <= e ? nowMin >= s && nowMin < e : nowMin >= s || nowMin < e;
}

export function slackLine(p: Pick<PlanItem, 'title' | 'start_time'>, nowMin: number, tone: Rules['tone']): string {
  const at = fmtHM(p.start_time);
  const now = minutesToHM(nowMin);
  if (tone === 'blunt') return `You said ${p.title} at ${at}. It's ${now} and nothing's logged. Start it or tell me why.`;
  if (tone === 'firm') return `${p.title} was due at ${at}. It's ${now} and it isn't marked done.`;
  return `${p.title} was planned for ${at}. Still on? Mark it done when you've done it.`;
}

export async function tickUser(db: SupabaseClient, userId: string, topic: string): Promise<string[]> {
  const sent: string[] = [];
  const rules = await loadRules(db, userId);
  const now = londonNow();
  const nowMin = now.minutesOfDay;
  if (inQuiet(rules, nowMin)) return sent;

  const day = await loadDay(db, userId, now.dateISO, rules);
  const wakeMin = minutesOfDay(day.wake);

  if (rules.pings.morning_brief && nowMin >= wakeMin && nowMin < wakeMin + 180) {
    const key = `brief:${userId}:${now.dateISO}`;
    if (await claimOnce(db, key)) {
      try {
        const { text } = await morningBrief(db, userId);
        await sendPing(topic, { title: 'Morning brief', message: pingText(text), tags: ['sunrise'], priority: 4 });
        sent.push('brief');
      } catch (e) {
        await releaseClaim(db, key);
        throw e;
      }
    }
  }

  const reviewMin = minutesOfDay(rules.pings.evening_review_time);
  if (rules.pings.evening_review && nowMin >= reviewMin && nowMin < reviewMin + 120) {
    const key = `review:${userId}:${now.dateISO}`;
    if (await claimOnce(db, key)) {
      try {
        const { text } = await eveningReview(db, userId);
        await sendPing(topic, { title: 'Evening review', message: pingText(text), tags: ['crescent_moon'], priority: 3 });
        sent.push('review');
      } catch (e) {
        await releaseClaim(db, key);
        throw e;
      }
    }
  }

  for (const p of day.plan) {
    if (p.status !== 'planned') continue;
    const start = minutesOfDay(p.start_time);
    if (start <= nowMin + 1 && start > nowMin - TICK - 1) {
      const ok = await pingOnce(db, topic, `plan:${p.id}:start`, {
        title: `Now: ${p.title}`,
        message: `${fmtHM(p.start_time)}-${fmtHM(p.end_time)}. Mark it done in D.O. when you finish.`,
        tags: ['bell'],
        priority: 4,
      });
      if (ok) sent.push(`start:${p.id}`);
    }
    const late = nowMin - start;
    if (late < rules.pings.slacking_grace_min || late >= rules.pings.slacking_grace_min + 180) continue;
    let moved = '';
    if (rules.autopilot.auto_replan && (await claimOnce(db, `plan:${p.id}:auto`))) {
      await db.from('plan_items').update({ status: 'skipped', note: 'missed' }).eq('id', p.id).eq('status', 'planned');
      const r = await replanDay(db, userId, now.dateISO, rules);
      const next = r.items.find((i) => i.title === p.title);
      const unfit = r.unplaced.find((u) => u.title === p.title);
      moved = next
        ? ` Moved it to ${next.start}.`
        : unfit
          ? ` It doesn't fit the rest of today. Tell me in D.O.: push it to tomorrow, or drop it.`
          : '';
      sent.push(`replan:${p.id}`);
    }
    if (rules.pings.slacking_callouts) {
      const ok = await pingOnce(db, topic, `plan:${p.id}:slack`, {
        title: 'Nothing logged',
        message: slackLine(p, nowMin, rules.tone) + moved,
        tags: ['warning'],
        priority: 4,
      });
      if (ok) sent.push(`slack:${p.id}`);
    }
  }
  return sent;
}

export async function tickAll(db: SupabaseClient): Promise<Record<string, string[]>> {
  const topic = await ntfyTopic(db);
  if (!topic) return {};
  const { data } = await db.from('user_settings').select('user_id');
  const out: Record<string, string[]> = {};
  for (const { user_id } of data ?? []) {
    try {
      out[user_id] = await tickUser(db, user_id, topic);
    } catch (e) {
      out[user_id] = [`error: ${e instanceof Error ? e.message : String(e)}`];
    }
  }
  return out;
}
