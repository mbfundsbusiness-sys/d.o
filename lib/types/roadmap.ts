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
      'Establish daily rhythm, stabilise sleep, set up the tracking habit, and prepare application materials. No capital deployment yet — just structure.',
    goals: [
      'Consistent wake time before 07:30',
      'Daily anchor logging becomes automatic',
      'CV and cover letter template ready',
      'Trading plan documented and reviewed daily',
    ],
    anchors: ['Wake time', 'Anchor log', 'Trading in-plan', 'BotCouncil check'],
  },
  {
    id: 'search_sprint',
    number: 2,
    title: 'Search Sprint',
    subtitle: 'High-volume applications',
    status: 'upcoming',
    description:
      'Sustained, disciplined job search. Target 5+ quality applications per day. Track every application, follow up at 5 working days, and keep trading discipline while the search runs.',
    goals: [
      '5+ applications sent per day',
      'Follow up on every application at 5 working days',
      'Land first interview',
      'Maintain trading-in-plan streak',
    ],
    anchors: ['Applications sent', 'Follow-up flagging', 'Interview pipeline'],
  },
  {
    id: 'stabilise',
    number: 3,
    title: 'Stabilise',
    subtitle: 'Secure and settle',
    status: 'upcoming',
    description:
      'Convert search into an apprenticeship or role. Stabilise income and routine. Light BotCouncil maintenance continues. Trading discipline stays strict — no over-leveraging just because income returns.',
    goals: [
      'Accept an offer in London or within 15 miles west',
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
