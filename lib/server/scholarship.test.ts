import { describe, expect, it } from 'vitest';
import { languageForDay, type LanguageView } from '@/lib/server/scholarship';

const lang = (language: string, open: boolean): LanguageView => ({
  language, completed: 0, total: 3, next: open ? { id: language, module_number: 1, title: 't', focus_area: 'vocabulary' } : null,
});

describe('languageForDay', () => {
  it('alternates between languages with lessons left, day by day', () => {
    const ls = [lang('Italian', true), lang('Spanish', true)];
    const a = languageForDay(ls, '2026-10-30')?.language;
    const b = languageForDay(ls, '2026-10-31')?.language;
    expect(new Set([a, b])).toEqual(new Set(['Italian', 'Spanish']));
  });
  it('skips a finished language', () => {
    expect(languageForDay([lang('Italian', false), lang('Spanish', true)], '2026-10-30')?.language).toBe('Spanish');
    expect(languageForDay([lang('Italian', false)], '2026-10-30')).toBeUndefined();
  });
});
