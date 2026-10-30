import { z } from 'zod';

// Every "how my life works" rule lives here as data, stored per user in
// assistant_settings.rules. The assistants change these through chat
// (set_rule), so a change in routine never needs a code edit.

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use 24h HH:MM');

export const PRIORITY_KEYS = ['exams', 'coursework', 'trading', 'botcouncil', 'gym', 'language'] as const;
export type PriorityKey = (typeof PRIORITY_KEYS)[number];

export const rulesSchema = z.object({
  wake: z.object({
    /** Wake time on a day with nothing early. */
    default: hm,
    /** Wake this long before the first lecture. */
    lecture_lead_min: z.number().int().min(0).max(300),
    /** Wake this long before a DPD shift. */
    shift_lead_min: z.number().int().min(0).max(300),
  }),
  /** Planner stops placing flexible work after this time. */
  wind_down: hm,
  /** 0 = Sunday .. 6 = Saturday. No flexible work is planned on rest days. */
  rest_days: z.array(z.number().int().min(0).max(6)),
  /** Daily minutes the planner tries to fit for each flexible activity. 0 = skip. */
  targets: z.object({
    study_min: z.number().int().min(0).max(600),
    trading_min: z.number().int().min(0).max(600),
    botcouncil_min: z.number().int().min(0).max(600),
    gym_min: z.number().int().min(0).max(300),
    language_min: z.number().int().min(0).max(300),
  }),
  /** Trading is only planned on these days (markets). */
  trading_days: z.array(z.number().int().min(0).max(6)),
  /** Gym sessions per week the planner aims for. */
  gym_sessions_per_week: z.number().int().min(0).max(7),
  /** When time is short, earlier wins. */
  priorities: z.array(z.enum(PRIORITY_KEYS)),
  /** Minimum gap the planner leaves between blocks. */
  buffer_min: z.number().int().min(0).max(60),
  finance: z.object({
    /** £ per parcel delivered; null until known. */
    per_drop_rate: z.number().min(0).max(50).nullable(),
    /** Share of self-employed earnings to set aside for tax and NI. */
    tax_set_aside_pct: z.number().min(0).max(60),
  }),
  pings: z.object({
    morning_brief: z.boolean(),
    evening_review: z.boolean(),
    evening_review_time: hm,
    slacking_callouts: z.boolean(),
    /** How late a planned block can be before the EA calls it out. */
    slacking_grace_min: z.number().int().min(10).max(600),
    quiet_start: hm,
    quiet_end: hm,
  }),
  /** How hard the EA pushes. */
  tone: z.enum(['blunt', 'firm', 'gentle']),
  /** Free time is earned: done work adds minutes, missed work takes some away. */
  rewards: z.object({
    /** Free-time minutes earned per hour of planned work done. */
    earn_per_hour: z.number().int().min(0).max(120),
    /** Free-time minutes lost per hour of planned work missed. */
    miss_penalty_per_hour: z.number().int().min(0).max(120),
    /** A day keeps the streak alive when at least this % of its plan is done. */
    streak_pct: z.number().int().min(10).max(100),
  }),
  /** How much the schedule optimises itself. */
  autopilot: z.object({
    /** When a block is missed, re-plan the rest of the day straight away. */
    auto_replan: z.boolean(),
    /** Place study, BotCouncil, gym and language in the hours they actually get done. */
    learn_windows: z.boolean(),
  }),
});

export type Rules = z.infer<typeof rulesSchema>;

export const DEFAULT_RULES: Rules = {
  wake: { default: '09:00', lecture_lead_min: 120, shift_lead_min: 60 },
  wind_down: '22:30',
  rest_days: [],
  targets: { study_min: 90, trading_min: 120, botcouncil_min: 60, gym_min: 45, language_min: 30 },
  trading_days: [1, 2, 3, 4, 5],
  gym_sessions_per_week: 3,
  priorities: ['exams', 'coursework', 'trading', 'botcouncil', 'gym', 'language'],
  buffer_min: 10,
  finance: { per_drop_rate: null, tax_set_aside_pct: 20 },
  pings: {
    morning_brief: true,
    evening_review: true,
    evening_review_time: '21:30',
    slacking_callouts: true,
    slacking_grace_min: 60,
    quiet_start: '23:00',
    quiet_end: '04:00',
  },
  tone: 'blunt',
  rewards: { earn_per_hour: 20, miss_penalty_per_hour: 10, streak_pct: 80 },
  autopilot: { auto_replan: true, learn_windows: true },
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function deepMerge(base: Obj, over: Obj): Obj {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k] as Obj, v) : v;
  }
  return out;
}

