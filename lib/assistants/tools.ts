import { tool } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describeRules, setRule, type Rules } from '@/lib/rules';
import { describeDay } from '@/lib/schedule/day';
import { DEFAULT_SHIFT_TITLE } from '@/lib/schedule/shifts';
import { loadDay, saveRules } from '@/lib/server/data';
import { replanDay } from '@/lib/server/plan';
import { describeLedger } from '@/lib/rewards/ledger';
import { describePatterns } from '@/lib/schedule/learn';
import { botCouncilStatus, describeBotCouncil } from '@/lib/server/botcouncil';
import { listNotes } from '@/lib/server/notes';
import { describeRewards, loadProgress } from '@/lib/server/progress';
import { addDaysISO, londonNow, londonToUtcISO, minutesOfDay } from '@/lib/utils/dates';

// Every tool is scoped to one user. Outputs are short strings or small objects
// the model relays; errors come back as { error } so the model can explain them.

export type ToolCtx = { db: SupabaseClient; userId: string; rules: Rules };

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe('24h HH:MM, London time');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD, London');
const kind = z.enum(['exams', 'coursework', 'study', 'trading', 'botcouncil', 'gym', 'language', 'task', 'other']);
const todoCategory = z.enum(['exams', 'coursework', 'trading', 'botcouncil', 'gym', 'language', 'task', 'other']);
const moduleKey = z
  .enum(['programming', 'circuits', 'maths', 'engsci', 'language'])
  .describe('uni module (programming, circuits, maths, engsci) or the language course');

const fail = (error: string) => ({ error });
const checkSpan = (start: string, end: string) => (minutesOfDay(end) > minutesOfDay(start) ? null : 'end must be after start (no crossing midnight)');

function dueISO(due: string | null | undefined): string | null | undefined {
  if (due === undefined || due === null) return due;
  const m = due.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/);
  if (!m) return undefined;
  return londonToUtcISO(m[1], m[2] ?? '23:59');
}

/** Mutates ctx.rules so later tool calls in the same turn (replan_day) see the change. */
export function ruleTools(ctx: ToolCtx) {
  const { db, userId } = ctx;
  return {
    set_rule: tool({
      description:
        'Change one routine rule (targets, rest days, wake logic, priorities, finance rates, pings, tone). Use when the user says their routine changed. Path is dotted, e.g. "targets.gym_min", "rest_days", "wake.default", "finance.per_drop_rate", "priorities".',
      inputSchema: z.object({
        path: z.string(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.number()), z.array(z.string())]),
      }),
      execute: async ({ path, value }) => {
        const res = setRule(ctx.rules, path, value);
        if ('error' in res) return fail(res.error);
        const err = await saveRules(db, userId, res.rules);
        if (err) return fail(err);
        ctx.rules = res.rules;
        return { ok: true, rules: describeRules(ctx.rules) };
      },
    }),
  };
}

