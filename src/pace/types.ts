export type Tone = 'training' | 'study' | 'recovery' | 'food';
export type PlanTier = 'Always FREE' | 'Weekly' | 'Monthly' | 'Coach';
export type OnboardingStepId =
  | 'name'
  | 'role'
  | 'metrics'
  | 'sports'
  | 'goals'
  | 'schedule'
  | 'nutrition'
  | 'preferences'
  | 'plan'
  | 'generating';

export type CommandAction = {
  label: string;
  shortcut: string;
};

export type PlanItem = {
  time: string;
  title: string;
  detail: string;
  tone: Tone;
};

export type Reminder = {
  id: string;
  time: string;
  title: string;
  detail: string;
  done: boolean;
  tone: Tone;
};

export type DashboardCard = {
  id: string;
  label: string;
  title: string;
  detail: string;
  tone: Tone;
};

export type NutritionTarget = {
  mode: 'optional-macros' | 'simple';
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  hydration: string;
  note: string;
};

export type FoodEntry = {
  calories?: number;
  carbs?: number;
  fats?: number;
  id: string;
  label: string;
  kind: string;
  protein?: number;
  createdAt: string;
};

export type CoachPerson = {
  id: string;
  name: string;
  focus: string;
};

export type Profile = {
  ageRange?: string;
  blockers?: string[];
  coachShare?: string;
  displayName?: string;
  foodPreference?: string;
  goals?: string[];
  height?: string;
  metricsUnit?: string;
  person: string;
  planTier?: PlanTier;
  position?: string;
  supportStyle?: string;
  reminderPreference?: string;
  schoolLoad?: string;
  sleepRange?: string;
  sportOptions?: string[];
  sport: string;
  goal: string;
  scheduleNotes?: string;
  trainingDays: string;
  foodGoal: string;
  weight?: string;
  createdAt: string;
};

export type QuestionKind = 'single' | 'multi' | 'metric' | 'text' | 'planChoice';

export type Question = {
  id: string;
  kind: QuestionKind;
  label: string;
  helper: string;
  maxSelections?: number;
  optional?: boolean;
  choices: string[];
};

export type LegalId = 'privacy' | 'terms';

export type LegalPanel = {
  title: string;
  intro: string;
  updated: string;
  items: [string, string][];
};

export type AuthMode = 'signup' | 'login';

export type AuthIntent =
  | 'trial'
  | 'planner'
  | 'log-today'
  | 'food'
  | 'copy-plan'
  | 'training'
  | 'ai-week'
  | 'coach'
  | 'weekly-plan'
  | 'monthly-plan'
  | 'coach-plan'
  | 'profile';

export type TrainingExercise = {
  id: string;
  name: string;
  sets: number;
  target: string;
  done: number;
};

export type TrainingSession = {
  id: string;
  title: string;
  focus: string;
  startedAt: string;
  completedAt?: string;
  exercises: TrainingExercise[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
};

export type AiPlanResult = {
  cards: DashboardCard[];
  note: string;
  nutrition: NutritionTarget;
  plan: PlanItem[];
  reminders: Reminder[];
  session: TrainingSession;
  source: 'ai' | 'fallback';
};

export type AiChatResult = {
  blocked?: boolean;
  reply: string;
  source: 'ai' | 'fallback' | 'blocked';
  suggestedPlan?: PlanItem[];
};
