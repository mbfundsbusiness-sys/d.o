import type { AssistantKey } from '@/lib/supabase/types';

// Client-safe list of assistants (the server definitions live in ./index.ts).
// Each assistant owns one tertiary colour; the backdrop's scan beam takes it on.
export const ASSISTANT_NAV: { key: AssistantKey; name: string; blurb: string; ready: boolean; colour: string }[] = [
  { key: 'ea', name: 'EA', blurb: 'Your day, schedule and to-dos', ready: true, colour: '#2dd4bf' }, // blue-green
  { key: 'finance', name: 'Finance', blurb: 'Shifts, pots, bills, tax', ready: true, colour: '#a3e635' }, // yellow-green
  { key: 'scholarship', name: 'Scholarship', blurb: 'Uni and languages', ready: true, colour: '#818cf8' }, // blue-violet
  { key: 'freelance', name: 'Freelance', blurb: 'Trading notes, BotCouncil', ready: false, colour: '#ff6b3d' }, // red-orange
];

/** The assistant a path belongs to ("/app" is the EA). */
export function assistantForPath(path: string) {
  const key = path.split('/')[2];
  return ASSISTANT_NAV.find((a) => a.key === key) ?? ASSISTANT_NAV[0];
}
