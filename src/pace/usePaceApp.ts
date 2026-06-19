import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_ACTION,
  DEFAULT_FOOD_KIND,
  DEFAULT_NOTE,
  defaultCards,
  defaultNutrition,
  defaultReminders,
  legacyStorageKeys,
  storageKeys,
} from './content';
import { askPaceWithAi, generateWeekWithAi } from './ai';
import {
  foodSummary,
  formatPlanForClipboard,
  makeDashboardCards,
  makeId,
  makeNutrition,
  makePlan,
  makeReminders,
  makeTrainingSession,
  prepareSessionForStart,
  profileSummary,
  sessionProgress,
} from './planning';
import { getSafetyBlockReason } from './safety';
import { readBoolean, readJson, readText, writeBoolean, writeJson, writeText } from './storage';
import type {
  ChatMessage,
  CoachPerson,
  DashboardCard,
  FoodEntry,
  NutritionTarget,
  PlanItem,
  PlanTier,
  Profile,
  Reminder,
  TrainingSession,
} from './types';

export type AiStatus = {
  state: 'idle' | 'loading' | 'ready' | 'fallback' | 'blocked';
  message: string;
};

export type ProfileAnswers = Partial<Profile> &
  Pick<Profile, 'foodGoal' | 'goal' | 'person' | 'sport' | 'trainingDays'>;

function readJsonWithLegacy<T>(key: string, legacyKey: string, fallback: T) {
  return readJson(key, readJson(legacyKey, fallback));
}

function readTextWithLegacy(key: string, legacyKey: string, fallback: string) {
  return readText(key, readText(legacyKey, fallback));
}

function isUnder13(profile: Profile | null) {
  return profile?.ageRange === 'Under 13';
}

