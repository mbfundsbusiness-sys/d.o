import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, diffFromDefaults, resolveRules, setRule } from '@/lib/rules';

describe('rules', () => {
  it('fills missing keys from the defaults', () => {
    const r = resolveRules({ targets: { gym_min: 60 } });
    expect(r.targets.gym_min).toBe(60);
    expect(r.targets.trading_min).toBe(DEFAULT_RULES.targets.trading_min);
    expect(r.wake.default).toBe('09:00');
  });

  it('drops an invalid stored section instead of failing', () => {
    const r = resolveRules({ wake: { default: 'nine' }, tone: 'gentle' });
    expect(r.wake).toEqual(DEFAULT_RULES.wake);
    expect(r.tone).toBe('gentle');
  });

  it('sets a rule by path and validates it', () => {
    const ok = setRule(DEFAULT_RULES, 'rest_days', [0]);
    expect('rules' in ok && ok.rules.rest_days).toEqual([0]);
    const bad = setRule(DEFAULT_RULES, 'wake.default', '25:00');
    expect('error' in bad).toBe(true);
    const unknown = setRule(DEFAULT_RULES, 'targets.sleep_min', 30);
    expect('error' in unknown && unknown.error).toMatch(/unknown rule/);
  });

  it('stores only what differs from the defaults', () => {
    const res = setRule(DEFAULT_RULES, 'finance.per_drop_rate', 1.1);
    if (!('rules' in res)) throw new Error('expected rules');
    expect(diffFromDefaults(res.rules)).toEqual({ finance: { per_drop_rate: 1.1 } });
    expect(resolveRules(diffFromDefaults(res.rules)).finance.per_drop_rate).toBe(1.1);
  });
});
