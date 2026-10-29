// Row types for the tables the app reads and writes.

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

// --- Schedule + settings types ---

export type ScheduleActivityType =
  | 'trading'
  | 'botcouncil'
  | 'reading'
  | 'custom'
  | 'gym'
  | 'language'
  | 'course'
  | 'prayer';

export type ScheduleBlockSource = 'auto' | 'manual';

export type ScheduleBlock = {
  id: string;
  user_id: string;
  day_of_week: number;
  activity_type: ScheduleActivityType;
  start_time: string;
  end_time: string;
  label: string;
  source: ScheduleBlockSource;
  commitment_id: string | null;
  /** Soft-delete marker; archived blocks are ignored everywhere and can be restored. */
  archived_at?: string | null;
  archived_reason?: string | null;
  created_at: string;
  updated_at: string;
};

// --- Recurring commitments (universal scheduling source of truth) ---

export type RecurringCommitment = {
  id: string;
  user_id: string;
  activity_type: ScheduleActivityType;
  label: string;
  target_duration_min: number;
  applies_days: number[];
  preferred_start_time: string | null;
  priority: number;
  active: boolean;
  fixed: boolean;
  /** 'university' | 'work' | 'learning' | 'fitness' | ... (null on legacy rows; see lib/schedule/planner.ts categoryOf). */
  category?: string | null;
  /** Local (Europe/London) dates, inclusive. effective_until null = open-ended. */
  effective_from?: string | null;
  effective_until?: string | null;
  location?: string | null;
  created_at: string;
  updated_at: string;
};

export type PrayerTimes = Partial<Record<PrayerName, string>>;

export type UserSettings = {
  id: string;
  user_id: string;
  timezone: string;
  jummah_time: string | null;
  jummah_duration_min: number;
  prayer_times: PrayerTimes;
  hidden_modules: string[];
  employment_status: string;
  created_at: string;
  updated_at: string;
};

// --- To-do list ---

/** A dated, one-off work shift (DPD). Rotating rota, so not part of the weekly template. */
export type WorkShift = {
  id: string;
  user_id: string;
  shift_date: string; // YYYY-MM-DD (London)
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  title: string;
  note: string | null;
  /** What actually happened, logged after the shift. */
  actual_start: string | null;
  actual_end: string | null;
  drops: number | null;
  /** £ per drop for this shift; null = use rules.finance.per_drop_rate. */
  rate_per_drop: number | null;
  created_at: string;
  updated_at: string;
};

export type TodoItem = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  completed: boolean;
  completed_at: string | null;
  category: PlanKind;
  /** 1 = most important .. 5 = least. */
  priority: number;
  estimate_min: number | null;
  created_at: string;
};

export type PlanKind = 'exams' | 'coursework' | 'study' | 'trading' | 'botcouncil' | 'gym' | 'language' | 'task' | 'other';
export type PlanStatus = 'planned' | 'done' | 'skipped' | 'dropped';