export function usePaceApp() {
  const [action, setAction] = useState(() => readTextWithLegacy(storageKeys.action, legacyStorageKeys.action, DEFAULT_ACTION));
  const [note, setNote] = useState(() => readTextWithLegacy(storageKeys.note, legacyStorageKeys.note, DEFAULT_NOTE));
  const [profile, setProfile] = useState<Profile | null>(() =>
    readJsonWithLegacy(storageKeys.profile, legacyStorageKeys.profile, null),
  );
  const [plan, setPlan] = useState<PlanItem[]>(() =>
    readJsonWithLegacy(storageKeys.plan, legacyStorageKeys.plan, makePlan(null)),
  );
  const [cards, setCards] = useState<DashboardCard[]>(() => readJson(storageKeys.cards, [...defaultCards]));
  const [reminders, setReminders] = useState<Reminder[]>(() => readJson(storageKeys.reminders, [...defaultReminders]));
  const [nutrition, setNutrition] = useState<NutritionTarget>(() => readJson(storageKeys.nutrition, { ...defaultNutrition }));
  const [selectedTier, setSelectedTier] = useState<PlanTier>(() => readText(storageKeys.selectedTier, 'Always FREE') as PlanTier);
  const [coachPeople, setCoachPeople] = useState<CoachPerson[]>(() =>
    readJsonWithLegacy(storageKeys.coach, legacyStorageKeys.coach, []),
  );
  const [coachPinned, setCoachPinned] = useState(() =>
    readBoolean(storageKeys.coachNote, readBoolean(legacyStorageKeys.coachNote, false)),
  );
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>(() =>
    readJsonWithLegacy(storageKeys.food, legacyStorageKeys.food, []),
  );
  const [activeSession, setActiveSession] = useState<TrainingSession | null>(() =>
    readJsonWithLegacy(storageKeys.activeSession, legacyStorageKeys.activeSession, null),
  );
  const [trainingHistory, setTrainingHistory] = useState<TrainingSession[]>(() =>
    readJsonWithLegacy(storageKeys.trainingHistory, legacyStorageKeys.trainingHistory, []),
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => readJson(storageKeys.chat, []));
  const [nextSession, setNextSession] = useState<TrainingSession | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus>({
    state: 'idle',
    message: 'AI is ready when the Edge Function is configured.',
  });
  const [copyNotice, setCopyNotice] = useState('');
  const [dataNotice, setDataNotice] = useState('');
  const [chatNotice, setChatNotice] = useState('');

  const currentFoodSummary = useMemo(() => foodSummary(foodEntries), [foodEntries]);
  const currentProfileSummary = useMemo(() => profileSummary(profile), [profile]);
  const currentSessionProgress = useMemo(() => sessionProgress(activeSession), [activeSession]);

  useEffect(() => writeText(storageKeys.action, action, DEFAULT_ACTION), [action]);
  useEffect(() => writeText(storageKeys.note, note, DEFAULT_NOTE), [note]);
  useEffect(() => writeBoolean(storageKeys.coachNote, coachPinned, false), [coachPinned]);
  useEffect(() => writeJson(storageKeys.profile, profile, !profile), [profile]);
  useEffect(() => writeJson(storageKeys.plan, plan, plan.length === 0), [plan]);
  useEffect(() => writeJson(storageKeys.cards, cards, cards.length === 0), [cards]);
  useEffect(() => writeJson(storageKeys.reminders, reminders, reminders.length === 0), [reminders]);
  useEffect(() => writeJson(storageKeys.nutrition, nutrition, !nutrition), [nutrition]);
  useEffect(() => writeText(storageKeys.selectedTier, selectedTier, 'Always FREE'), [selectedTier]);
  useEffect(() => writeJson(storageKeys.coach, coachPeople, coachPeople.length === 0), [coachPeople]);
  useEffect(() => writeJson(storageKeys.food, foodEntries, foodEntries.length === 0), [foodEntries]);
  useEffect(() => writeJson(storageKeys.activeSession, activeSession, !activeSession), [activeSession]);
  useEffect(
    () => writeJson(storageKeys.trainingHistory, trainingHistory.slice(0, 12), trainingHistory.length === 0),
    [trainingHistory],
  );
  useEffect(() => writeJson(storageKeys.chat, chatMessages.slice(-16), chatMessages.length === 0), [chatMessages]);

  function saveProfile(answers: ProfileAnswers) {
    const nextProfile: Profile = {
      ...answers,
      createdAt: new Date().toISOString(),
      foodGoal: answers.foodGoal,
      goal: answers.goal,
      person: answers.person,
      planTier: answers.planTier ?? selectedTier,
      sport: answers.sport,
      trainingDays: answers.trainingDays,
    };
    const nextPlan = makePlan(nextProfile);

    setProfile(nextProfile);
    setPlan(nextPlan);
    setCards(makeDashboardCards(nextProfile));
    setReminders(makeReminders(nextProfile));
    setNutrition(makeNutrition(nextProfile));
    setNextSession(makeTrainingSession(nextProfile, nextPlan));
    setAction('Make My Week Plan');
    setNote(`${answers.goal} plan for ${answers.sport}. ${answers.trainingDays} of training, with food focus: ${answers.foodGoal}.`);
    return nextProfile;
  }

  function createProfile(answers: ProfileAnswers) {
    saveProfile(answers);
  }

  async function generateAiWeek(profileOverride?: Profile) {
    const activeProfile = profileOverride ?? profile;

    if (isUnder13(activeProfile)) {
      setAiStatus({ state: 'blocked', message: 'A guardian needs to help set up AI planning for users under 13.' });
      setNote('Pace saved the setup locally. AI planning needs a guardian for users under 13.');
      return;
    }

    setAiStatus({ state: 'loading', message: 'Generating a personal week with AI...' });
    setAction('Generate AI Week');

    const result = await generateWeekWithAi({ profile: activeProfile, foodEntries });
    setPlan(result.plan);
    setCards(result.cards);
    setReminders(result.reminders);
    setNutrition(result.nutrition);
    setNote(result.note);
    setNextSession(result.session);
    setAiStatus({
      state: result.source === 'ai' ? 'ready' : 'fallback',
      message:
        result.source === 'ai'
          ? 'AI generated the dashboard plan through the Edge Function.'
          : 'Using the local plan because AI is not reachable yet.',
    });
  }

  async function createProfileWithAi(answers: ProfileAnswers) {
    const nextProfile = saveProfile(answers);
    setAction('Personal AI plan');
    setNote(isUnder13(nextProfile) ? 'Setup saved. Guardian support is needed before AI planning.' : 'Building a personal week from your setup...');
    await generateAiWeek(nextProfile);
  }

  function toggleReminder(reminderId: string) {
    setReminders((items) => items.map((item) => (item.id === reminderId ? { ...item, done: !item.done } : item)));
  }

  function startTraining() {
    const template = nextSession ?? makeTrainingSession(profile, plan);
    setActiveSession(prepareSessionForStart(template));
    setAction('Start Training');
    setNote('Training started. Focus on one block at a time.');
  }

  function completeTrainingSet(exerciseId: string) {
    setActiveSession((session) => {
      if (!session) return session;

      return {
        ...session,
        exercises: session.exercises.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, done: Math.min(exercise.done + 1, exercise.sets) } : exercise,
        ),
      };
    });
  }

  function resetTrainingSet(exerciseId: string) {
    setActiveSession((session) => {
      if (!session) return session;

      return {
        ...session,
        exercises: session.exercises.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, done: 0 } : exercise,
        ),
      };
    });
  }

  function finishTraining() {
    if (!activeSession) return;

    const completedSession = {
      ...activeSession,
      completedAt: new Date().toISOString(),
    };

    setTrainingHistory((history) => [completedSession, ...history].slice(0, 12));
    setActiveSession(null);
    setAction('Training finished');
    setNote('Training saved. Keep the next recovery step simple.');
  }

  function addFood(label: string, kind = DEFAULT_FOOD_KIND, macros?: Partial<Pick<FoodEntry, 'calories' | 'protein' | 'carbs' | 'fats'>>) {
    const cleanLabel = label.trim();

    if (!cleanLabel) {
      return 'Add a food, drink, or simple note first.';
    }

    setFoodEntries((entries) => [
      ...entries,
      { id: makeId(), label: cleanLabel, kind, createdAt: new Date().toISOString(), ...macros },
    ]);
    setAction('Food logged');
    setNote('Food logged. Keep today steady and simple.');
    return `${cleanLabel} saved.`;
  }

  function removeFood(entryId: string) {
    setFoodEntries((entries) => entries.filter((entry) => entry.id !== entryId));
  }

  function addCoachPerson(name: string) {
    const cleanName = name.trim();

    if (!cleanName) {
      return 'Add a name first.';
    }

    setCoachPeople((people) => [
      ...people,
      { id: makeId(), name: cleanName, focus: profile?.goals?.[0] ?? profile?.goal ?? 'Weekly plan' },
    ]);
    setCoachPinned(true);
    setAction('Coach person added');
    setNote('Coach mode saved a person. Keep notes short, supportive, and consent-based.');
    return `${cleanName} added.`;
  }

  function removeCoachPerson(personId: string) {
    setCoachPeople((people) => people.filter((person) => person.id !== personId));
  }

  async function sendChatMessage(text: string) {
    const reason = getSafetyBlockReason(text);
    const cleanText = text.trim();

    if (reason) {
      const blockedMessage: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        text: reason,
        createdAt: new Date().toISOString(),
      };
      setChatNotice(reason);
      setAiStatus({ state: 'blocked', message: reason });
      setChatMessages((messages) => [...messages, blockedMessage].slice(-16));
      return reason;
    }

    const userMessage: ChatMessage = {
      id: makeId(),
      role: 'user',
      text: cleanText,
      createdAt: new Date().toISOString(),
    };

    setChatNotice('');
    setChatMessages((messages) => [...messages, userMessage].slice(-16));
    setAiStatus({ state: 'loading', message: 'Pace is thinking through the safest tweak...' });

    const result = await askPaceWithAi({ profile, plan, question: cleanText });
    const assistantMessage: ChatMessage = {
      id: makeId(),
      role: 'assistant',
      text: result.reply,
      createdAt: new Date().toISOString(),
    };

    if (result.suggestedPlan?.length) {
      setPlan((currentPlan) => [...result.suggestedPlan!, ...currentPlan].slice(0, 7));
      setNote('Pace added a small tweak from chat to the top of your plan.');
    }

    setChatMessages((messages) => [...messages, assistantMessage].slice(-16));
    setAiStatus({
      state: result.source === 'ai' ? 'ready' : result.source === 'blocked' ? 'blocked' : 'fallback',
      message: result.source === 'ai' ? 'Pace answered through the Edge Function.' : 'Using the local chat fallback for now.',
    });
    return result.reply;
  }

  async function copyPlan() {
    const text = formatPlanForClipboard(plan, note, activeSession ?? nextSession);

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard unavailable');
      }

      await navigator.clipboard.writeText(text);
      setCopyNotice('Plan copied.');
    } catch {
      setCopyNotice('Copy is unavailable here. You can still read the plan on this page.');
    }
  }

  function clearData() {
    Object.values(storageKeys).forEach((key) => window.localStorage.removeItem(key));
    setAction(DEFAULT_ACTION);
    setNote(DEFAULT_NOTE);
    setProfile(null);
    setPlan(makePlan(null));
    setCards([...defaultCards]);
    setReminders([...defaultReminders]);
    setNutrition({ ...defaultNutrition });
    setSelectedTier('Always FREE');
    setCoachPeople([]);
    setCoachPinned(false);
    setFoodEntries([]);
    setActiveSession(null);
    setNextSession(null);
    setTrainingHistory([]);
    setChatMessages([]);
    setAiStatus({ state: 'idle', message: 'AI is ready when the Edge Function is configured.' });
    setCopyNotice('');
    setChatNotice('');
    setDataNotice('Demo data cleared from this browser.');
  }

  return {
    action,
    activeSession,
    aiStatus,
    cards,
    chatMessages,
    chatNotice,
    coachPeople,
    coachPinned,
    copyNotice,
    currentFoodSummary,
    currentProfileSummary,
    currentSessionProgress,
    dataNotice,
    foodEntries,
    nextSession,
    note,
    nutrition,
    plan,
    profile,
    reminders,
    selectedTier,
    trainingHistory,
    addCoachPerson,
    addFood,
    clearData,
    completeTrainingSet,
    copyPlan,
    createProfile,
    createProfileWithAi,
    finishTraining,
    generateAiWeek,
    removeCoachPerson,
    removeFood,
    resetTrainingSet,
    sendChatMessage,
    setAction,
    setCoachPinned,
    setCopyNotice,
    setDataNotice,
    setNote,
    setSelectedTier,
    startTraining,
    toggleReminder,
  };
}