export function scheduleTools(ctx: ToolCtx) {
  const { db, userId } = ctx;
  return {
    get_day: tool({
      description: 'Show the fixed blocks, plan and due to-dos for a date (today is already in your context).',
      inputSchema: z.object({ date }),
      execute: async ({ date }) => describeDay(await loadDay(db, userId, date, ctx.rules)),
    }),
    replan_day: tool({
      description:
        "Re-plan a day's flexible time around the fixed blocks using the rules. Replaces the EA's own not-started blocks; keeps done items and anything the user placed. Use after big changes (new shift, new coursework, user asks to reshuffle). Returns what was placed and what did not fit.",
      inputSchema: z.object({ date }),
      execute: async ({ date }) => {
        const r = await replanDay(db, userId, date, ctx.rules);
        return { placed: r.items, did_not_fit: r.unplaced };
      },
    }),
    add_block: tool({
      description: 'Put a block in the plan for a date (user asked for something specific at a time).',
      inputSchema: z.object({ date, start: hm, end: hm, title: z.string().min(1), kind }),
      execute: async ({ date, start, end, title, kind }) => {
        const bad = checkSpan(start, end);
        if (bad) return fail(bad);
        const { data, error } = await db
          .from('plan_items')
          .insert({ user_id: userId, plan_date: date, start_time: start, end_time: end, title, kind, source: 'user' })
          .select('id')
          .single();
        return error ? fail(error.message) : { ok: true, id: data.id };
      },
    }),
    move_block: tool({
      description: 'Move a plan block to a new time and/or date. Moving does not need permission.',
      inputSchema: z.object({ id: z.string(), date: date.optional(), start: hm, end: hm }),
      execute: async ({ id, date, start, end }) => {
        const bad = checkSpan(start, end);
        if (bad) return fail(bad);
        const { error, count } = await db
          .from('plan_items')
          .update({ start_time: start, end_time: end, status: 'planned', ...(date ? { plan_date: date } : {}) }, { count: 'exact' })
          .eq('id', id)
          .eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such block');
      },
    }),
    mark_block: tool({
      description: 'Mark a plan block done (the user did it) or skipped (it did not happen). Use whenever the user reports progress.',
      inputSchema: z.object({ id: z.string(), status: z.enum(['done', 'skipped']), note: z.string().optional() }),
      execute: async ({ id, status, note }) => {
        const { data, error } = await db
          .from('plan_items')
          .update({ status, note: note ?? null, done_at: status === 'done' ? new Date().toISOString() : null })
          .eq('id', id)
          .eq('user_id', userId)
          .select('todo_id')
          .maybeSingle();
        if (error) return fail(error.message);
        if (!data) return fail('no such block');
        if (status === 'done' && data.todo_id) {
          await db.from('todo_items').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', data.todo_id).eq('user_id', userId);
        }
        return { ok: true };
      },
    }),
    drop_block: tool({
      description:
        'Remove a block from the plan entirely. Dropping needs the user\'s explicit yes in this conversation: set confirmed=true only after they agreed to drop that specific block.',
      inputSchema: z.object({ id: z.string(), confirmed: z.boolean() }),
      execute: async ({ id, confirmed }) => {
        if (!confirmed) return fail('Ask the user first: dropping needs their explicit yes.');
        const { error, count } = await db.from('plan_items').update({ status: 'dropped' }, { count: 'exact' }).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such block');
      },
    }),
  };
}

export function todoTools({ db, userId }: ToolCtx) {
  return {
    add_todo: tool({
      description: 'Add a to-do. Coursework and exam prep must use those categories so the planner ranks them first.',
      inputSchema: z.object({
        title: z.string().min(1),
        due: z.string().optional().describe('"YYYY-MM-DD" or "YYYY-MM-DD HH:MM", London'),
        category: todoCategory.default('task'),
        priority: z.number().int().min(1).max(5).default(3).describe('1 = most important'),
        estimate_min: z.number().int().min(5).max(600).optional(),
        notes: z.string().optional(),
        module_key: moduleKey.optional(),
      }),
      execute: async ({ title, due, category, priority, estimate_min, notes, module_key }) => {
        const due_at = dueISO(due);
        if (due && due_at === undefined) return fail('due must be YYYY-MM-DD or YYYY-MM-DD HH:MM');
        const { data, error } = await db
          .from('todo_items')
          .insert({ user_id: userId, title, due_at: due_at ?? null, category, priority, estimate_min: estimate_min ?? null, notes: notes ?? null, module_key: module_key ?? null })
          .select('id')
          .single();
        return error ? fail(error.message) : { ok: true, id: data.id };
      },
    }),
    update_todo: tool({
      description: 'Edit, complete or reopen a to-do.',
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        due: z.string().nullable().optional(),
        category: todoCategory.optional(),
        priority: z.number().int().min(1).max(5).optional(),
        estimate_min: z.number().int().min(5).max(600).nullable().optional(),
        module_key: moduleKey.nullable().optional(),
        completed: z.boolean().optional(),
      }),
      execute: async ({ id, due, completed, ...rest }) => {
        const patch: Record<string, unknown> = { ...rest };
        if (due !== undefined) {
          const due_at = dueISO(due);
          if (due !== null && due_at === undefined) return fail('due must be YYYY-MM-DD or YYYY-MM-DD HH:MM');
          patch.due_at = due_at;
        }
        if (completed !== undefined) {
          patch.completed = completed;
          patch.completed_at = completed ? new Date().toISOString() : null;
        }
        const { error, count } = await db.from('todo_items').update(patch, { count: 'exact' }).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such to-do');
      },
    }),
    list_todos: tool({
      description: 'List open to-dos (with ids).',
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await db
          .from('todo_items')
          .select('id, title, due_at, category, priority, estimate_min, module_key')
          .eq('user_id', userId)
          .eq('completed', false)
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(50);
        return data ?? [];
      },
    }),
    delete_todo: tool({
      description: "Delete a to-do. Needs the user's explicit yes: confirmed=true only after they agreed.",
      inputSchema: z.object({ id: z.string(), confirmed: z.boolean() }),
      execute: async ({ id, confirmed }) => {
        if (!confirmed) return fail('Ask the user first: deleting needs their explicit yes.');
        const { error, count } = await db.from('todo_items').delete({ count: 'exact' }).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such to-do');
      },
    }),
  };
}

