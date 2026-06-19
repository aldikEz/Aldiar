import type { CommandAction, LegalId, LegalPanel, OnboardingStepId, PlanItem, Question } from './types';

export const DEFAULT_ACTION = 'Make My Week Plan';
export const DEFAULT_NOTE = 'Pace protects the week around what usually breaks it: sleep, school, food, training, and recovery.';
export const DEFAULT_FOOD_KIND = 'Meal';

export const storageKeys = {
  action: 'pace.v6.action',
  activeSession: 'pace.v6.activeSession',
  cards: 'pace.v6.cards',
  chat: 'pace.v6.chat',
  coach: 'pace.v6.coach',
  coachNote: 'pace.v6.coachNote',
  food: 'pace.v6.food',
  note: 'pace.v6.note',
  nutrition: 'pace.v6.nutrition',
  plan: 'pace.v6.plan',
  profile: 'pace.v6.profile',
  reminders: 'pace.v6.reminders',
  selectedTier: 'pace.v6.selectedTier',
  trainingHistory: 'pace.v6.trainingHistory',
};

export const legacyStorageKeys = {
  action: 'pace.v5.action',
  activeSession: 'pace.v5.activeSession',
  coach: 'pace.v5.coach',
  coachNote: 'pace.v5.coachNote',
  food: 'pace.v5.food',
  note: 'pace.v5.note',
  plan: 'pace.v5.plan',
  profile: 'pace.v5.profile',
  trainingHistory: 'pace.v5.trainingHistory',
};

export const commands: CommandAction[] = [
  { label: 'Open Today', shortcut: 'Today' },
  { label: 'Make My Week Plan', shortcut: 'Plan W' },
  { label: 'Generate AI Week', shortcut: 'AI G' },
  { label: 'Start Training', shortcut: 'Train S' },
  { label: 'Log Food', shortcut: 'Food F' },
  { label: 'Ask Pace', shortcut: 'Ask' },
];

export const questions: Question[] = [
  {
    id: 'person',
    kind: 'single',
    label: 'Who is this for?',
    helper: 'Keep it simple. Pace can be for you, a coach, or someone helping you stay organized.',
    choices: ['Just me', 'Coach', 'Parent or helper', 'Other'],
  },
  {
    id: 'sport',
    kind: 'single',
    label: 'What are you training for?',
    helper: 'Pick the closest one. The exact sport can be written in Other.',
    choices: ['Boxing', 'Football', 'Running', 'Gym', 'Other'],
  },
  {
    id: 'goal',
    kind: 'single',
    label: 'What matters most this week?',
    helper: 'This helps Pace protect the most important part of the week.',
    choices: ['Balance school', 'Build strength', 'Make weight', 'Prepare competition', 'Other'],
  },
  {
    id: 'trainingDays',
    kind: 'single',
    label: 'How many training days?',
    helper: 'Rounded choices keep planning fast.',
    choices: ['2-3 days', '4-5 days', '6+ days', 'Other'],
  },
  {
    id: 'foodGoal',
    kind: 'single',
    label: 'Any food or weight goal?',
    helper: 'No pressure. This only shapes the plan if you want it to.',
    choices: ['Not now', 'Maintain energy', 'Gain weight', 'Lose weight', 'Other'],
  },
];

export const startSteps: OnboardingStepId[] = [
  'name',
  'role',
  'metrics',
  'sports',
  'goals',
  'schedule',
  'nutrition',
  'preferences',
  'plan',
  'generating',
];

export const onboardingQuestions: Record<Exclude<OnboardingStepId, 'metrics' | 'plan' | 'generating'>, Question> = {
  name: {
    id: 'displayName',
    kind: 'text',
    label: 'What should Pace call you?',
    helper: 'Your first name is enough. This makes the plan feel like yours without making setup heavy.',
    choices: [],
  },
  role: {
    id: 'person',
    kind: 'single',
    label: 'Choose your path.',
    helper: 'Most people use Pace for themselves. Coach mode is only there if you actually manage other people.',
    choices: ['Student athlete', 'Athlete', 'Training for myself', 'Coach', 'Parent or helper'],
  },
  sports: {
    id: 'sportOptions',
    kind: 'multi',
    label: 'What are you training for?',
    helper: 'Choose all that fit. If your sport is not here, add it with Other.',
    choices: [
      'Basketball',
      'Football',
      'Soccer',
      'Track',
      'Distance running',
      'Wrestling',
      'Boxing',
      'MMA',
      'Swimming',
      'Volleyball',
      'Baseball',
      'Tennis',
      'Gym strength',
      'General fitness',
      'Other',
    ],
  },
  goals: {
    id: 'goals',
    kind: 'multi',
    label: 'What should this plan help with?',
    helper: 'Pick the goals that would make the next week feel more under control.',
    choices: [
      'Balance school and training',
      'Build strength',
      'Improve conditioning',
      'Get faster',
      'Improve skill work',
      'Prepare for competition',
      'Keep food steady',
      'Gain weight slowly',
      'Lose weight safely',
      'Recover better',
      'Fix my sleep routine',
      'Stay consistent',
      'Other',
    ],
  },
  schedule: {
    id: 'trainingDays',
    kind: 'single',
    label: 'What does your week usually look like?',
    helper: 'A rough rhythm is enough. Pace will keep it realistic instead of perfect.',
    choices: ['2-3 training days', '4-5 training days', '6+ training days', 'Changes every week'],
  },
  nutrition: {
    id: 'foodGoal',
    kind: 'single',
    label: 'How should food tracking work?',
    helper: 'Macros are optional. Pace can track food calmly without turning every meal into math.',
    choices: ['Simple meals only', 'Optional macros', 'Gain weight support', 'Lose weight safely', 'Better meal timing', 'Not now'],
  },
  preferences: {
    id: 'reminderPreference',
    kind: 'multi',
    label: 'What should Pace protect for you?',
    helper: 'This is the part that makes the plan personal. Pace will build around the things that usually break the week.',
    choices: [
      'Training',
      'Homework',
      'Food timing',
      'Water',
      'Sleep',
      'Stretching',
      'Competition prep',
      'Coach check-ins',
      'None yet',
    ],
  },
};

