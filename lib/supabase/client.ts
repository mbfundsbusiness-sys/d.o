import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type AnchorLog = {
  id: string;
  user_id: string;
  log_date: string;
  wake_time: string | null;
  applications_sent: number;
  trading_in_plan: boolean;
  note: string | null;
  created_at: string;
};

export type JobApplicationStatus =
  | 'researching'
  | 'applied'
  | 'phone_screen'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export type JobApplication = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  location: string | null;
  url: string | null;
  status: JobApplicationStatus;
  applied_date: string | null;
  follow_up_sent: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type AnchorLogInsert = {
  log_date?: string;
  wake_time?: string | null;
  applications_sent?: number;
  trading_in_plan?: boolean;
  note?: string | null;
};

export type JobApplicationInsert = {
  company: string;
  role: string;
  location?: string | null;
  url?: string | null;
  status?: JobApplicationStatus;
  applied_date?: string | null;
  follow_up_sent?: boolean;
  note?: string | null;
};

export type JobApplicationUpdate = {
  company?: string;
  role?: string;
  location?: string | null;
  url?: string | null;
  status?: JobApplicationStatus;
  applied_date?: string | null;
  follow_up_sent?: boolean;
  note?: string | null;
};

// --- Activity session types ---

export type ActivityKind = 'trading' | 'gym' | 'language' | 'job_search' | 'reading';

export type LanguageActivityType =
  | 'vocabulary'
  | 'grammar'
  | 'listening'
  | 'speaking'
  | 'reading';

export type TradingSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  in_plan: boolean;
  note: string | null;
  created_at: string;
};

export type GymSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  workout_type: string | null;
  note: string | null;
  created_at: string;
};

export type LanguageSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  language: string;
  activity_type: LanguageActivityType;
  note: string | null;
  created_at: string;
};

export type JobSearchSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  note: string | null;
  created_at: string;
};

export type ReadingSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  title: string | null;
  pages: number | null;
  note: string | null;
  created_at: string;
};

export type AssistantMessage = {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type SessionInsert = {
  started_at?: string;
  language?: string;
  activity_type?: LanguageActivityType;
  workout_type?: string;
  in_plan?: boolean;
  note?: string | null;
};

export type SessionUpdate = {
  ended_at?: string | null;
  duration_min?: number | null;
  in_plan?: boolean;
  workout_type?: string | null;
  note?: string | null;
  language?: string;
  activity_type?: LanguageActivityType;
};

export type AssistantMessageInsert = {
  role: 'user' | 'assistant';
  content: string;
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
};

export type LanguageTutorMessage = {
  id: string;
  user_id: string;
  module_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

// --- Finance types ---

export type FinanceType = 'in' | 'out';

export type FinanceEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  amount: number;
  type: FinanceType;
  category: string;
  note: string | null;
  ai_categorised: boolean;
  created_at: string;
};

// --- Prayer types ---

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type PrayerLog = {
  id: string;
  user_id: string;
  log_date: string;
  prayer_name: PrayerName;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

// --- BotCouncil types ---

export type BotCouncilCheckStatus = 'healthy' | 'issue';

export type BotCouncilCheck = {
  id: string;
  user_id: string;
  status: BotCouncilCheckStatus;
  note: string | null;
  checked_at: string;
  created_at: string;
};

export type BotCouncilTask = {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

// --- Gym module types ---

export type GymGoal = 'strength' | 'hypertrophy' | 'general_fitness' | 'endurance';
export type GymExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type GymEquipment = 'full_gym' | 'home_dumbbells' | 'bodyweight';

export type GymAssessment = {
  id: string;
  user_id: string;
  goal: GymGoal;
  experience_level: GymExperienceLevel;
  days_per_week: number;
  equipment: GymEquipment;
  injuries_notes: string | null;
  ai_summary: string | null;
  created_at: string;
};

export type GymExercise = {
  name: string;
  sets: number;
  reps: string;
  rest_sec?: number;
  notes?: string;
};

export type GymDayPlan = {
  day_label: string;
  focus: string;
  exercises: GymExercise[];
};

export type GymPlanContent = {
  intro?: string;
  days: GymDayPlan[];
  recovery_notes?: string;
};

export type GymPlan = {
  id: string;
  user_id: string;
  week_number: number;
  title: string;
  is_deload: boolean;
  content_json: GymPlanContent;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
};

export type GymCheckin = {
  id: string;
  user_id: string;
  week_number: number;
  soreness: number;
  sleep_quality: number;
  motivation: number;
  pain_flag: boolean;
  notes: string | null;
  created_at: string;
};

export type GymPR = {
  id: string;
  user_id: string;
  exercise: string;
  value: string;
  achieved_at: string;
  note: string | null;
  created_at: string;
};

// --- Reading module types ---

export type ReadingMaterialStatus = 'reading' | 'completed' | 'queued';

export type ReadingMaterial = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  status: ReadingMaterialStatus;
  total_pages: number | null;
  current_page: number;
  created_at: string;
  updated_at: string;
};

// --- Schedule + settings types ---

export type ScheduleActivityType = 'trading' | 'botcouncil' | 'reading' | 'custom';

export type ScheduleBlock = {
  id: string;
  user_id: string;
  day_of_week: number;
  activity_type: ScheduleActivityType;
  start_time: string;
  end_time: string;
  label: string;
  created_at: string;
  updated_at: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  timezone: string;
  jummah_time: string | null;
  jummah_duration_min: number;
  created_at: string;
  updated_at: string;
};

// --- Ghostwriter types ---

export type GhostwriterStyleLyrics = {
  id: string;
  user_id: string;
  title: string;
  lyrics_text: string;
  notes: string | null;
  created_at: string;
};

export type GhostwriterReference = {
  id: string;
  user_id: string;
  artist: string | null;
  track: string | null;
  description: string;
  created_at: string;
};

export type GhostwriterSongStatus = 'draft' | 'finished';

export type GhostwriterSong = {
  id: string;
  user_id: string;
  title: string;
  status: GhostwriterSongStatus;
  brief: string | null;
  lyrics_text: string;
  created_at: string;
  updated_at: string;
};

export type GhostwriterChatMessage = {
  id: string;
  user_id: string;
  song_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};
