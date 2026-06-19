import { defaultCards, defaultNutrition, defaultPlan, defaultReminders } from './content';
import type {
  AiChatResult,
  AiPlanResult,
  DashboardCard,
  FoodEntry,
  NutritionTarget,
  PlanItem,
  Profile,
  Reminder,
  TrainingExercise,
  TrainingSession,
} from './types';

export function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export function profileSummary(profile: Profile | null) {
  if (!profile) {
    return 'No saved setup yet';
  }

  const name = profile.displayName ? `${profile.displayName}: ` : '';
  const metrics = [profile.height, profile.weight].filter(Boolean).join(', ');
  const goals = profile.goals?.length ? profile.goals.join(', ') : profile.goal;

  return `${name}${goals} for ${profile.sport}. ${profile.trainingDays}. Food focus: ${profile.foodGoal}.${
    metrics ? ` Basics saved: ${metrics}.` : ''
  }`;
}

function hasTightSleep(profile: Profile | null) {
  return Boolean(profile?.sleepRange?.includes('Under 6') || profile?.sleepRange?.includes('6-7'));
}

function firstBlocker(profile: Profile | null) {
  return profile?.blockers?.[0] ?? (hasTightSleep(profile) ? 'Sleep gets pushed back' : 'The week gets busy');
}

function supportLine(profile: Profile | null) {
  if (profile?.supportStyle === 'Push me a little') {
    return 'Pace will push one clear action, then back off.';
  }

  if (profile?.supportStyle === 'Make it very direct') {
    return 'Pace will be direct: choose the next step and do it.';
  }

  return 'Pace will keep it calm and specific.';
}

export function makePlan(profile: Profile | null): PlanItem[] {
  if (!profile) {
    return defaultPlan;
  }

  const mainGoal = profile.goals?.[0] ?? profile.goal;
  const blocker = firstBlocker(profile);
  const tightSleep = hasTightSleep(profile);
  const weekContext = profile.scheduleNotes?.trim();
  const goal =
    mainGoal === 'Lose weight safely'
      ? 'Keep food steady and avoid last-minute changes.'
      : mainGoal === 'Prepare competition'
        ? 'Protect sleep, timing, and calm repetition.'
        : mainGoal === 'Build strength'
          ? 'Train hard on the right days and leave space to recover.'
          : 'Keep school, training, and recovery in the same week.';

  const food =
    profile.foodGoal === 'Not now'
      ? 'Simple meals and water. No tracking pressure today.'
      : `${profile.foodGoal} focus with meals that fit your day.`;

  return [
    {
      time: 'Protect',
      title: mainGoal,
      detail: `This week is built around ${blocker.toLowerCase()}.${weekContext ? ` Week note: ${weekContext}.` : ''} ${goal} ${supportLine(profile)}`,
      tone: 'study',
    },
    {
      time: 'Adjust',
      title: tightSleep ? 'Sleep-aware day' : 'Friction rule',
      detail: tightSleep
        ? 'If sleep is short, keep the session technical or moderate and move the hard push to the next better day.'
        : `If ${blocker.toLowerCase()} shows up, shrink the plan to one training target and one school/recovery closeout.`,
      tone: 'recovery',
    },
    { time: 'Train', title: profile.sport, detail: `${profile.trainingDays}. One focus for the session: ${mainGoal}.`, tone: 'training' },
    { time: 'Fuel', title: 'Food anchor', detail: food, tone: 'food' },
    {
      time: 'Study',
      title: profile.schoolLoad ? `${profile.schoolLoad} school load` : 'Protected school block',
      detail: 'Pick one homework block before the night gets crowded. The goal is less mental noise, not perfection.',
      tone: 'study',
    },
    {
      time: 'Close',
      title: tightSleep ? 'Sleep setup' : 'Recovery close',
      detail: tightSleep
        ? "Let's fix sleep by making tonight easier: pack tomorrow, dim the phone, and choose the first morning step before bed."
        : 'Stretch, shower, pack, or write tomorrow’s first step. Close the loop so the next day starts lighter.',
      tone: 'recovery',
    },
  ];
}