/** Stored rules over the defaults. Invalid stored values fall back to the default for that key. */
export function resolveRules(stored: unknown): Rules {
  const merged = deepMerge(DEFAULT_RULES as unknown as Obj, isObj(stored) ? stored : {});
  const parsed = rulesSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  // Drop the offending top-level keys rather than losing every rule.
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  const cleaned: Obj = {};
  for (const [k, v] of Object.entries(merged)) cleaned[k] = bad.has(k) ? (DEFAULT_RULES as unknown as Obj)[k] : v;
  return rulesSchema.parse(cleaned);
}

/**
 * Sets one rule by dotted path ("targets.gym_min", "rest_days", "finance.per_drop_rate").
 * Returns the new full rules or an error message the assistant can relay.
 */
export function setRule(current: Rules, path: string, value: unknown): { rules: Rules } | { error: string } {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) return { error: 'empty rule path' };
  const next = structuredClone(current) as unknown as Obj;
  let cursor: Obj = next;
  for (const k of keys.slice(0, -1)) {
    if (!isObj(cursor[k])) return { error: `unknown rule "${path}"` };
    cursor = cursor[k] as Obj;
  }
  const last = keys[keys.length - 1];
  if (!(last in cursor)) return { error: `unknown rule "${path}"` };
  cursor[last] = value;
  const parsed = rulesSchema.safeParse(next);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue.path.join('.')}: ${issue.message}` };
  }
  return { rules: parsed.data };
}

/** Only the keys that differ from the defaults, so stored rows stay small and defaults can evolve. */
export function diffFromDefaults(rules: Rules): Obj {
  const walk = (a: unknown, d: unknown): unknown => {
    if (isObj(a) && isObj(d)) {
      const out: Obj = {};
      for (const k of Object.keys(a)) {
        const v = walk(a[k], d[k]);
        if (v !== undefined) out[k] = v;
      }
      return Object.keys(out).length ? out : undefined;
    }
    return JSON.stringify(a) === JSON.stringify(d) ? undefined : a;
  };
  return (walk(rules, DEFAULT_RULES) as Obj | undefined) ?? {};
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Compact rules listing for prompts. */
export function describeRules(r: Rules): string {
  const days = (d: number[]) => (d.length ? d.map((x) => DAY[x]).join('/') : 'none');
  return [
    `wake.default=${r.wake.default}, wake.lecture_lead_min=${r.wake.lecture_lead_min}, wake.shift_lead_min=${r.wake.shift_lead_min}, wind_down=${r.wind_down}`,
    `rest_days=${days(r.rest_days)}, trading_days=${days(r.trading_days)}, gym_sessions_per_week=${r.gym_sessions_per_week}, buffer_min=${r.buffer_min}`,
    `targets (min/day): study=${r.targets.study_min}, trading=${r.targets.trading_min}, botcouncil=${r.targets.botcouncil_min}, gym=${r.targets.gym_min}, language=${r.targets.language_min}`,
    `priorities (first wins when time is short): ${r.priorities.join(' > ')}`,
    `finance: per_drop_rate=${r.finance.per_drop_rate ?? 'unknown'}, tax_set_aside_pct=${r.finance.tax_set_aside_pct}`,
    `pings: morning_brief=${r.pings.morning_brief}, evening_review=${r.pings.evening_review}@${r.pings.evening_review_time}, slacking_callouts=${r.pings.slacking_callouts} (grace ${r.pings.slacking_grace_min} min), quiet ${r.pings.quiet_start}-${r.pings.quiet_end}`,
    `tone=${r.tone}`,
    `rewards: earn_per_hour=${r.rewards.earn_per_hour} min free per hour done, miss_penalty_per_hour=${r.rewards.miss_penalty_per_hour}, streak_pct=${r.rewards.streak_pct}`,
    `autopilot: auto_replan=${r.autopilot.auto_replan}, learn_windows=${r.autopilot.learn_windows}`,
  ].join('\n');
}