/** One dated block the EA (or the user) lined up. */
export type PlanItem = {
  id: string;
  user_id: string;
  plan_date: string;
  start_time: string;
  end_time: string;
  title: string;
  kind: PlanKind;
  status: PlanStatus;
  source: 'ea' | 'user';
  todo_id: string | null;
  note: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssistantKey = 'ea' | 'finance' | 'scholarship' | 'freelance';

// --- Wishlist ---

export type WishlistPriority = 'low' | 'medium' | 'high';
export type WishlistStatus = 'active' | 'purchased';

export type WishlistItem = {
  id: string;
  user_id: string;
  title: string;
  url: string | null;
  target_cost: number | null;
  priority: WishlistPriority;
  notes: string | null;
  status: WishlistStatus;
  saved_amount: number;
  leftover_weight: number;
  purchased_at: string | null;
  created_at: string;
};

// --- Language tutor types ---

export type LanguageLevel = 'beginner' | 'some_knowledge' | 'conversational';
export type LearningStyle = 'vocabulary_heavy' | 'grammar_first' | 'conversation_first';

export type LanguageAssessment = {
  id: string;
  user_id: string;
  language: string;
  level: LanguageLevel;
  goal: string;
  style: LearningStyle;
  ai_summary: string | null;
  created_at: string;
};

export type ModuleFocusArea = 'vocabulary' | 'grammar' | 'listening' | 'speaking' | 'reading';

export type ModuleContent = {
  intro?: string;
  words?: { word: string; translation: string; example: string; example_translation: string }[];
  rule?: string;
  practice_sentences?: { prompt: string; answer: string };
  speaking_prompts?: string[];
  listening_prompt?: string;
  reading_text?: string;
  reading_questions?: { question: string; answer: string }[];
  tips?: string[];
};

export type LanguageModule = {
  id: string;
  user_id: string;
  language: string;
  module_number: number;
  title: string;
  focus_area: ModuleFocusArea;
  content_json: ModuleContent;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
  lesson_group_id: string | null;
};

// --- Language learning path (Phase 1 hierarchy) ---
// Course = language_assessments; Unit = LangUnit; Module = LangLessonGroup
// (a container of lessons within a unit); Lesson = LanguageModule (above).

export type LangUnit = {
  id: string;
  user_id: string;
  language: string;
  unit_number: number;
  title: string;
  description: string | null;
  created_at: string;
};

export type LangLessonGroup = {
  id: string;
  user_id: string;
  language: string;
  unit_id: string;
  group_number: number;
  title: string;
  description: string | null;
  created_at: string;
};

// --- Language lesson player (Phase 2) ---
// The full LangQuestion row (with correct_answer/acceptable_answers/
// explanation) only ever lives server-side. The client only ever sees a
// PlayableQuestion, returned by /api/language/generate-questions.

export type LangQuestionType = 'multiple_choice' | 'translation' | 'fill_blank';

export type PlayableQuestion = {
  id: string;
  question_type: LangQuestionType;
  prompt: string;
  options: string[] | null;
  hint: string | null;
  difficulty: number;
  order_index: number;
};

export type AnswerVerdict = {
  correct: boolean;
  minorError: boolean;
  correctAnswer: string;
  explanation: string | null;
  ability: number;
};

export type NextQuestionResponse = {
  question: PlayableQuestion | null;
  done: boolean;
  totalCount: number;
  answeredCount: number;
  correctCount?: number;
  ability: number;
};

// --- Mastery + spaced repetition (Phase 4) ---

export type LangConceptMastery = {
  id: string;
  user_id: string;
  lesson_id: string;
  mastery: number;
  successful_recalls: number;
  interval_days: number;
  last_reviewed_at: string;
  next_review_at: string;
  created_at: string;
  updated_at: string;
};

export type LanguageTutorMessage = {
  id: string;
  user_id: string;
  module_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

// --- Course module types (generic — cybersecurity or any other course) ---

export type CourseProfile = {
  id: string;
  user_id: string;
  course_name: string;
  syllabus: string | null;
  goal: string | null;
  ai_summary: string | null;
  created_at: string;
};

export type CourseModuleContent = {
  intro?: string;
  key_points?: string[];
  terms?: { term: string; definition: string }[];
  practice_questions?: { question: string; answer: string }[];
  lab_or_exercise?: string;
  resources?: string[];
};

export type CourseModule = {
  id: string;
  user_id: string;
  course_name: string;
  module_number: number;
  title: string;
  content_json: CourseModuleContent;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
};

export type CourseTutorMessage = {
  id: string;
  user_id: string;
  module_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type PaySettings = { user_id: string; payday_dom: number | null; expected_pay: number | null };
export type Bill = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  active: boolean;
  kind: 'bill' | 'subscription';
  cadence: 'weekly' | 'monthly' | 'yearly';
  due_dom: number | null;
};

export type PotItem = {
  id: string;
  user_id: string;
  pot_id: string;
  name: string;
  cost: number;
  purchased: boolean;
  purchased_at: string | null;
  sort: number;
};