export function makeTrainingSession(profile: Profile | null, plan: PlanItem[]): TrainingSession {
  const sport = profile?.sport ?? 'Training';
  const goal = profile?.goals?.[0] ?? profile?.goal ?? 'Build consistency';
  const isStrength = goal === 'Build strength' || sport === 'Gym';
  const isCompetition = goal === 'Prepare competition';

  const exercises: TrainingExercise[] = isStrength
    ? [
        { id: makeId(), name: 'Warm-up circuit', sets: 2, target: '5 minutes easy', done: 0 },
        { id: makeId(), name: 'Main strength work', sets: 4, target: 'Controlled reps', done: 0 },
        { id: makeId(), name: 'Accessory block', sets: 3, target: 'Smooth form', done: 0 },
        { id: makeId(), name: 'Cooldown stretch', sets: 1, target: '6 minutes', done: 0 },
      ]
    : [
        { id: makeId(), name: `${sport} warm-up`, sets: 2, target: 'Easy pace', done: 0 },
        { id: makeId(), name: isCompetition ? 'Competition rhythm' : 'Main training block', sets: 4, target: 'Quality reps', done: 0 },
        { id: makeId(), name: 'Skill focus', sets: 3, target: plan[0]?.detail ?? 'One clear focus', done: 0 },
        { id: makeId(), name: 'Reset', sets: 1, target: 'Breathing and stretch', done: 0 },
      ];

  return {
    id: makeId(),
    title: `${sport} session`,
    focus: goal,
    startedAt: new Date().toISOString(),
    exercises,
  };
}

export function makeReminders(profile: Profile | null): Reminder[] {
  if (!profile) {
    return defaultReminders.map((item) => ({ ...item }));
  }

  const wantsFood = profile.foodGoal !== 'Not now';
  const wantsCoach = profile.reminderPreference?.includes('Coach') || profile.person === 'Coach';
  const tightSleep = hasTightSleep(profile);

  return [
    {
      id: makeId(),
      time: '07:30',
      title: 'Start steady',
      detail: wantsFood ? 'Breakfast, water, and the food focus for today.' : 'Water, breakfast, and one calm priority.',
      done: false,
      tone: 'food',
    },
    {
      id: makeId(),
      time: tightSleep ? '15:45' : '16:30',
      title: tightSleep ? 'Check sleep before training' : `${profile.sport} focus`,
      detail: tightSleep
        ? 'If you feel flat, make today about skill quality and leave the all-out push for a better sleep day.'
        : `${profile.trainingDays}. Keep one training target visible.`,
      done: false,
      tone: 'training',
    },
    {
      id: makeId(),
      time: wantsCoach ? '19:30' : '20:30',
      title: wantsCoach ? 'Coach check-in' : tightSleep ? 'Sleep cue' : 'Close the day',
      detail: wantsCoach
        ? 'Send the short update: plan, progress, next focus.'
        : tightSleep
          ? "Let's fix the night gently: pack tomorrow, dim the phone, and choose one first step for morning."
          : 'Homework block, stretch, and set tomorrow up.',
      done: false,
      tone: 'study',
    },
  ];
}

export function makeDashboardCards(profile: Profile | null): DashboardCard[] {
  if (!profile) {
    return defaultCards.map((item) => ({ ...item }));
  }

  const blocker = firstBlocker(profile);
  const tightSleep = hasTightSleep(profile);

  return [
    {
      id: makeId(),
      label: 'Pace Loop',
      title: `Protect: ${profile.goals?.[0] ?? profile.goal}`,
      detail: `Built around the thing that usually breaks the week: ${blocker}.`,
      tone: 'study',
    },
    {
      id: makeId(),
      label: 'Adjustment rule',
      title: tightSleep ? 'Sleep-aware training' : 'Shrink, do not quit',
      detail: tightSleep
        ? 'Short sleep changes intensity, not your identity. Keep quality and protect tomorrow.'
        : `When ${blocker.toLowerCase()} happens, Pace gives you the smaller version of the day.`,
      tone: 'recovery',
    },
    {
      id: makeId(),
      label: 'Fuel',
      title: profile.foodGoal === 'Not now' ? 'Simple repeatable food' : profile.foodGoal,
      detail: profile.foodGoal === 'Optional macros' ? 'Macros are optional; repeatable meals matter first.' : 'Track what makes training easier, not what makes you feel judged.',
      tone: 'food',
    },
  ];
}

