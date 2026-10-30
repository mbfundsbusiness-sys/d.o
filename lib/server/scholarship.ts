import type { SupabaseClient } from '@supabase/supabase-js';
import type { LanguageModule, ScheduleBlock, TodoItem } from '@/lib/supabase/types';
import { UNI_MODULES, uniModuleForLabel, type UniModuleKey } from '@/lib/uni/modules';
import { recentWindow, type ModuleStudy } from '@/lib/scholarship/study';
import { fmtHM, minutesOfDay, todayISO } from '@/lib/utils/dates';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type Deadline = { id: string; title: string; kind: 'exams' | 'coursework'; due: string; module_key: UniModuleKey | 'language' | null };

export type ModuleView = ModuleStudy & {
  title: string;
  lectures: { day: string; start: string; end: string }[];
  deadlines: Deadline[];
};

export type LanguageView = {
  language: string;
  completed: number;
  total: number;
  next: { id: string; module_number: number; title: string; focus_area: string } | null;
};

export type ScholarshipSummary = {
  today: string;
  modules: ModuleView[];
  languages: LanguageView[];
  /** Minutes of language study (all languages) in the last 7 days. */
  languageRecentMin: number;
  undated: Deadline[];
};

const londonDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(iso));

export async function scholarshipSummary(db: SupabaseClient, userId: string, today = todayISO()): Promise<ScholarshipSummary> {
  const { from, to } = recentWindow(today);
  const [blocksRes, todosRes, planRes, langRes] = await Promise.all([
    db.from('schedule_blocks').select('*').eq('user_id', userId).is('archived_at', null).ilike('label', 'uni lecture%'),
    db.from('todo_items').select('*').eq('user_id', userId).eq('completed', false).in('category', ['exams', 'coursework']),
    db.from('plan_items').select('module_key, start_time, end_time').eq('user_id', userId).eq('status', 'done').gte('plan_date', from).lte('plan_date', to).not('module_key', 'is', null),
    db.from('language_modules').select('id, language, module_number, title, focus_area, completed').eq('user_id', userId).order('module_number'),
  ]);

  const recent = new Map<string, number>();
  for (const p of (planRes.data ?? []) as { module_key: string; start_time: string; end_time: string }[]) {
    recent.set(p.module_key, (recent.get(p.module_key) ?? 0) + minutesOfDay(p.end_time) - minutesOfDay(p.start_time));
  }

  const deadlines: Deadline[] = ((todosRes.data ?? []) as TodoItem[])
    .filter((t) => t.due_at)
    .map((t) => ({ id: t.id, title: t.title, kind: t.category as Deadline['kind'], due: londonDate(t.due_at!), module_key: t.module_key }))
    .sort((a, b) => a.due.localeCompare(b.due));
  const undated: Deadline[] = ((todosRes.data ?? []) as TodoItem[])
    .filter((t) => !t.due_at)
    .map((t) => ({ id: t.id, title: t.title, kind: t.category as Deadline['kind'], due: '', module_key: t.module_key }));

  const blocks = (blocksRes.data ?? []) as ScheduleBlock[];
  const modules: ModuleView[] = UNI_MODULES.map((m) => {
    const mine = deadlines.filter((d) => d.module_key === m.key && d.due >= today);
    return {
      key: m.key,
      short: m.short,
      title: m.title,
      nextDue: mine[0]?.due ?? null,
      recentMin: recent.get(m.key) ?? 0,
      deadlines: mine,
      lectures: blocks
        .filter((b) => uniModuleForLabel(b.label)?.key === m.key)
        .sort((a, b) => a.day_of_week - b.day_of_week)
        .map((b) => ({ day: DAY[b.day_of_week], start: fmtHM(b.start_time), end: fmtHM(b.end_time) })),
    };
  });

  const lang = (langRes.data ?? []) as Pick<LanguageModule, 'id' | 'language' | 'module_number' | 'title' | 'focus_area' | 'completed'>[];
  const languages: LanguageView[] = Array.from(new Set(lang.map((l) => l.language)))
    .sort()
    .map((language) => {
      const mine = lang.filter((l) => l.language === language);
      const next = mine.find((l) => !l.completed) ?? null;
      return {
        language,
        completed: mine.filter((l) => l.completed).length,
        total: mine.length,
        next: next ? { id: next.id, module_number: next.module_number, title: next.title, focus_area: next.focus_area } : null,
      };
    });
  return { today, modules, undated, languages, languageRecentMin: recent.get('language') ?? 0 };
}

/** With more than one language on the go, the daily language block alternates between them by date. */
export function languageForDay(languages: LanguageView[], today: string): LanguageView | undefined {
  const open = languages.filter((l) => l.next);
  if (open.length === 0) return undefined;
  const dayNumber = Math.floor(Date.parse(today + 'T00:00:00Z') / 86_400_000);
  return open[dayNumber % open.length];
}

/** What the planner needs: per-module deadlines/recent study, and the next language lesson's title. */
export async function studyInputs(db: SupabaseClient, userId: string, today: string): Promise<{ study: ModuleStudy[]; languageTitle?: string }> {
  const s = await scholarshipSummary(db, userId, today);
  return {
    study: s.modules.map(({ key, short, nextDue, recentMin }) => ({ key, short, nextDue, recentMin })),
    languageTitle: (() => {
      const l = languageForDay(s.languages, today);
      return l?.next ? `${l.language}, ${l.next.title}` : undefined;
    })(),
  };
}

export function describeScholarship(s: ScholarshipSummary): string {
  const lines: string[] = [];
  for (const m of s.modules) {
    lines.push(
      `${m.short} [module_key ${m.key}]: lectures ${m.lectures.map((l) => `${l.day} ${l.start}-${l.end}`).join(', ') || 'none on the timetable'}; studied ${m.recentMin} min in the last 7 days; ` +
        (m.deadlines.length ? `deadlines: ${m.deadlines.map((d) => `${d.title} (${d.kind}) due ${d.due} id=${d.id}`).join('; ')}` : 'no deadlines logged')
    );
  }
  if (s.undated.length) lines.push(`Coursework/exams with no date: ${s.undated.map((d) => `${d.title} id=${d.id}`).join('; ')}`);
  if (s.languages.length === 0) lines.push('Languages: no modules yet.');
  for (const l of s.languages) {
    lines.push(
      `${l.language}: ${l.completed}/${l.total} modules done. Next: ${l.next ? `#${l.next.module_number} "${l.next.title}" (${l.next.focus_area}) id=${l.next.id}` : 'all done, write the next module'}.`
    );
  }
  lines.push(`Language study, all languages: ${s.languageRecentMin} min in the last 7 days. Today's language block goes to: ${languageForDay(s.languages, s.today)?.language ?? 'none'}.`);
  return lines.join('\n');
}