export function shiftTools(ctx: ToolCtx) {
  const { db, userId } = ctx;
  // A shift is fixed, so the plan for that day moves around it straight away (today or tomorrow).
  const replanIfSoon = async (...dates: (string | undefined)[]) => {
    const today = londonNow().dateISO;
    const soon = new Set([today, addDaysISO(today, 1)]);
    const moved: string[] = [];
    for (const d of new Set(dates.filter((x): x is string => !!x && soon.has(x)))) {
      const r = await replanDay(db, userId, d, ctx.rules);
      if (r.unplaced.length) moved.push(`${d}: no room for ${r.unplaced.map((u) => `${u.title} (${u.minutes} min)`).join(', ')}; ask before dropping`);
      else moved.push(`${d}: re-planned around the shift`);
    }
    return moved;
  };
  return {
    add_shift: tool({
      description: 'Add a DPD shift to the rota (fixed: the schedule works around it).',
      inputSchema: z.object({ date, start: hm, end: hm, title: z.string().optional() }),
      execute: async ({ date, start, end, title }) => {
        const bad = checkSpan(start, end);
        if (bad) return fail(bad);
        const { data, error } = await db
          .from('work_shifts')
          .insert({ user_id: userId, shift_date: date, start_time: start, end_time: end, title: title ?? DEFAULT_SHIFT_TITLE })
          .select('id')
          .single();
        if (error) return fail(error.message);
        return { ok: true, id: data.id, plan: await replanIfSoon(date) };
      },
    }),
    log_shift: tool({
      description:
        'Log what happened on a shift: actual start/end and drops (parcels delivered). Pass the shift id, or a date to log a shift that was not on the rota.',
      inputSchema: z.object({
        id: z.string().optional(),
        date: date.optional(),
        actual_start: hm.optional(),
        actual_end: hm.optional(),
        drops: z.number().int().min(0).max(1000).optional(),
        rate_per_drop: z.number().min(0).max(50).optional().describe('only if this shift paid a different rate'),
      }),
      execute: async ({ id, date, actual_start, actual_end, drops, rate_per_drop }) => {
        if (actual_start && actual_end) {
          const bad = checkSpan(actual_start, actual_end);
          if (bad) return fail(bad);
        }
        const patch = Object.fromEntries(
          Object.entries({ actual_start, actual_end, drops, rate_per_drop }).filter(([, v]) => v !== undefined)
        );
        if (id) {
          const { error, count } = await db.from('work_shifts').update(patch, { count: 'exact' }).eq('id', id).eq('user_id', userId);
          return error ? fail(error.message) : count ? { ok: true } : fail('no such shift');
        }
        if (!date || !actual_start || !actual_end) return fail('give the shift id, or a date with actual start and end');
        const { data, error } = await db
          .from('work_shifts')
          .insert({ user_id: userId, shift_date: date, start_time: actual_start, end_time: actual_end, title: DEFAULT_SHIFT_TITLE, ...patch })
          .select('id')
          .single();
        return error ? fail(error.message) : { ok: true, id: data.id };
      },
    }),
    update_shift: tool({
      description: 'Change a rota shift time or date.',
      inputSchema: z.object({ id: z.string(), date: date.optional(), start: hm.optional(), end: hm.optional() }),
      execute: async ({ id, date, start, end }) => {
        if (start && end) {
          const bad = checkSpan(start, end);
          if (bad) return fail(bad);
        }
        const patch = Object.fromEntries(Object.entries({ shift_date: date, start_time: start, end_time: end }).filter(([, v]) => v !== undefined));
        const { data: before } = await db.from('work_shifts').select('shift_date').eq('id', id).eq('user_id', userId).maybeSingle();
        if (!before) return fail('no such shift');
        const { error } = await db.from('work_shifts').update(patch).eq('id', id).eq('user_id', userId);
        if (error) return fail(error.message);
        return { ok: true, plan: await replanIfSoon(before.shift_date, date) };
      },
    }),
    delete_shift: tool({
      description: "Delete a shift. Needs the user's explicit yes: confirmed=true only after they agreed.",
      inputSchema: z.object({ id: z.string(), confirmed: z.boolean() }),
      execute: async ({ id, confirmed }) => {
        if (!confirmed) return fail('Ask the user first: deleting needs their explicit yes.');
        const { error, count } = await db.from('work_shifts').delete({ count: 'exact' }).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such shift');
      },
    }),
  };
}

