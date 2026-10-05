import type { EffectiveBlock } from '@/lib/schedule/effective';

export type BlockKind = 'lecture' | 'trading' | 'gym' | 'learning' | 'botcouncil' | 'prayer' | 'other';

type Look = { label: string; /** filled chip (grid, list rows) */ chip: string; /** solid swatch (legend) */ dot: string };

// The one place schedule colours are decided. Everything else on the site stays monochrome.
export const BLOCK_LOOK: Record<BlockKind, Look> = {
  lecture: { label: 'University', chip: 'border-purple-400/60 bg-purple-500/25 text-purple-100', dot: 'bg-purple-500' },
  trading: { label: 'Trading', chip: 'border-emerald-400/60 bg-emerald-500/25 text-emerald-100', dot: 'bg-emerald-500' },
  gym: { label: 'Gym', chip: 'border-sky-400/60 bg-sky-500/25 text-sky-100', dot: 'bg-sky-500' },
  learning: { label: 'Learning', chip: 'border-red-400/60 bg-red-500/25 text-red-100', dot: 'bg-red-500' },
  botcouncil: { label: 'BotCouncil', chip: 'border-amber-400/60 bg-amber-500/25 text-amber-100', dot: 'bg-amber-500' },
  prayer: { label: 'Prayer', chip: 'border-teal-400/50 bg-teal-500/15 text-teal-100', dot: 'bg-teal-500' },
  other: { label: 'Other', chip: 'border-white/20 bg-white/[0.06] text-foreground', dot: 'bg-zinc-400' },
};

export function blockKind(b: Pick<EffectiveBlock, 'label' | 'activity_type'>): BlockKind {
  if (/^uni lecture/i.test(b.label)) return 'lecture';
  if (b.activity_type === 'gym' || /gym/i.test(b.label)) return 'gym';
  switch (b.activity_type) {
    case 'trading':
      return 'trading';
    case 'botcouncil':
      return 'botcouncil';
    case 'prayer':
      return 'prayer';
    case 'course':
    case 'language':
    case 'reading':
      return 'learning';
    default:
      return 'other';
  }
}
