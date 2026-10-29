import type { SupabaseClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { gatewayFallback, model } from '@/lib/ai/models';
import { describeRules, type Rules } from '@/lib/rules';
import { describeDay, type DayView } from '@/lib/schedule/day';
import { loadDay, loadRules } from '@/lib/server/data';
import { replanDay } from '@/lib/server/plan';
import { addDaysISO, fmtHM, londonNow } from '@/lib/utils/dates';

// The morning brief and evening review are EA messages written by the planning
// model. They land in the EA chat (so the home screen opens on them) and as a
// shortened phone ping.

export type BriefKind = 'brief' | 'review';

export const briefMessageId = (kind: BriefKind, date: string, userId: string) => `${kind}-${date}-${userId.slice(0, 8)}`;

function tally(day: DayView): string {
  const by = (s: string) => day.plan.filter((p) => p.status === s);
  const done = by('done');
  const missed = by('skipped').concat(by('planned'));
  return `Planned ${day.plan.filter((p) => p.status !== 'dropped').length} blocks: ${done.length} done (${done.map((p) => p.title).join(', ') || 'none'}), ${missed.length} not done (${missed.map((p) => `${p.title} ${fmtHM(p.start_time)}`).join(', ') || 'none'}).`;
}

async function alreadyWritten(db: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await db.from('chat_messages').select('parts').eq('id', id).maybeSingle();
  if (!data) return null;
  const parts = data.parts as { type: string; text?: string }[];
  return parts.map((p) => p.text ?? '').join('');
}

async function write(db: SupabaseClient, userId: string, id: string, text: string) {
  await db.from('chat_messages').upsert(
    { id, user_id: userId, assistant: 'ea', role: 'assistant', parts: [{ type: 'text', text }] },
    { onConflict: 'id', ignoreDuplicates: true }
  );
}

const TONE_LINE: Record<Rules['tone'], string> = {
  blunt: 'Be blunt and push hard; name anything that slipped yesterday plainly.',
  firm: 'Be firm and direct.',
  gentle: 'Be direct but kind.',
};

/** Writes today's brief once (re-planning the day first). Returns the text and whether it is new. */
export async function morningBrief(db: SupabaseClient, userId: string): Promise<{ text: string; created: boolean }> {
  const now = londonNow();
  const id = briefMessageId('brief', now.dateISO, userId);
  const existing = await alreadyWritten(db, id);
  if (existing !== null) return { text: existing, created: false };

  const rules = await loadRules(db, userId);
  const plan = await replanDay(db, userId, now.dateISO, rules);
  const [yesterday, today] = await Promise.all([
    loadDay(db, userId, addDaysISO(now.dateISO, -1), rules),
    loadDay(db, userId, now.dateISO, rules),
  ]);

  const { text } = await generateText({
    model: model('plan'),
    providerOptions: gatewayFallback('plan'),
    maxOutputTokens: 700,
    system: `You are the user's EA writing their morning brief. Format exactly:
1. One or two lines recapping yesterday (what got done, what slipped).
2. "Here's what's lined up today:" then a short time-ordered list of today's fixed blocks and plan, with prayer times included.
3. If anything did not fit, say so and ask whether to drop it or push it to tomorrow (never drop it yourself).
4. One closing line: the single most important thing today. Free time is earned after the planned work.
${TONE_LINE[rules.tone]} Under 160 words. 24h times. No headings, no emoji.`,
    prompt: `Rules:\n${describeRules(rules)}\n\nYesterday:\n${describeDay(yesterday)}\n${tally(yesterday)}\n\nToday:\n${describeDay(today, now.minutesOfDay)}\n\nDid not fit today: ${plan.unplaced.map((u) => `${u.title} (${u.minutes} min)`).join(', ') || 'nothing'}`,
  });
  await write(db, userId, id, text.trim());
  return { text: text.trim(), created: true };
}

/** Writes today's evening review once. */
export async function eveningReview(db: SupabaseClient, userId: string): Promise<{ text: string; created: boolean }> {
  const now = londonNow();
  const id = briefMessageId('review', now.dateISO, userId);
  const existing = await alreadyWritten(db, id);
  if (existing !== null) return { text: existing, created: false };

  const rules = await loadRules(db, userId);
  const [today, tomorrow] = await Promise.all([
    loadDay(db, userId, now.dateISO, rules),
    loadDay(db, userId, addDaysISO(now.dateISO, 1), rules),
  ]);
  const { text } = await generateText({
    model: model('plan'),
    providerOptions: gatewayFallback('plan'),
    maxOutputTokens: 600,
    system: `You are the user's EA writing the evening review. Cover: what got done today against the plan (be specific), what slipped and the honest reason if the data shows one, whether free time was earned, and the first fixed thing tomorrow plus wake time. Ask them to tell you anything done that isn't marked. ${TONE_LINE[rules.tone]} Under 130 words. 24h times. No headings, no emoji.`,
    prompt: `Today:\n${describeDay(today, now.minutesOfDay)}\n${tally(today)}\n\nTomorrow:\n${describeDay(tomorrow)}`,
  });
  await write(db, userId, id, text.trim());
  return { text: text.trim(), created: true };
}

/** First lines of a brief, sized for a phone notification. */
export function pingText(text: string, max = 350): string {
  const flat = text.replace(/\*\*/g, '').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