export function moneyTools({ db, userId }: ToolCtx) {
  const money = z.number().min(0).max(1_000_000);
  return {
    add_bill: tool({
      description: 'Add a bill or subscription.',
      inputSchema: z.object({
        name: z.string().min(1),
        amount: money,
        kind: z.enum(['bill', 'subscription']),
        cadence: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'),
        due_dom: z.number().int().min(1).max(31).optional().describe('day of month it leaves'),
      }),
      execute: async (b) => {
        const { data, error } = await db.from('bills').insert({ user_id: userId, ...b, due_dom: b.due_dom ?? null }).select('id').single();
        return error ? fail(error.message) : { ok: true, id: data.id };
      },
    }),
    update_bill: tool({
      description: 'Change a bill/subscription, or cancel it (active=false).',
      inputSchema: z.object({
        id: z.string(),
        name: z.string().optional(),
        amount: money.optional(),
        kind: z.enum(['bill', 'subscription']).optional(),
        cadence: z.enum(['weekly', 'monthly', 'yearly']).optional(),
        due_dom: z.number().int().min(1).max(31).nullable().optional(),
        active: z.boolean().optional(),
      }),
      execute: async ({ id, ...patch }) => {
        const { error, count } = await db.from('bills').update(patch, { count: 'exact' }).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such bill');
      },
    }),
    add_pot: tool({
      description: 'Create a money pot / wishlist goal.',
      inputSchema: z.object({ title: z.string().min(1), target_cost: money.optional(), priority: z.enum(['high', 'medium', 'low']).default('medium'), url: z.string().optional() }),
      execute: async ({ title, target_cost, priority, url }) => {
        const { data, error } = await db
          .from('wishlist_items')
          .insert({ user_id: userId, title, target_cost: target_cost ?? null, priority, url: url ?? null })
          .select('id')
          .single();
        return error ? fail(error.message) : { ok: true, id: data.id };
      },
    }),
    update_pot: tool({
      description: 'Edit a pot. Use add_saved to put money in (negative takes it out). status "purchased" closes it.',
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        target_cost: money.nullable().optional(),
        priority: z.enum(['high', 'medium', 'low']).optional(),
        add_saved: z.number().min(-1_000_000).max(1_000_000).optional(),
        status: z.enum(['active', 'purchased']).optional(),
      }),
      execute: async ({ id, add_saved, status, ...patch }) => {
        const { data: pot } = await db.from('wishlist_items').select('saved_amount').eq('id', id).eq('user_id', userId).maybeSingle();
        if (!pot) return fail('no such pot');
        const row: Record<string, unknown> = { ...patch };
        if (add_saved !== undefined) row.saved_amount = Math.max(0, Math.round((Number(pot.saved_amount) + add_saved) * 100) / 100);
        if (status) {
          row.status = status;
          row.purchased_at = status === 'purchased' ? new Date().toISOString() : null;
        }
        const { error } = await db.from('wishlist_items').update(row).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : { ok: true, saved: row.saved_amount ?? pot.saved_amount };
      },
    }),
    add_pot_item: tool({
      description: 'Add a sub-item (a thing to buy) inside a pot.',
      inputSchema: z.object({ pot_id: z.string(), name: z.string().min(1), cost: money }),
      execute: async ({ pot_id, name, cost }) => {
        const { data: pot } = await db.from('wishlist_items').select('id').eq('id', pot_id).eq('user_id', userId).maybeSingle();
        if (!pot) return fail('no such pot');
        const { data, error } = await db.from('pot_items').insert({ user_id: userId, pot_id, name, cost }).select('id').single();
        return error ? fail(error.message) : { ok: true, id: data.id };
      },
    }),
    update_pot_item: tool({
      description: 'Edit a pot sub-item or mark it bought.',
      inputSchema: z.object({ id: z.string(), name: z.string().optional(), cost: money.optional(), purchased: z.boolean().optional() }),
      execute: async ({ id, purchased, ...patch }) => {
        const row: Record<string, unknown> = { ...patch };
        if (purchased !== undefined) {
          row.purchased = purchased;
          row.purchased_at = purchased ? new Date().toISOString() : null;
        }
        const { error, count } = await db.from('pot_items').update(row, { count: 'exact' }).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such item');
      },
    }),
    set_pay: tool({
      description: 'Set the monthly payday (day of month) and/or the expected monthly pay used for the payday plan.',
      inputSchema: z.object({ payday_dom: z.number().int().min(1).max(31).nullable().optional(), expected_pay: money.nullable().optional() }),
      execute: async (p) => {
        const { error } = await db.from('pay_settings').upsert({ user_id: userId, ...p, updated_at: new Date().toISOString() });
        return error ? fail(error.message) : { ok: true };
      },
    }),
  };
}

