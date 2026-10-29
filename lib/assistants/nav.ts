import type { AssistantKey } from '@/lib/supabase/types';

// Client-safe list of assistants (the server definitions live in ./index.ts).
export const ASSISTANT_NAV: { key: AssistantKey; name: string; blurb: string; ready: boolean }[] = [
  { key: 'ea', name: 'EA', blurb: 'Your day, schedule and to-dos', ready: true },
  { key: 'finance', name: 'Finance', blurb: 'Shifts, pots, bills, tax', ready: true },
  { key: 'scholarship', name: 'Scholarship', blurb: 'Uni and languages', ready: false },
  { key: 'freelance', name: 'Freelance', blurb: 'Trading notes, BotCouncil', ready: false },
];