export const defaultPlan: PlanItem[] = [
  { time: 'Anchor', title: 'Choose the protected thing', detail: 'Pick the one thing that would make today a win even if the day gets messy.', tone: 'study' },
  { time: 'Fuel', title: 'Make food easy to repeat', detail: 'Use one reliable meal or snack before training instead of inventing a new plan every day.', tone: 'food' },
  { time: 'Train', title: 'One clear training target', detail: 'Start the session with the one quality you are protecting: speed, strength, skill, or consistency.', tone: 'training' },
  { time: 'Recover', title: 'Close the loop', detail: 'Do the smallest recovery reset that makes tomorrow easier: stretch, shower, pack, or sleep setup.', tone: 'recovery' },
];

export const defaultReminders = [
  { id: 'r-1', time: '07:30', title: 'Start simple', detail: 'Water, breakfast, and one clear priority.', done: false, tone: 'food' },
  { id: 'r-2', time: '16:30', title: 'Training block', detail: 'Open the prepared session and keep the focus narrow.', done: false, tone: 'training' },
  { id: 'r-3', time: '20:30', title: 'Close the day', detail: 'Homework check, stretch, and set tomorrow up.', done: false, tone: 'study' },
] as const;

export const defaultCards = [
  { id: 'c-1', label: 'Pace Loop', title: 'Protect one thing', detail: 'The plan starts with the pressure point that usually breaks the week.', tone: 'study' },
  { id: 'c-2', label: 'Fuel', title: 'Repeatable food', detail: 'Meals and water tracked without pressure or shame math.', tone: 'food' },
  { id: 'c-3', label: 'Training', title: 'Quality over noise', detail: 'A session with one focus, one adjustment, and one finish line.', tone: 'training' },
] as const;

export const defaultNutrition = {
  mode: 'simple',
  hydration: 'Water with breakfast and after training.',
  note: 'Food tracking is optional. Start with meals, snacks, and timing.',
} as const;

export const hooks = ['Built around your real week', 'Sleep-aware without shame', 'A plan that adjusts'];
export const foodKinds = ['Meal', 'Snack', 'Water', 'Other'];

export const steps = [
  ['Tell Pace what breaks the week', 'Sleep, school load, food timing, travel, pressure, and training rhythm shape the plan.'],
  ['Get a Pace Loop', 'One protected priority, one adjustment rule, one training focus, and one recovery close.'],
  ['Use it every day', 'Log food, start training, ask for tweaks, and keep the plan grounded in your real life.'],
];

export const highlights = [
  ['The week has a pressure point', 'Pace asks what usually breaks the plan, then builds around that instead of pretending every week is perfect.'],
  ['Food goals without making it weird', 'Log meals, snacks, water, or a simple note. Calories can come later, but pressure does not need to.'],
  ['Training you can start', 'Pace turns the plan into a simple session with sets, targets, progress, and history.'],
];

export const PLAN_CTA = 'Start now';

export const tiers = [
  ['Always FREE', '$0', 'For getting organized without a paywall.', ['Weekly plan', 'Food and training log', 'Ask Pace basics']],
  ['Weekly', '$3', 'For one clear week at a time.', ['3-day free trial', 'Weekly plan', 'Food and training log']],
  ['Monthly', '$9', 'For steady progress without thinking too much.', ['3-day free trial', 'Weekly and monthly plans', 'Progress history']],
  ['Coach', '$19', 'For coaches who want people and plans in one place.', ['3-day free trial', 'Add people', 'Weekly and monthly view']],
] as const;

export const legalPanels: Record<LegalId, LegalPanel> = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This preview explains how Pace AI is designed to handle personal planning data with care before real accounts are connected.',
    updated: 'June 19, 2026',
    items: [
      ['Demo data', 'This demo stores setup choices, food entries, training sessions, coach people, last action, and plan notes in this browser only. It does not create an account or sell personal data.'],
      ['AI requests', 'When AI is configured, Pace sends the planning prompt to the Supabase Edge Function. The Gemini key stays server-side and is not exposed in the browser.'],
      ['Minors', 'Pace AI is not intended to collect personal information from children under 13 without verifiable parent consent.'],
      ['User control', 'A production app should provide ways to access, correct, export, and delete account data. In this demo, the Privacy Policy sheet clears browser-only data.'],
    ],
  },
  terms: {
    title: 'User Terms Agreement',
    intro: 'These terms preview the product boundaries for Pace AI while the site is still a front-end demo.',
    updated: 'June 19, 2026',
    items: [
      ['Concept status', 'This site is a polished front-end demo. Features, pricing, trials, coach mode, and AI summaries are previews until connected to production systems.'],
      ['No guaranteed results', 'Pace AI cannot guarantee fitness, school, nutrition, recovery, or competition outcomes. Users remain responsible for decisions and real-world actions.'],
      ['Not professional advice', 'Pace AI does not replace doctors, dietitians, coaches, schools, parents, or emergency services.'],
      ['Acceptable use', 'Do not use the service to pressure, shame, harass, or surveil another person.'],
    ],
  },
};