export function languageTools({ db, userId }: ToolCtx) {
  const focus = z.enum(['vocabulary', 'grammar', 'listening', 'speaking', 'reading']);
  return {
    get_language_module: tool({
      description: 'Load a language module (lesson) with its full content, to teach it in the chat.',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const { data } = await db
          .from('language_modules')
          .select('id, language, module_number, title, focus_area, content_json, completed')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle();
        return data ?? fail('no such module');
      },
    }),
    list_language_modules: tool({
      description: 'List all language modules in order, with which are done.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await db
          .from('language_modules')
          .select('id, language, module_number, title, focus_area, completed')
          .eq('user_id', userId)
          .order('module_number');
        return data ?? [];
      },
    }),
    complete_language_module: tool({
      description: 'Mark a language module done once the user has worked through it and got most of the practice right.',
      inputSchema: z.object({ id: z.string(), completed: z.boolean().default(true) }),
      execute: async ({ id, completed }) => {
        const { error, count } = await db
          .from('language_modules')
          .update({ completed, completed_at: completed ? new Date().toISOString() : null }, { count: 'exact' })
          .eq('id', id)
          .eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such module');
      },
    }),
    add_language_module: tool({
      description:
        'Write the next language module when the user has finished the existing ones (or asks for one on a topic). Build on what earlier modules covered; keep it to one focused lesson.',
      inputSchema: z.object({
        language: z.string().min(1).describe('e.g. "Spanish", "Italian"; match the existing course name'),
        title: z.string().min(1),
        focus_area: focus,
        content: z.object({
          intro: z.string(),
          words: z
            .array(z.object({ word: z.string(), translation: z.string(), example: z.string(), example_translation: z.string() }))
            .max(15)
            .optional(),
          rule: z.string().optional(),
          speaking_prompts: z.array(z.string()).max(6).optional(),
          reading_text: z.string().optional(),
          reading_questions: z.array(z.object({ question: z.string(), answer: z.string() })).max(6).optional(),
          tips: z.array(z.string()).max(6).optional(),
        }),
      }),
      execute: async ({ language, title, focus_area, content }) => {
        const { data: last } = await db
          .from('language_modules')
          .select('module_number')
          .eq('user_id', userId)
          .ilike('language', language)
          .order('module_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        const { data, error } = await db
          .from('language_modules')
          .insert({ user_id: userId, language, module_number: (last?.module_number ?? 0) + 1, title, focus_area, content_json: content })
          .select('id, module_number')
          .single();
        return error ? fail(error.message) : { ok: true, ...data };
      },
    }),
  };
}

