export type PhaseId = 'foundation' | 'search_sprint' | 'stabilise' | 'scale';

export type PhaseStatus = 'active' | 'upcoming' | 'done';

export type RoadmapPhase = {
  id: PhaseId;
  number: number;
  title: string;
  subtitle: string;
  status: PhaseStatus;
  description: string;
  goals: string[];
  anchors: string[];
};

export const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    id: 'foundation',
    number: 1,
    title: 'Foundation',
    subtitle: 'Rebuild the base',
    status: 'active',
    description:
      'Establish daily rhythm, stabilise sleep, set up the tracking habit, and lock in the streak rule. No capital deployment yet — just structure.',
    goals: [
      'Consistent wake time at 9:00am',
      'Daily anchor logging becomes automatic',
      'Streak rule met daily: wake log, 1h BotCouncil, 1h learning, 30min gym',
      'Trading plan documented and reviewed daily',
    ],
    anchors: ['Wake time', 'Anchor log', 'Trading in-plan', 'BotCouncil check'],
  },
  {
    id: 'search_sprint',
    number: 2,
    title: 'Work Routine',
    subtitle: 'Built around DPD shifts',
    status: 'upcoming',
    description:
      'Now working as a DPD delivery driver on rotating shifts, studying at university. Keep the daily streak alive around shifts and lectures, and keep trading discipline on weekdays.',
    goals: [
      'Enter the week\'s shifts every weekend',
      'Hit the daily streak on shift days too',
      'Attend lectures, even on work days where possible',
      'Maintain trading-in-plan on weekdays',
    ],
    anchors: ['Shifts entered', 'Streak', 'Lectures attended'],
  },
  {
    id: 'stabilise',
    number: 3,
    title: 'Stabilise',
    subtitle: 'Secure and settle',
    status: 'upcoming',
    description:
      'Turn the job into a stable base. Stabilise income and routine. Light BotCouncil maintenance continues. Trading discipline stays strict — no over-leveraging just because income returns.',
    goals: [
      'Settle into a predictable weekly routine around work and uni',
      'Stabilise weekly routine around work hours',
      'Begin rebuilding savings (first £500 buffer)',
      'Maintain BotCouncil maintenance cadence',
    ],
    anchors: ['Savings buffer', 'Routine stability', 'BotCouncil maintenance'],
  },
  {
    id: 'scale',
    number: 4,
    title: 'Scale',
    subtitle: 'Compound the base',
    status: 'upcoming',
    description:
      'With a stable income and routine, begin scaling trading capital carefully and expanding BotCouncil. This phase only starts once the foundation is solid and income is reliable.',
    goals: [
      'Grow trading capital from savings surplus only',
      'Expand BotCouncil product surface',
      '6-month emergency fund',
      'Reviewed and updated trading plan',
    ],
    anchors: ['Capital growth', 'Product expansion', 'Emergency fund'],
  },
];
