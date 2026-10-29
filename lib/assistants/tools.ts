import { tool } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describeRules, setRule, type Rules } from '@/lib/rules';
import { describeDay } from '@/lib/schedule/day';
import { DEFAULT_SHIFT_TITLE } from '@/lib/schedule/shifts';
import { loadDay, saveRules } from '@/lib/server/data';
import { replanDay } from '@/lib/server/plan';
import { londonNow, londonToUtcISO, minutesOfDay } from '@/lib/utils/dates';

// Every tool is scoped to one user. Outputs are short strings or small objects
// the model relays; errors come back as { error } so the model can explain them.

export type ToolCtx = { db: SupabaseClient; userId: string; rules: Rules };

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe('24h HH:MM, London time');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD, London');
const kind = z.enum(['exams', 'coursework', 'study', 'trading', 'botcouncil', 'gym', 'language', 'task', 'other']);
const todoCategory = z.enum(['exams', 'coursework', 'trading', 'botcouncil', 'gym', 'language', 'task', 'other']);

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
      }),
      execute: async ({ title, due, category, priority, estimate_min, notes }) => {
        const due_at = dueISO(due);
        if (due && due_at === undefined) return fail('due must be YYYY-MM-DD or YYYY-MM-DD HH:MM');
        const { data, error } = await db
          .from('todo_items')
          .insert({ user_id: userId, title, due_at: due_at ?? null, category, priority, estimate_min: estimate_min ?? null, notes: notes ?? null })
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
          .select('id, title, due_at, category, priority, estimate_min')
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

export function shiftTools({ db, userId }: ToolCtx) {
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
        return error ? fail(error.message) : { ok: true, id: data.id };
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
        const { error, count } = await db.from('work_shifts').update(patch, { count: 'exact' }).eq('id', id).eq('user_id', userId);
        return error ? fail(error.message) : count ? { ok: true } : fail('no such shift');
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

/** Today in London, for prompts. */
export function nowLine(): string {
  const n = londonNow();
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n.dayOfWeek];
  return `It is ${day} ${n.dateISO}, ${String(n.hour).padStart(2, '0')}:${String(n.minute).padStart(2, '0')} in London.`;
}