/** Phase 4: earned free time, streaks and rewards. */
export function rewardTools(ctx: ToolCtx) {
  const { db, userId } = ctx;
  return {
    get_progress: tool({
      description: 'Free-time balance, streak, what the schedule has learned about when things get done, and the reward list.',
      inputSchema: z.object({}),
      execute: async () => {
        const p = await loadProgress(db, userId, ctx.rules);
        return { ledger: describeLedger(p.ledger), patterns: describePatterns(p.patterns), rewards: describeRewards(p.rewards) };
      },
    }),
    add_reward: tool({
      description: 'Add a reward the user can buy with earned free time, e.g. "an hour of gaming" for 60 min. Use the user\'s own words for the title.',
      inputSchema: z.object({ title: z.string().min(1), cost_min: z.number().int().min(5).max(1440) }),
      execute: async ({ title, cost_min }) => {
        const { data, error } = await db.from('rewards').insert({ user_id: userId, title, cost_min }).select('id').single();
        return error ? fail(error.message) : { ok: true, id: data.id };
      },
    }),
    update_reward: tool({
      description: 'Change a reward\'s title or cost, or retire it (active=false).',
      inputSchema: z.object({ id: z.string(), title: z.string().optional(), cost_min: z.number().int().min(5).max(1440).optional(), active: z.boolean().optional() }),
      execute: async ({ id, ...patch }) => {
        const { error, count } = await db.from('rewards').update(patch, { count: 'exact' }).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such reward');
      },
    }),
    redeem_reward: tool({
      description:
        'Spend earned free time on a reward (a listed one by id, or a one-off with a title and minutes). Refused when the balance is too low: free time has to be earned first.',
      inputSchema: z.object({ reward_id: z.string().optional(), title: z.string().optional(), cost_min: z.number().int().min(1).max(1440).optional() }),
      execute: async ({ reward_id, title, cost_min }) => {
        let item = title && cost_min ? { id: null as string | null, title, cost_min } : null;
        if (reward_id) {
          const { data } = await db.from('rewards').select('id, title, cost_min').eq('id', reward_id).eq('user_id', userId).maybeSingle();
          if (!data) return fail('no such reward');
          item = data;
        }
        if (!item) return fail('give a reward_id, or a title and cost_min');
        const { ledger } = await loadProgress(db, userId, ctx.rules);
        if (ledger.balanceMin < item.cost_min) return fail(`not earned yet: ${ledger.balanceMin} min banked, ${item.title} costs ${item.cost_min}`);
        const { error } = await db.from('reward_redemptions').insert({ user_id: userId, reward_id: item.id, title: item.title, cost_min: item.cost_min });
        return error ? fail(error.message) : { ok: true, balance_after_min: ledger.balanceMin - item.cost_min };
      },
    }),
  };
}