export function makeNutrition(profile: Profile | null): NutritionTarget {
  if (!profile || profile.foodGoal !== 'Optional macros') {
    return { ...defaultNutrition };
  }

  return {
    mode: 'optional-macros',
    calories: 2400,
    protein: 150,
    carbs: 280,
    fats: 70,
    hydration: 'Water with breakfast, after training, and before bed.',
    note: 'These are gentle demo targets. Adjust with a qualified professional for real nutrition needs.',
  };
}

export function prepareSessionForStart(session: TrainingSession): TrainingSession {
  return {
    ...session,
    id: makeId(),
    startedAt: new Date().toISOString(),
    completedAt: undefined,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      id: makeId(),
      done: 0,
    })),
  };
}

export function foodSummary(entries: FoodEntry[]) {
  if (entries.length === 0) {
    return 'No food logged yet. Optional and pressure-free.';
  }

  return entries
    .slice(-2)
    .map((entry) => `${entry.kind}: ${entry.label}`)
    .join(' + ');
}

export function sessionProgress(session: TrainingSession | null) {
  if (!session) {
    return { done: 0, total: 0, percent: 0 };
  }

  const total = session.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const done = session.exercises.reduce((sum, exercise) => sum + exercise.done, 0);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

export function formatPlanForClipboard(plan: PlanItem[], note: string, session: TrainingSession | null) {
  const lines = [`Pace AI week`, note, ...plan.map((item) => `${item.time}: ${item.title} - ${item.detail}`)];

  if (session) {
    lines.push('', `Training: ${session.title}`, ...session.exercises.map((item) => `${item.name}: ${item.sets} sets - ${item.target}`));
  }

  return lines.join('\n');
}

export function makeFallbackAiPlan(profile: Profile | null, foodEntries: FoodEntry[]): AiPlanResult {
  const plan = makePlan(profile);
  const session = makeTrainingSession(profile, plan);
  const foodLine = foodEntries.length > 0 ? ` Recent food log: ${foodSummary(foodEntries)}.` : '';

  return {
    cards: makeDashboardCards(profile),
    source: 'fallback',
    note: `${profile?.displayName ? `${profile.displayName}, ` : ''}${
      profile?.goals?.[0] ?? profile?.goal ?? 'Simple'
    } week generated locally. Pace is using your blocker, sleep, school load, food focus, and support style to build the loop.${foodLine}`,
    nutrition: makeNutrition(profile),
    plan,
    reminders: makeReminders(profile),
    session,
  };
}

export function buildAiPrompt(profile: Profile | null, foodEntries: FoodEntry[]) {
  const safeProfile = profile
    ? {
        displayName: profile.displayName,
        sport: profile.sport,
        goal: profile.goal,
        goals: profile.goals,
        blockers: profile.blockers,
        trainingDays: profile.trainingDays,
        foodGoal: profile.foodGoal,
        foodPreference: profile.foodPreference,
        person: profile.person,
        planTier: profile.planTier,
        position: profile.position,
        reminderPreference: profile.reminderPreference,
        schoolLoad: profile.schoolLoad,
        sleepRange: profile.sleepRange,
        sportOptions: profile.sportOptions,
        supportStyle: profile.supportStyle,
        scheduleNotes: profile.scheduleNotes,
        height: profile.height,
        weight: profile.weight,
      }
    : {
        displayName: '',
        sport: 'general training',
        goal: 'balance training and school',
        goals: ['balance training and school'],
        blockers: ['The week gets busy'],
        trainingDays: '2-3 days',
        foodGoal: 'Not now',
        foodPreference: 'Simple meals only',
        person: 'Just me',
        planTier: 'Always FREE',
        position: '',
        reminderPreference: 'Training',
        schoolLoad: '',
        sleepRange: '',
        sportOptions: ['general training'],
        supportStyle: 'Keep it calm',
        scheduleNotes: '',
        height: '',
        weight: '',
      };

  return JSON.stringify({
    mode: 'plan',
    instruction:
      'Create a very personalized Pace AI dashboard plan called a Pace Loop. This is not a generic weekly schedule. Use blockers, schedule notes, sleep, school load, sport, food style, support style, and goals to build a plan that feels like it understands this person. Do not give medical advice. Avoid shame, body judgment, unsafe food restriction, rapid weight loss, dehydration, steroids, or injury advice. Height and weight are context only, never scores. Keep it teen-friendly, practical, and specific. Return JSON only.',
    detailLevel:
      'Return 5-7 plan items, 3-5 reminders, 3 dashboard cards, optional nutrition guidance, and one training session. The first plan item must be the protected priority. The second must be an if-then adjustment rule for the main blocker or sleep. Make each item actionable, not generic.',
    schema: {
      note: 'one supportive sentence that names the person if available and explains what the loop protects',
      cards: [{ label: 'short label', title: 'short title', detail: 'one sentence', tone: 'training|study|recovery|food' }],
      plan: [
        {
          time: 'short label or time',
          title: 'short title',
          detail: 'specific 1-2 sentence instruction for this person',
          tone: 'training|study|recovery|food',
        },
      ],
      reminders: [{ time: 'short time', title: 'short title', detail: 'one sentence', tone: 'training|study|recovery|food' }],
      nutrition: {
        mode: 'optional-macros|simple',
        calories: 'number only when optional macros are useful',
        protein: 'number only when optional macros are useful',
        carbs: 'number only when optional macros are useful',
        fats: 'number only when optional macros are useful',
        hydration: 'one practical hydration note',
        note: 'one calm nutrition note',
      },
      session: {
        title: 'training session title',
        focus: 'main goal',
        exercises: [{ name: 'exercise/block name', sets: 1, target: 'clear target with intensity, duration, or quality cue' }],
      },
    },
    profile: safeProfile,
    recentFood: foodEntries.slice(-4).map((entry) => ({ kind: entry.kind, label: entry.label })),
  });
}

export function buildChatPrompt(profile: Profile | null, plan: PlanItem[], question: string) {
  return JSON.stringify({
    mode: 'chat',
    instruction:
      'Answer as Pace AI. Help the user understand or safely tweak their Pace Loop. Use their blockers, sleep, school load, support style, and current plan. Do not give medical advice, unsafe weight cutting, illegal, hateful, harassment, steroid, or self-harm guidance. Keep the answer supportive, specific, and short. Return JSON only.',
    schema: {
      reply: 'short helpful answer',
      suggestedPlan: [{ time: 'optional', title: 'optional', detail: 'optional', tone: 'training|study|recovery|food' }],
    },
    profile,
    currentPlan: plan,
    question,
  });
}

export function normalizeAiText(text: string, fallback: AiPlanResult): AiPlanResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const rawJson = jsonMatch?.[0] ?? text;

  try {
    const parsed = JSON.parse(rawJson) as {
      cards?: Array<Partial<DashboardCard>>;
      note?: unknown;
      nutrition?: Partial<NutritionTarget>;
      plan?: Array<Partial<PlanItem>>;
      reminders?: Array<Partial<Reminder>>;
      session?: {
        title?: unknown;
        focus?: unknown;
        exercises?: Array<{ name?: unknown; sets?: unknown; target?: unknown }>;
      };
    };

    const plan =
      Array.isArray(parsed.plan) && parsed.plan.length > 0
        ? parsed.plan.slice(0, 7).map((item, index) => ({
            time: typeof item.time === 'string' && item.time.trim() ? item.time.trim() : `Step ${index + 1}`,
            title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : fallback.plan[index]?.title ?? 'Plan',
            detail:
              typeof item.detail === 'string' && item.detail.trim()
                ? item.detail.trim()
                : fallback.plan[index]?.detail ?? 'Keep this step simple.',
            tone: item.tone === 'training' || item.tone === 'study' || item.tone === 'recovery' || item.tone === 'food' ? item.tone : 'training',
          }))
        : fallback.plan;

    const cards =
      Array.isArray(parsed.cards) && parsed.cards.length > 0
        ? parsed.cards.slice(0, 5).map((item, index) => ({
            id: makeId(),
            label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : fallback.cards[index]?.label ?? 'Today',
            title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : fallback.cards[index]?.title ?? 'Plan',
            detail:
              typeof item.detail === 'string' && item.detail.trim()
                ? item.detail.trim()
                : fallback.cards[index]?.detail ?? 'Keep the next step simple.',
            tone: item.tone === 'training' || item.tone === 'study' || item.tone === 'recovery' || item.tone === 'food' ? item.tone : 'training',
          }))
        : fallback.cards;

    const reminders =
      Array.isArray(parsed.reminders) && parsed.reminders.length > 0
        ? parsed.reminders.slice(0, 5).map((item, index) => ({
            id: makeId(),
            time: typeof item.time === 'string' && item.time.trim() ? item.time.trim() : fallback.reminders[index]?.time ?? 'Today',
            title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : fallback.reminders[index]?.title ?? 'Reminder',
            detail:
              typeof item.detail === 'string' && item.detail.trim()
                ? item.detail.trim()
                : fallback.reminders[index]?.detail ?? 'One small step.',
            done: false,
            tone: item.tone === 'training' || item.tone === 'study' || item.tone === 'recovery' || item.tone === 'food' ? item.tone : 'study',
          }))
        : fallback.reminders;

    const nutrition: NutritionTarget = {
      mode: parsed.nutrition?.mode === 'optional-macros' ? 'optional-macros' : fallback.nutrition.mode,
      calories: typeof parsed.nutrition?.calories === 'number' ? parsed.nutrition.calories : fallback.nutrition.calories,
      protein: typeof parsed.nutrition?.protein === 'number' ? parsed.nutrition.protein : fallback.nutrition.protein,
      carbs: typeof parsed.nutrition?.carbs === 'number' ? parsed.nutrition.carbs : fallback.nutrition.carbs,
      fats: typeof parsed.nutrition?.fats === 'number' ? parsed.nutrition.fats : fallback.nutrition.fats,
      hydration:
        typeof parsed.nutrition?.hydration === 'string' && parsed.nutrition.hydration.trim()
          ? parsed.nutrition.hydration.trim()
          : fallback.nutrition.hydration,
      note:
        typeof parsed.nutrition?.note === 'string' && parsed.nutrition.note.trim()
          ? parsed.nutrition.note.trim()
          : fallback.nutrition.note,
    };

    const exercises =
      Array.isArray(parsed.session?.exercises) && parsed.session.exercises.length > 0
        ? parsed.session.exercises.slice(0, 7).map((exercise) => ({
            id: makeId(),
            name: typeof exercise.name === 'string' && exercise.name.trim() ? exercise.name.trim() : 'Training block',
            sets: typeof exercise.sets === 'number' && exercise.sets > 0 ? Math.min(Math.round(exercise.sets), 6) : 3,
            target: typeof exercise.target === 'string' && exercise.target.trim() ? exercise.target.trim() : 'Quality reps',
            done: 0,
          }))
        : fallback.session.exercises;

    return {
      cards,
      source: 'ai',
      note: typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : fallback.note,
      nutrition,
      plan,
      reminders,
      session: {
        id: makeId(),
        title:
          typeof parsed.session?.title === 'string' && parsed.session.title.trim()
            ? parsed.session.title.trim()
            : fallback.session.title,
        focus:
          typeof parsed.session?.focus === 'string' && parsed.session.focus.trim()
            ? parsed.session.focus.trim()
            : fallback.session.focus,
        startedAt: new Date().toISOString(),
        exercises,
      },
    };
  } catch {
    return fallback;
  }
}

export function normalizeChatText(text: string, fallbackReply: string): AiChatResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const rawJson = jsonMatch?.[0] ?? text;

  try {
    const parsed = JSON.parse(rawJson) as {
      reply?: unknown;
      suggestedPlan?: Array<Partial<PlanItem>>;
    };

    return {
      source: 'ai',
      reply: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : fallbackReply,
      suggestedPlan: Array.isArray(parsed.suggestedPlan)
        ? parsed.suggestedPlan.slice(0, 3).map((item, index) => ({
            time: typeof item.time === 'string' && item.time.trim() ? item.time.trim() : `Tweak ${index + 1}`,
            title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'Plan tweak',
            detail: typeof item.detail === 'string' && item.detail.trim() ? item.detail.trim() : fallbackReply,
            tone: item.tone === 'training' || item.tone === 'study' || item.tone === 'recovery' || item.tone === 'food' ? item.tone : 'training',
          }))
        : undefined,
    };
  } catch {
    return { source: 'fallback', reply: fallbackReply };
  }
}
