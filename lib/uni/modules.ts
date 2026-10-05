// The four lecture modules of the BEng Electrical and Electronic Engineering programme.
// `title` matches the schedule lecture labels ("Uni Lecture: <title>"), so a lecture
// block can be linked to its tutor by label.

export type UniModuleKey = 'programming' | 'circuits' | 'maths' | 'engsci';

export type UniModule = {
  key: UniModuleKey;
  title: string;
  short: string;
  lectureLabelPrefix: string;
  /** Subject-specific tutor brief appended to the shared system prompt. */
  brief: string;
  starters: string[];
};

export const UNI_MODULES: UniModule[] = [
  {
    key: 'programming',
    title: 'Programming & Software / Engineering Software',
    short: 'Programming & Software',
    lectureLabelPrefix: 'Uni Lecture: Programming & Software',
    brief:
      'Module: Programming & Software / Engineering Software. Help with programming fundamentals and software engineering practice as taught on an electrical/electronic engineering degree — writing and debugging code, data structures, algorithms, version control, testing, and structuring programs. The language(s) used by the course are not known: if it matters, ask which language the coursework uses before giving code. Prefer explaining the reasoning and having the student write the code; give worked examples for concepts, and hints before full solutions for assessed work.',
    starters: ['Explain pointers/references with a small example', 'Help me debug this code', 'Quiz me on this week\'s lecture'],
  },
  {
    key: 'circuits',
    title: 'Electronic Circuits & Audio Electronics',
    short: 'Circuits & Audio Electronics',
    lectureLabelPrefix: 'Uni Lecture: Electronic Circuits',
    brief:
      'Module: Electronic Circuits & Audio Electronics. Help with circuit analysis (Ohm/Kirchhoff, Thevenin/Norton, nodal and mesh analysis), RC/RL/RLC behaviour, diodes, BJTs/MOSFETs and op-amp circuits, filters and frequency response, and audio electronics (amplifiers, preamps, tone controls, power supplies, noise). Show the equations step by step with units, sanity-check magnitudes, and describe circuits in text clearly (node names, component values). Mention practical considerations and lab safety where relevant.',
    starters: ['Walk me through nodal analysis on a circuit', 'Explain an op-amp inverting amplifier', 'How do I design a simple audio filter?'],
  },
  {
    key: 'maths',
    title: 'Mathematics for Engineering 1 & Quantitative Tools for Audio',
    short: 'Maths & Quantitative Tools',
    lectureLabelPrefix: 'Uni Lecture: Mathematics',
    brief:
      'Module: Mathematics for Engineering 1 & Quantitative Tools for Audio. Help with first-year engineering maths — algebra, trigonometry, complex numbers, functions, differentiation and integration, series, vectors/matrices, differential equations — and the quantitative tools used for audio (decibels, logarithms, sinusoids and phasors, frequency/period, Fourier/spectrum ideas, sampling). Solve step by step, state the rule used at each step, and give a similar practice question afterwards. Use plain-text maths that is easy to read.',
    starters: ['Show me how to integrate by parts', 'Explain decibels and logs for audio', 'Give me practice questions on complex numbers'],
  },
  {
    key: 'engsci',
    title: 'Engineering Science (ELE)',
    short: 'Engineering Science',
    lectureLabelPrefix: 'Uni Lecture: Engineering Science',
    brief:
      'Module: Engineering Science (ELE). Help with the foundational science and design practice of electrical engineering — units and dimensional analysis, mechanics/energy/power basics, electric and magnetic fields, materials, signals and systems fundamentals, measurement and uncertainty, lab reports, and engineering problem-solving method. Link concepts to real engineering examples, check units, and help structure lab write-ups and calculations clearly.',
    starters: ['Explain this concept with a real example', 'Help me structure a lab report', 'Check my units and calculation'],
  },
];

export function uniModuleByKey(key: string): UniModule | undefined {
  return UNI_MODULES.find((m) => m.key === key);
}

export function uniModuleForLabel(label: string): UniModule | undefined {
  return UNI_MODULES.find((m) => label.startsWith(m.lectureLabelPrefix));
}