/** Phase 3: the user's trading notes (slides) and BotCouncil's status. */
export function freelanceTools({ db, userId }: ToolCtx) {
  const position = z.number().int().min(1).max(100000);
  return {
    get_note: tool({
      description: 'Read one slide of the trading notes in full (by id, or by its #position).',
      inputSchema: z.object({ id: z.string().optional(), position: position.optional() }),
      execute: async ({ id, position }) => {
        let q = db.from('trading_notes').select('id, position, section, title, body').eq('user_id', userId);
        if (id) q = q.eq('id', id);
        else if (position) q = q.eq('position', position);
        else return fail('give an id or a position');
        const { data } = await q.limit(1).maybeSingle();
        return data ?? fail('no such slide');
      },
    }),
    search_notes: tool({
      description: 'Find slides whose title or text mentions a term (e.g. "breaker", "CBDR", "Thursday").',
      inputSchema: z.object({ query: z.string().min(2) }),
      execute: async ({ query }) => {
        const notes = await listNotes(db, userId);
        const q = query.toLowerCase();
        return notes
          .filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
          .slice(0, 12)
          .map((n) => {
            const at = n.body.toLowerCase().indexOf(q);
            return { id: n.id, position: n.position, title: n.title, snippet: at >= 0 ? n.body.slice(Math.max(0, at - 80), at + 160) : n.body.slice(0, 160) };
          });
      },
    }),
    add_note: tool({
      description:
        "Add a slide with what the user just told you (their words, tidied, never your own trading ideas). Goes at the end unless after_position is given.",
      inputSchema: z.object({ title: z.string().min(1), body: z.string(), section: z.string().optional(), after_position: position.optional() }),
      execute: async ({ title, body, section, after_position }) => {
        const notes = await listNotes(db, userId);
        let pos = (notes[notes.length - 1]?.position ?? 0) + 1;
        if (after_position !== undefined) {
          pos = after_position + 1;
          for (const n of [...notes].reverse().filter((n) => n.position >= pos)) {
            await db.from('trading_notes').update({ position: n.position + 1 }).eq('id', n.id);
          }
        }
        const { data, error } = await db
          .from('trading_notes')
          .insert({ user_id: userId, position: pos, title, body, section: section ?? notes.find((n) => n.position === pos - 1)?.section ?? null })
          .select('id, position')
          .single();
        return error ? fail(error.message) : { ok: true, ...data };
      },
    }),
    update_note: tool({
      description: "Edit a slide's title, text or chapter, as the user asked.",
      inputSchema: z.object({ id: z.string(), title: z.string().optional(), body: z.string().optional(), section: z.string().nullable().optional() }),
      execute: async ({ id, ...patch }) => {
        const { error, count } = await db.from('trading_notes').update(patch, { count: 'exact' }).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such slide');
      },
    }),
    delete_note: tool({
      description: "Delete a slide. Needs the user's explicit yes: confirmed=true only after they agreed to delete that slide.",
      inputSchema: z.object({ id: z.string(), confirmed: z.boolean() }),
      execute: async ({ id, confirmed }) => {
        if (!confirmed) return fail('Ask the user first: deleting needs their explicit yes.');
        const { error, count } = await db.from('trading_notes').delete({ count: 'exact' }).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such slide');
      },
    }),
    botcouncil_status: tool({
      description: "Fresh BotCouncil status (sweeps, forecasts, accuracy, council readiness, AI spend, users). Read-only.",
      inputSchema: z.object({}),
      execute: async () => describeBotCouncil(await botCouncilStatus()),
    }),
  };
}

/** Today in London, for prompts. */
export function nowLine(): string {
  const n = londonNow();
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n.dayOfWeek];
  return `It is ${day} ${n.dateISO}, ${String(n.hour).padStart(2, '0')}:${String(n.minute).padStart(2, '0')} in London.`;
}
