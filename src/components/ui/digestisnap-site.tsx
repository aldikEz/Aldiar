import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Bell,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  Flame,
  Home,
  LogOut,
  Mail,
  Plus,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Target,
  User,
} from 'lucide-react';
import { scanImageWithClientTimeout, type ImageScanPayload } from '../../lib/imageScanClient';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import IPhoneMockup from './iphone-mockup';

type Navigate = (path: string, options?: { replace?: boolean }) => void;
type AppLanguage = 'English' | 'Russian';
type DashboardTab = 'home' | 'progress' | 'profile';
type IncludePreview = 'scan' | 'symptoms' | 'timeline' | 'speed';
type LandingPhoneVariant = 'scan' | 'feeling';
type FeelingOption = 'Fine' | 'Bloated' | 'Pain' | 'Nausea';
type WaterUnit = 'cups' | 'oz' | 'ml';
type LegalPageKind = 'privacy' | 'terms' | 'subscription' | 'contact' | 'support';
type DashboardEntry = {
  id: string;
  user_id?: string;
  title: string;
  created_at: string;
};
type ProfileRow = {
  user_id: string;
  full_name: string;
  username: string;
};
type GenderOption = 'Male' | 'Female' | 'Other';
type SensiGoal = 'Find triggers' | 'Reduce bloating' | 'Build consistency';
type UnitSystem = 'metric' | 'imperial';
type OnboardingStepKind = 'intro' | 'single' | 'multi' | 'basics' | 'timeline' | 'insight' | 'processing';
type BmiCategory = 'Underweight' | 'Balanced' | 'Elevated' | 'High';

type SetupProfile = {
  gender: GenderOption;
  unitSystem: UnitSystem;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: SensiGoal;
  dietType: string;
  checkInsPerDay: number;
  triggers: string[];
  symptoms: string[];
  allergies: string[];
  timelineWeeks: number;
  answers: Record<string, string>;
  multiAnswers: Record<string, string[]>;
};

type OnboardingStep = {
  id: string;
  kind: OnboardingStepKind;
  title: string;
  subtitle?: string;
  field?: string;
  options?: string[];
  insight?: string;
};

const genderOptions: GenderOption[] = ['Male', 'Female', 'Other'];
const goalOptions: SensiGoal[] = ['Find triggers', 'Reduce bloating', 'Build consistency'];
const processingInsights = ['Calculating digestive thresholds...', 'Mapping symptom timing...', 'Building your trigger baseline...', 'Preparing your DigestSnap profile...'];
const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    kind: 'intro',
    title: 'You are closer than you think.',
    subtitle: 'Answer a few fast questions. DigestSnap will make every scan feel more personal from the start.',
  },
  {
    id: 'goal',
    kind: 'single',
    field: 'goal',
    title: 'What should DigestSnap help with first?',
    subtitle: 'Good choice already: you are turning confusion into a system.',
    options: goalOptions,
  },
  {
    id: 'symptoms',
    kind: 'multi',
    field: 'symptoms',
    title: 'What do you notice most often?',
    options: ['Bloating', 'Pain', 'Nausea', 'Gas', 'Acid reflux', 'Low energy'],
  },
  {
    id: 'symptom-time',
    kind: 'single',
    field: 'symptomTime',
    title: 'When does it usually hit?',
    subtitle: 'This timing helps DigestSnap connect the right meal later.',
    options: ['Right after eating', '1-2 hours later', 'At night', 'Next morning'],
  },
  {
    id: 'tracking-style',
    kind: 'single',
    field: 'trackingStyle',
    title: 'What usually stops tracking?',
    subtitle: 'Honest answer. This is exactly what the app is designed around.',
    options: ['I forget', 'Too much typing', 'No clear pattern', 'I never tried'],
  },
  {
    id: 'suspected-foods',
    kind: 'multi',
    field: 'triggers',
    title: 'Which foods feel suspicious?',
    subtitle: 'Nice. These become your first watchlist.',
    options: ['Fried food', 'Bread', 'Dairy', 'Soda', 'Late meals', 'Spicy food'],
  },
  {
    id: 'allergies',
    kind: 'multi',
    field: 'allergies',
    title: 'Any hard avoids?',
    subtitle: 'If none, tap None. Keeping this clean is better than overthinking it.',
    options: ['Dairy', 'Gluten', 'Peanuts', 'Tree nuts', 'Eggs', 'Soy', 'None'],
  },
  {
    id: 'diet-type',
    kind: 'single',
    field: 'dietType',
    title: 'What eating style fits you best?',
    subtitle: 'Solid. This helps DigestSnap avoid generic advice.',
    options: ['No specific diet', 'High protein', 'Vegetarian', 'Vegan', 'Low carb', 'Halal', 'Low FODMAP'],
  },
  {
    id: 'meal-rhythm',
    kind: 'single',
    field: 'mealRhythm',
    title: 'What does a normal day look like?',
    subtitle: 'This tells the AI whether timing might matter.',
    options: ['Regular meals', 'I snack a lot', 'I skip meals', 'Late meals often'],
  },
  {
    id: 'restaurant-frequency',
    kind: 'single',
    field: 'restaurantFrequency',
    title: 'How often do you eat out?',
    subtitle: 'Good to know. Restaurant food often hides sauces, oils, and timing patterns.',
    options: ['Rarely', '1-2 times weekly', '3-5 times weekly', 'Almost daily'],
  },
  {
    id: 'late-food',
    kind: 'single',
    field: 'lateFood',
    title: 'How often do late meals happen?',
    subtitle: 'Good detail. Late food can change what patterns mean.',
    options: ['Rarely', 'Sometimes', 'Often', 'Almost every night'],
  },
  {
    id: 'stress',
    kind: 'single',
    field: 'stressImpact',
    title: 'Does stress affect your stomach?',
    subtitle: 'This helps separate food patterns from stressful-day noise.',
    options: ['Not really', 'Sometimes', 'Clearly yes', 'I am not sure'],
  },
  {
    id: 'sleep',
    kind: 'single',
    field: 'sleepImpact',
    title: 'Does poor sleep change your digestion?',
    subtitle: 'Nice detail. Sleep can change how the same meal feels.',
    options: ['No', 'A little', 'A lot', 'I never noticed'],
  },
  {
    id: 'water',
    kind: 'single',
    field: 'hydration',
    title: 'How is your water intake?',
    subtitle: 'Simple context, but useful for reading patterns later.',
    options: ['Low', 'Average', 'Good', 'Very high'],
  },
  {
    id: 'caffeine',
    kind: 'single',
    field: 'caffeine',
    title: 'How much caffeine do you drink?',
    subtitle: 'This can matter for stomach sensitivity and energy drinks.',
    options: ['None', '1 cup', '2-3 cups', 'Energy drinks'],
  },
  {
    id: 'soda',
    kind: 'single',
    field: 'carbonation',
    title: 'How often do fizzy drinks show up?',
    subtitle: 'Great signal. Soda and carbonation are common pattern noise.',
    options: ['Rarely', 'Sometimes', 'Often', 'Daily'],
  },
  {
    id: 'spice',
    kind: 'single',
    field: 'spiceTolerance',
    title: 'How do spicy foods treat you?',
    subtitle: 'This gives DigestSnap a personal sensitivity baseline.',
    options: ['Fine', 'Sometimes bad', 'Usually bad', 'I avoid them'],
  },
  {
    id: 'dairy',
    kind: 'single',
    field: 'dairyPattern',
    title: 'How does dairy usually go?',
    subtitle: 'You are giving the AI useful personal context.',
    options: ['Usually fine', 'Sometimes bloated', 'Often bloated', 'I avoid dairy'],
  },
  {
    id: 'bread',
    kind: 'single',
    field: 'breadPattern',
    title: 'How do bread or floury foods feel?',
    subtitle: 'This is one of the highest-signal questions.',
    options: ['Usually fine', 'Heavy stomach', 'Bloating', 'I avoid it'],
  },
  {
    id: 'fried',
    kind: 'single',
    field: 'friedPattern',
    title: 'How does fried food usually feel?',
    subtitle: 'Useful. This helps the scanner judge junk food harder for you.',
    options: ['Usually fine', 'Sometimes bad', 'Often bad', 'I avoid it'],
  },
  {
    id: 'consistency',
    kind: 'single',
    field: 'consistency',
    title: 'Why do trackers usually fail?',
    subtitle: 'Honest answers make the app easier to stick with.',
    options: ['I forget', 'Too much typing', 'No useful result', 'I never tried'],
  },
  {
    id: 'motivation',
    kind: 'single',
    field: 'motivation',
    title: 'What would keep you coming back?',
    subtitle: 'Perfect. The dashboard should match what feels useful to you.',
    options: ['Fast check-ins', 'Pattern callouts', 'Streaks', 'Clear food ratings'],
  },
  {
    id: 'timeline',
    kind: 'timeline',
    title: 'How patient should DigestSnap be?',
    subtitle: 'Patterns need repeat signals. Choose a pace you will actually keep.',
  },
  {
    id: 'basics',
    kind: 'basics',
    title: 'Last basics. You are doing great.',
    subtitle: 'One screen. This helps personalize the baseline without making tracking heavy.',
  },
  {
    id: 'checkins',
    kind: 'single',
    field: 'checkInsPerDay',
    title: 'How light should check-ins feel?',
    subtitle: 'The best system is the one you will actually keep using.',
    options: ['1x daily', '2x daily', 'Only after meals'],
  },
  {
    id: 'data-priority',
    kind: 'single',
    field: 'dataPriority',
    title: 'What should the app show first?',
    subtitle: 'Nice. This keeps your dashboard focused instead of noisy.',
    options: ['Symptoms', 'Likely triggers', 'Scan ratings', 'Consistency'],
  },
  {
    id: 'investment',
    kind: 'insight',
    title: 'You are not building a diary',
    subtitle: 'You are building a memory system for your stomach.',
    insight: 'Your first profile already includes symptoms, timing, suspected foods, and consistency style.',
  },
  {
    id: 'processing',
    kind: 'processing',
    title: 'AI Analytics Engine Processing...',
    subtitle: 'DigestSnap is building your initial digestive profile.',
  },
];
const personalizationStepIds = new Set([
  'welcome',
  'goal',
  'symptoms',
  'symptom-time',
  'tracking-style',
  'suspected-foods',
  'allergies',
  'diet-type',
  'meal-rhythm',
  'restaurant-frequency',
  'late-food',
  'stress',
  'sleep',
  'water',
  'caffeine',
  'soda',
  'spice',
  'dairy',
  'bread',
  'fried',
  'consistency',
  'motivation',
  'timeline',
  'basics',
  'checkins',
  'data-priority',
  'investment',
  'processing',
]);
const setupSteps = onboardingSteps.filter((step) => personalizationStepIds.has(step.id));
const SETUP_TOTAL_STEPS = setupSteps.length;
const SENSIBITE_PROFILE_STORAGE_KEY = 'digestisnap-profile-v1';
const SENSIBITE_PENDING_PROFILE_KEY = 'digestisnap-profile-pending';
const SENSIBITE_STREAK_STORAGE_KEY = 'digestisnap-streak-v1';
const SENSIBITE_RECENT_SCANS_STORAGE_KEY = 'digestisnap-recent-scans-v2';
const DIGESTSNAP_LANGUAGE_STORAGE_KEY = 'digestisnap-language-v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type StoredSensiProfile = Pick<
  SetupProfile,
  'age' | 'allergies' | 'answers' | 'checkInsPerDay' | 'dietType' | 'gender' | 'goal' | 'heightCm' | 'multiAnswers' | 'symptoms' | 'timelineWeeks' | 'triggers' | 'unitSystem' | 'weightKg'
>;

type StoredStreak = {
  count: number;
  maxCount: number;
  lastLoggedAt: string;
};

type RecentScan = {
  id: string;
  imageDataUrl: string;
  result: ImageScanPayload['result'];
  createdAt: string;
};

function toStoredProfile(profile: SetupProfile): StoredSensiProfile {
  return {
    age: profile.age,
    allergies: profile.allergies,
    answers: profile.answers,
    checkInsPerDay: profile.checkInsPerDay,
    dietType: profile.dietType,
    gender: profile.gender,
    goal: profile.goal,
    heightCm: profile.heightCm,
    multiAnswers: profile.multiAnswers,
    symptoms: profile.symptoms,
    timelineWeeks: profile.timelineWeeks,
    triggers: profile.triggers,
    unitSystem: profile.unitSystem,
    weightKg: profile.weightKg,
  };
}

function profileStorageKey(userId?: string) {
  return userId ? `${SENSIBITE_PROFILE_STORAGE_KEY}:${userId}` : SENSIBITE_PROFILE_STORAGE_KEY;
}

function streakStorageKey(userId?: string) {
  return userId ? `${SENSIBITE_STREAK_STORAGE_KEY}:${userId}` : SENSIBITE_STREAK_STORAGE_KEY;
}

function recentScansStorageKey(userId?: string) {
  return userId ? `${SENSIBITE_RECENT_SCANS_STORAGE_KEY}:${userId}` : SENSIBITE_RECENT_SCANS_STORAGE_KEY;
}

function languageStorageKey(userId?: string) {
  return userId ? `${DIGESTSNAP_LANGUAGE_STORAGE_KEY}:${userId}` : DIGESTSNAP_LANGUAGE_STORAGE_KEY;
}

function readStoredLanguage(userId?: string): AppLanguage {
  try {
    const raw = window.localStorage.getItem(languageStorageKey(userId));
    return raw === 'Russian' ? 'Russian' : 'English';
  } catch {
    return 'English';
  }
}

function saveStoredLanguage(language: AppLanguage, userId?: string) {
  try {
    window.localStorage.setItem(languageStorageKey(userId), language);
  } catch {
    // Language should not block the app if local storage is unavailable.
  }
}

function readRecentScans(userId?: string): RecentScan[] {
  try {
    const raw = window.localStorage.getItem(recentScansStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<RecentScan>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        ...item,
        imageDataUrl: normalizeImageDataUrl(item.imageDataUrl),
      }))
      .filter((item): item is RecentScan => (
        typeof item.id === 'string' &&
        typeof item.imageDataUrl === 'string' &&
        typeof item.createdAt === 'string' &&
        Boolean(item.result?.productName)
      ))
      .slice(0, 10);
  } catch {
    return [];
  }
}

function saveRecentScans(scans: RecentScan[], userId?: string) {
  try {
    window.localStorage.setItem(recentScansStorageKey(userId), JSON.stringify(scans.slice(0, 10)));
  } catch {
    // Recent scan thumbnails are a convenience cache; scanning still works without it.
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function normalizeImageDataUrl(value: unknown, mimeType = 'image/jpeg') {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  const nestedDataUrl = trimmed.match(/^data:image\/[a-z0-9.+-]+;base64,(data:image\/[a-z0-9.+-]+;base64,.*)$/i);
  if (nestedDataUrl?.[1]) return nestedDataUrl[1];

  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed) || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0) {
    return `data:${mimeType};base64,${trimmed}`;
  }

  return trimmed;
}

function revokeObjectUrl(value: string) {
  if (value.startsWith('blob:')) {
    URL.revokeObjectURL(value);
  }
}

function normalizeStreak(streak: StoredStreak | null): StoredStreak {
  if (!streak) {
    return { count: 1, maxCount: 1, lastLoggedAt: '' };
  }

  const lastLogTime = Date.parse(streak.lastLoggedAt);
  const now = Date.now();
  const maxCount = Math.min(365, Math.max(1, streak.maxCount || streak.count || 1));
  if (!Number.isFinite(lastLogTime) || now - lastLogTime > ONE_DAY_MS) {
    return { count: 1, maxCount, lastLoggedAt: streak.lastLoggedAt };
  }

  const count = Math.min(365, Math.max(1, streak.count));
  return {
    count,
    maxCount: Math.max(maxCount, count),
    lastLoggedAt: streak.lastLoggedAt,
  };
}

function readStoredStreak(userId?: string): StoredStreak {
  try {
    const raw = window.localStorage.getItem(streakStorageKey(userId));
    if (!raw) return normalizeStreak(null);
    const parsed = JSON.parse(raw) as Partial<StoredStreak>;
    return normalizeStreak({
      count: typeof parsed.count === 'number' ? parsed.count : 1,
      maxCount: typeof parsed.maxCount === 'number' ? parsed.maxCount : typeof parsed.count === 'number' ? parsed.count : 1,
      lastLoggedAt: typeof parsed.lastLoggedAt === 'string' ? parsed.lastLoggedAt : '',
    });
  } catch {
    return normalizeStreak(null);
  }
}

function saveStoredStreak(streak: StoredStreak, userId?: string) {
  try {
    window.localStorage.setItem(streakStorageKey(userId), JSON.stringify(streak));
  } catch {
    // Streak display is local polish; storage failures should not block logging.
  }
}

function touchStoredStreak(current: StoredStreak, userId?: string): StoredStreak {
  const now = new Date();
  const lastLogTime = Date.parse(current.lastLoggedAt);
  const sameDay = Number.isFinite(lastLogTime) && new Date(lastLogTime).toDateString() === now.toDateString();
  const missedWindow = !Number.isFinite(lastLogTime) || now.getTime() - lastLogTime > ONE_DAY_MS;
  const nextCount = missedWindow ? 1 : sameDay ? current.count : current.count >= 365 ? 1 : current.count + 1;
  const next = { count: nextCount, maxCount: Math.max(current.maxCount || 1, nextCount), lastLoggedAt: now.toISOString() };
  saveStoredStreak(next, userId);
  return next;
}

function saveStoredProfile(profile: SetupProfile, userId?: string) {
  try {
    window.localStorage.setItem(profileStorageKey(userId), JSON.stringify(toStoredProfile(profile)));
  } catch {
    // Local storage can be disabled; the app still works without profile context.
  }
}

function readStoredProfile(userId?: string): StoredSensiProfile | null {
  try {
    const raw = window.localStorage.getItem(profileStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSensiProfile>;
    return {
      age: typeof parsed.age === 'number' ? parsed.age : 24,
      allergies: Array.isArray(parsed.allergies) ? parsed.allergies.filter((value): value is string => typeof value === 'string') : [],
      answers: isRecord(parsed.answers) ? Object.fromEntries(Object.entries(parsed.answers).filter(([, value]) => typeof value === 'string')) as Record<string, string> : {},
      checkInsPerDay: typeof parsed.checkInsPerDay === 'number' ? parsed.checkInsPerDay : 2,
      dietType: typeof parsed.dietType === 'string' ? parsed.dietType : 'No specific diet',
      gender: parsed.gender === 'Male' || parsed.gender === 'Other' ? parsed.gender : 'Female',
      goal: parsed.goal === 'Reduce bloating' || parsed.goal === 'Build consistency' ? parsed.goal : 'Find triggers',
      heightCm: typeof parsed.heightCm === 'number' ? parsed.heightCm : 170,
      multiAnswers: isRecord(parsed.multiAnswers)
        ? Object.fromEntries(
            Object.entries(parsed.multiAnswers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [],
            ]),
          )
        : {},
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms.filter((value): value is string => typeof value === 'string') : [],
      timelineWeeks: typeof parsed.timelineWeeks === 'number' ? parsed.timelineWeeks : 6,
      triggers: Array.isArray(parsed.triggers) ? parsed.triggers.filter((value): value is string => typeof value === 'string') : [],
      unitSystem: parsed.unitSystem === 'imperial' ? 'imperial' : 'metric',
      weightKg: typeof parsed.weightKg === 'number' ? parsed.weightKg : 64,
    };
  } catch {
    return null;
  }
}

function readPendingStoredProfile() {
  try {
    if (window.localStorage.getItem(SENSIBITE_PENDING_PROFILE_KEY) !== '1') return null;
    return readStoredProfile();
  } catch {
    return null;
  }
}

function clearPendingStoredProfile() {
  try {
    window.localStorage.removeItem(SENSIBITE_PENDING_PROFILE_KEY);
    window.localStorage.removeItem(SENSIBITE_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function getProfileScanTriggers(profile: StoredSensiProfile | null) {
  const values = [
    ...(profile?.triggers ?? []),
    ...(profile?.allergies ?? []),
    ...(profile?.symptoms ?? []),
    profile?.dietType,
    profile?.goal,
    ...Object.entries(profile?.answers ?? {}).map(([key, value]) => `${key}: ${value}`),
    ...Object.entries(profile?.multiAnswers ?? {}).flatMap(([key, values]) => values.map((value) => `${key}: ${value}`)),
  ];

  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value !== 'None')))).slice(0, 12);
}

function getBmiFromProfile(profile: StoredSensiProfile | null) {
  if (!profile || profile.heightCm <= 0 || profile.weightKg <= 0) return null;
  const heightMeters = profile.heightCm / 100;
  const value = profile.weightKg / (heightMeters * heightMeters);
  if (!Number.isFinite(value)) return null;

  const category: BmiCategory = value < 18.5 ? 'Underweight' : value < 25 ? 'Balanced' : value < 30 ? 'Elevated' : 'High';
  const pointer = Math.min(100, Math.max(0, ((Math.min(40, Math.max(15, value)) - 15) / 25) * 100));

  return {
    category,
    display: value.toFixed(1),
    pointer,
    range: `${Math.round(profile.weightKg)} kg / ${Math.round(profile.heightCm)} cm`,
  };
}

function normalizeProfileName(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 80) || 'DigestSnap user';
}

function usernameFromName(value: string) {
  const cleaned = normalizeProfileName(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);

  return cleaned.length >= 3 ? cleaned : `user_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUsername(value: string) {
  return value
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHardImageFailure(scan: ImageScanPayload) {
  const text = [
    scan.result.productName,
    scan.result.overallRating,
    ...scan.result.flaggedChemicals.flatMap((item) => [item.chemicalName, item.reason]),
  ]
    .join(' ')
    .toLowerCase();

  return (
    text.includes('image check error') ||
    text.includes('ai cooling down') ||
    text.includes('quota') ||
    text.includes('rate-limited') ||
    text.includes('ai request failed') ||
    text.includes('ai request timed out') ||
    text.includes('could not verify image')
  );
}

function makeImageCheckErrorResult(fileName: string, errorMessage = ''): ImageScanPayload['result'] {
  const isQuotaError = /quota|cooling|too many|rate/i.test(errorMessage);
  return {
    productName: isQuotaError ? 'AI cooling down' : 'Image check error',
    overallRating: 'Caution',
    score: 0,
    flaggedChemicals: [
      {
        chemicalName: isQuotaError ? 'AI cooling down' : 'Image check failed',
        severity: 'Caution',
        reason: isQuotaError
          ? 'Gemini quota is temporarily cooling down'
          : `Saved ${fileName.replace(/\.[^.]+$/, '') || 'this image'}, but AI could not verify it`,
      },
    ],
  };
}

function isImageCheckErrorResult(result: ImageScanPayload['result']) {
  return result.productName === 'Image check error' || isAiCoolingDownResult(result);
}

function isAiCoolingDownResult(result: ImageScanPayload['result']) {
  return result.flaggedChemicals.some((item) => /cooling|quota|rate/i.test(`${item.chemicalName} ${item.reason}`));
}

const friedFoodPreviewUrl = 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?q=80&w=1000&auto=format&fit=crop';

function LandingPhoneMockup({ className = '', scale = 0.66, variant = 'scan' }: { className?: string; scale?: number; variant?: LandingPhoneVariant }) {
  const surface = 'bg-white text-zinc-950';
  const card = 'bg-white ring-zinc-950/[0.04]';
  const soft = 'bg-[#f7f6f2] ring-zinc-950/[0.04]';
  const isFeeling = variant === 'feeling';
  const week = [
    ['Sun', '21'],
    ['Mon', '22'],
    ['Tue', '23'],
    ['Wed', '24'],
    ['Thu', '25'],
    ['Fri', '26'],
    ['Sat', '27'],
  ];

  return (
    <div
      className={cn('select-none', className)}
      style={{
        height: 876 * scale,
        width: 417 * scale,
      }}
    >
      <IPhoneMockup
        model="15-pro"
        color="natural-titanium"
        scale={scale}
        screenBg="#ffffff"
        showHomeIndicator={false}
        safeArea={false}
        shadow="0 34px 90px rgba(15,23,42,0.22), 0 10px 28px rgba(15,23,42,0.12)"
      >
        <div
          className={cn('h-full w-full overflow-y-auto px-5 pb-24 pt-12', surface)}
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase text-zinc-400">June 24</p>
              <p className="mt-1 text-2xl font-black">DigestSnap</p>
            </div>
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', card)}>
              <User className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1 text-center">
            {week.map(([day, date]) => {
              const active = date === '24';
              return (
                <div className="space-y-2" key={date}>
                  <p className="text-[10px] font-black text-zinc-950">{day}</p>
                  <div className={cn('mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-black', active ? 'bg-zinc-950 text-white' : Number(date) > 24 ? 'text-zinc-400' : 'text-zinc-950')}>
                    {date}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              isFeeling ? ['8/10', 'Meal'] : ['0', 'Scans'],
              isFeeling ? ['2h', 'Later'] : ['Later', 'Check-in'],
              isFeeling ? ['Bloated', 'Feel'] : ['Ready', 'Score'],
            ].map(([value, label]) => (
              <div className={cn('rounded-[18px] p-3 ring-1', card)} key={label}>
                <p className="text-xl font-black leading-none">{value}</p>
                <p className="mt-2 text-[10px] font-black uppercase text-zinc-400">{label}</p>
              </div>
            ))}
          </div>

          <div className={cn('mt-4 rounded-[26px] p-5 ring-1', card)}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[48px] font-black leading-none">{isFeeling ? 'Logged' : 'Ready'}</p>
                <p className="mt-3 text-sm font-black text-zinc-500">{isFeeling ? 'Meal and reaction saved' : 'First scan starts your timeline'}</p>
              </div>
              <div className={cn('flex h-24 w-24 shrink-0 items-center justify-center rounded-full', soft)}>
                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                  <Camera className="h-5 w-5" />
                  <span className="mt-1 text-lg font-black">{isFeeling ? '1' : '0'}</span>
                </div>
              </div>
            </div>
            <div className="mt-7 grid grid-cols-3 gap-3">
              {[
                ['Scan', isFeeling ? 'Done' : 'Start'],
                ['Check-in', isFeeling ? 'Bloated' : 'Later'],
                ['Latest', isFeeling ? '8/10' : 'None'],
              ].map(([label, value], index) => (
                <div key={label}>
                  <p className="text-xs font-black">{label}</p>
                  <div className={cn('mt-2 h-1.5 rounded-full', soft)}>
                    <div className={cn('h-full rounded-full bg-zinc-950', index === 0 ? 'w-full' : isFeeling ? 'w-2/3' : 'w-1.5')} />
                  </div>
                  <p className="mt-2 text-xs font-black text-zinc-600">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={cn('mt-4 rounded-[24px] p-4 ring-1', card)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-black">How do you feel?</p>
                <p className="mt-1 text-xs font-bold text-zinc-500">One tap after eating.</p>
              </div>
              <Activity className="h-5 w-5" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(['Fine', 'Bloated', 'Pain', 'Nausea'] as FeelingOption[]).map((label) => (
                <div className={cn('rounded-[16px] px-3 py-3 text-center text-xs font-black', isFeeling && label === 'Bloated' ? 'bg-zinc-950 text-white' : soft)} key={label}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-base font-black">{isFeeling ? 'Saved reaction' : 'Start with one photo'}</p>
            <div className={cn('mt-3 rounded-[24px] p-4 ring-1', soft)}>
              {!isFeeling && (
                <img alt="Fried food scan" className="mb-3 h-28 w-full rounded-[18px] object-cover" src={friedFoodPreviewUrl} />
              )}
              <div className="flex items-center gap-3">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-full', card)}>
                  {isFeeling ? <Activity className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">{isFeeling ? 'Bloated check-in saved' : 'Fried chicken plate'}</p>
                  <p className="mt-1 text-xs font-bold text-zinc-500">{isFeeling ? 'Connected to the latest meal' : 'Scan quality ready'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={cn('mt-4 rounded-[24px] p-4 ring-1', card)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-black">Timeline</p>
                <p className="mt-1 text-xs font-bold text-zinc-500">{isFeeling ? '1 meal and 1 check-in today' : 'Your first scan will appear here'}</p>
              </div>
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-full bg-white px-4 py-3 text-zinc-950 shadow-[0_14px_36px_rgba(15,23,42,0.16)] ring-1 ring-zinc-950/[0.06]">
            <Home className="h-4 w-4" />
            <BarChart3 className="h-4 w-4 text-zinc-400" />
            <User className="h-4 w-4 text-zinc-400" />
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 text-white">
              <Camera className="h-5 w-5" />
            </div>
          </div>
        </div>
      </IPhoneMockup>
    </div>
  );
}

export function LandingPage({ navigate }: { navigate: Navigate }) {
  const [activeIncludeIndex, setActiveIncludeIndex] = useState(0);
  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    window.scrollTo({ top: Math.max(0, target.offsetTop - 108), behavior: 'smooth' });
  };
  const includeCards: Array<{ icon: typeof Camera; preview: IncludePreview; title: string; body: string }> = [
    {
      icon: Camera,
      preview: 'scan',
      title: 'Snap the meal',
      body: 'Take one photo when you eat. DigestSnap saves the meal, time, and context before the detail disappears.',
    },
    {
      icon: Activity,
      preview: 'symptoms',
      title: 'Tap how you feel',
      body: 'When your body reacts later, choose Fine, Bloated, Pain, or Nausea in seconds. The check-in connects back to the meal.',
    },
    {
      icon: BarChart3,
      preview: 'timeline',
      title: 'Private timeline',
      body: 'DigestSnap looks across your meals and check-ins, then highlights possible repeat triggers so the same pattern does not disappear from memory.',
    },
    {
      icon: Bell,
      preview: 'speed',
      title: 'Keep it effortless',
      body: 'The loop stays light enough to use in real life: photo first, check-in later, pattern when enough signals repeat.',
    },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-zinc-950 antialiased">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] w-full max-w-[1680px] items-center justify-between px-4 md:h-[86px] md:px-10 xl:px-12">
          <button className="flex items-center gap-2 text-[15px] font-black md:gap-2.5 md:text-4xl" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} type="button">
            <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-zinc-950 text-white md:h-12 md:w-12 md:rounded-[14px]">
              <Sparkles className="h-3.5 w-3.5 md:h-7 md:w-7" />
            </span>
            DigestSnap
          </button>
          <nav className="hidden items-center gap-8 text-base font-black xl:flex">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} type="button">Home</button>
            <button onClick={() => scrollToSection('includes')} type="button">Features</button>
            <button onClick={() => scrollToSection('product')} type="button">Product</button>
            <button onClick={() => navigate('/about')} type="button">About</button>
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <button className="h-11 rounded-full px-5 text-sm font-black text-zinc-600 transition hover:text-zinc-950" onClick={() => navigate('/login')} type="button">
              Login
            </button>
            <button className="h-11 rounded-full bg-zinc-950 px-5 text-sm font-black text-white transition active:scale-[0.98]" onClick={() => navigate('/auth')} type="button">
              Get Started
            </button>
          </div>
          <button className="h-8 rounded-full bg-zinc-950 px-3 text-xs font-black text-white md:h-11 md:px-5 md:text-sm lg:hidden" onClick={() => navigate('/login')} type="button">
            Login
          </button>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1680px] items-center gap-6 px-4 pb-8 pt-6 md:min-h-[calc(100svh-86px)] md:gap-8 md:px-10 md:py-10 xl:grid-cols-[0.78fr_1.22fr] xl:px-12">
        <div className="relative z-10 max-w-[700px] text-center xl:text-left">
          <h1 className="mx-auto max-w-[760px] text-[34px] font-black leading-[1.02] sm:text-[60px] md:text-[74px] xl:mx-0 xl:text-[84px]">
            Find the food pattern faster.
          </h1>
          <p className="mx-auto mt-4 max-w-[660px] text-[15px] font-semibold leading-6 text-[#5f574d] md:mt-6 md:text-[23px] md:leading-[1.42] xl:mx-0">
            Take a photo what you eat. Log how you feel. See what keeps bothering you.
          </p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-center md:mt-8 md:gap-4 xl:justify-start">
            <button
              className="flex h-11 items-center justify-center rounded-[12px] bg-zinc-950 px-5 text-sm font-black text-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 active:scale-[0.98] md:h-16 md:rounded-[14px] md:px-8 md:text-lg"
              onClick={() => navigate('/auth')}
              type="button"
            >
              Get Started
            </button>
            <button
              className="flex h-11 items-center justify-center rounded-[12px] bg-white px-5 text-sm font-black text-zinc-950 shadow-sm ring-1 ring-zinc-950/[0.08] transition hover:-translate-y-0.5 active:scale-[0.98] md:h-16 md:rounded-[14px] md:px-8 md:text-lg"
              onClick={() => scrollToSection('product')}
              type="button"
            >
              How it works
            </button>
          </div>
        </div>

        <div className="relative h-[364px] overflow-visible rounded-[28px] bg-white sm:h-[660px] lg:h-[720px]">
          <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 sm:left-[12%] sm:top-8 sm:translate-x-0 lg:left-[7%] xl:left-[10%]">
            <LandingPhoneMockup className="sm:hidden" scale={0.38} variant="scan" />
            <LandingPhoneMockup className="hidden sm:block" variant="scan" />
          </div>
          <div className="absolute right-[-2%] top-20 z-10 hidden rotate-6 opacity-95 sm:block lg:right-[1%] xl:right-[5%]">
            <LandingPhoneMockup scale={0.64} variant="feeling" />
          </div>
        </div>
      </section>

      <section className="scroll-mt-20 bg-white px-4 py-12 md:scroll-mt-28 md:px-10 md:py-28" id="includes">
        <div className="mx-auto max-w-[1480px]">
          <div className="mx-auto max-w-[960px] text-center">
              <h2 className="mx-auto max-w-[850px] text-[32px] font-black leading-[1.02] md:text-7xl">
                One scan, one check-in, then a pattern.
              </h2>
          </div>

          <div className="mt-8 grid items-start gap-4 md:mt-14 md:gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="lg:sticky lg:top-28">
              <div className="relative overflow-hidden rounded-[26px] bg-white p-3 text-zinc-950 shadow-[0_18px_54px_rgba(15,23,42,0.07)] ring-1 ring-zinc-950/[0.05] md:rounded-[34px] md:p-8">
                <div className="relative flex h-[366px] items-start justify-center overflow-visible rounded-[22px] bg-white pt-3 ring-1 ring-zinc-950/[0.04] md:h-[628px] md:rounded-[30px] md:pt-6">
                  <LandingPhoneMockup className="md:hidden" scale={0.39} variant={includeCards[activeIncludeIndex].preview === 'scan' ? 'scan' : 'feeling'} />
                  <LandingPhoneMockup className="hidden md:block" scale={0.66} variant={includeCards[activeIncludeIndex].preview === 'scan' ? 'scan' : 'feeling'} />
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:gap-4">
              {includeCards.map(({ icon: Icon, title, body }, index) => {
                const selected = activeIncludeIndex === index;
                return (
                <button
                  className={cn(
                    'grid min-h-[132px] gap-3 rounded-[22px] border bg-white p-4 text-left text-zinc-950 transition duration-300 active:scale-[0.99] md:min-h-[178px] md:grid-cols-[76px_1fr] md:items-center md:gap-5 md:rounded-[28px] md:p-7',
                    selected
                      ? 'z-10 border-zinc-950 shadow-[0_18px_46px_rgba(15,23,42,0.12)] ring-2 ring-zinc-950/5 md:-translate-y-1 md:shadow-[0_26px_70px_rgba(15,23,42,0.16)]'
                      : 'border-zinc-200 shadow-sm hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]',
                  )}
                  onClick={() => setActiveIncludeIndex(index)}
                  key={title}
                  type="button"
                >
                  <div className={cn('flex h-12 w-12 items-center justify-center rounded-[16px] transition duration-300 md:h-16 md:w-16 md:rounded-[22px]', selected ? 'bg-white text-zinc-950 shadow-[0_14px_34px_rgba(15,23,42,0.12)] ring-1 ring-zinc-950/[0.10]' : 'bg-[#f1f0ea] text-zinc-950')}>
                    <Icon className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black leading-tight md:text-3xl">{title}</h3>
                    <p className="mt-2 max-w-[650px] text-sm font-semibold leading-6 text-[#5f574d] md:mt-3 md:text-lg md:leading-8">{body}</p>
                  </div>
                </button>
              )})}
            </div>
          </div>
        </div>
      </section>

      <section className="scroll-mt-20 bg-white px-4 py-12 md:scroll-mt-28 md:px-12 md:py-28" id="product">
        <div className="mx-auto max-w-[1500px]">
          <div className="mx-auto max-w-[1040px] text-center">
            <h2 className="text-[38px] font-extrabold leading-[1.02] md:text-[72px]">
              Why us?
            </h2>
            <p className="mx-auto mt-4 max-w-[760px] text-base font-semibold leading-7 text-[#605a51] md:mt-6 md:text-2xl md:leading-10">
              DigestSnap is built for the real eating loop: quick photo first, simple check-in later, clear pattern when the same signal repeats.
            </p>
          </div>

          <div className="mt-9 grid gap-4 md:mt-14 md:gap-5 lg:grid-cols-3">
            {[
              {
                icon: Camera,
                title: 'Photo first',
                body: 'No long diary entry. A scan saves the food, time, visual context, and first rating while the meal is still fresh.',
              },
              {
                icon: Activity,
                title: 'Reaction later',
                body: 'Symptoms often show up later. DigestSnap links that check-in back to the right meal instead of leaving it as a random feeling.',
              },
              {
                icon: ShieldCheck,
                title: 'Pattern clear',
                body: 'The timeline highlights repeat foods and timing, so users see what keeps showing up without digging through memory.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                className="group flex min-h-[168px] gap-4 rounded-[26px] bg-white p-5 shadow-[0_18px_54px_rgba(15,23,42,0.07)] ring-1 ring-zinc-950/[0.06] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_76px_rgba(15,23,42,0.10)] md:min-h-[210px] md:gap-5 md:rounded-[30px] md:p-6"
                key={title}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#f7f6f2] text-zinc-950 shadow-sm ring-1 ring-zinc-950/[0.05] transition duration-300 group-hover:bg-zinc-950 group-hover:text-white md:h-14 md:w-14 md:rounded-[18px]">
                  <Icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-[23px] font-extrabold leading-[1.08] md:text-[28px]">{title}</h3>
                  <p className="mt-3 text-[14px] font-semibold leading-6 text-[#605a51] md:text-[16px] md:leading-7">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-white px-4 py-10 md:px-12 md:py-14">
        <div className="mx-auto grid max-w-[1500px] gap-6 border-t border-zinc-200 pt-8 md:grid-cols-[1fr_auto_auto] md:gap-8 md:pt-10">
          <div>
            <p className="text-2xl font-black">DigestSnap</p>
          </div>
          <div className="space-y-3 text-sm font-bold text-zinc-500">
            <p className="font-black text-zinc-950">Legal</p>
            <button className="block min-h-10 py-2 text-left transition hover:text-zinc-950" onClick={() => navigate('/privacy')} type="button">Privacy Policy</button>
            <button className="block min-h-10 py-2 text-left transition hover:text-zinc-950" onClick={() => navigate('/terms')} type="button">Terms of Use</button>
            <button className="block min-h-10 py-2 text-left transition hover:text-zinc-950" onClick={() => navigate('/manage-subscription')} type="button">Manage Subscription</button>
          </div>
          <div className="space-y-3 text-sm font-bold text-zinc-500">
            <p className="font-black text-zinc-950">Company</p>
            <button className="block min-h-10 py-2 text-left transition hover:text-zinc-950" onClick={() => navigate('/about')} type="button">About</button>
            <button className="block min-h-10 py-2 text-left transition hover:text-zinc-950" onClick={() => navigate('/contact')} type="button">Contact</button>
            <button className="block min-h-10 py-2 text-left transition hover:text-zinc-950" onClick={() => navigate('/support')} type="button">Support</button>
          </div>
        </div>
      </footer>
    </main>
  );
}

const legalPageContent: Record<
  LegalPageKind,
  {
    eyebrow: string;
    title: string;
    lede: string;
    sections: Array<{ title: string; body: string; items?: string[] }>;
  }
> = {
  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    lede: 'DigestSnap is built around private food and symptom memory. This page explains what we collect, why we collect it, and the controls users should have before trusting the product.',
    sections: [
      {
        title: 'Information we collect',
        body: 'We collect only the information needed to operate DigestSnap and improve the experience.',
        items: [
          'Account information, such as your name, email address, and sign-in provider details when you use Google sign-in.',
          'Profile information you choose to provide, such as age, biological sex, height, weight, goals, diet preferences, allergies, avoided foods, and common symptoms.',
          'Food and check-in data, such as uploaded meal photos, typed meal notes, timestamps, symptoms, and feeling selections.',
          'Technical data, such as device type, browser type, log events, error reports, and approximate region for security and reliability.',
          'Support messages you send us, including the contact details needed to reply.',
        ],
      },
      {
        title: 'How we use information',
        body: 'We use your data to run the app, generate personal food-memory timelines, keep accounts secure, and improve product reliability.',
        items: [
          'Analyze uploaded food photos and meal notes to create saved food events.',
          'Connect meals, symptoms, time, and repeated patterns into personal insights.',
          'Maintain your account, onboarding preferences, subscription state, and support history.',
          'Detect bugs, abuse, security incidents, and service misuse.',
          'Send service messages related to your account, support requests, or subscription status.',
        ],
      },
      {
        title: 'Health-adjacent data',
        body: 'Food photos, symptoms, allergies, and digestion notes can be sensitive. We treat this data as private health-adjacent information even when it may not be legally classified as medical records in every jurisdiction.',
        items: [
          'We do not sell your food photos, symptoms, allergies, or personal pattern history.',
          'We do not use your symptom history for third-party targeted advertising.',
          'We do not share identifiable health-adjacent data with sponsors or food brands for ranking or promotion.',
          'We only share data with service providers needed to operate DigestSnap, such as hosting, authentication, AI analysis, analytics, and payment infrastructure, under appropriate processing restrictions.',
        ],
      },
      {
        title: 'AI processing',
        body: 'DigestSnap may use AI providers to analyze photos, labels, text, and patterns. AI output can be incomplete or wrong. The product is designed for wellness tracking and personal pattern memory, not medical diagnosis, treatment, emergency care, or guaranteed allergy safety.',
      },
      {
        title: 'Storage, deletion, and control',
        body: 'You should be able to request access, correction, export, or deletion of your account data. Some records may be retained for security, legal, billing, fraud prevention, or backup reasons where allowed by law.',
      },
      {
        title: 'Security',
        body: 'We use reasonable administrative, technical, and organizational safeguards to protect user data. No internet service is perfectly secure. If we learn of a security incident that legally requires notice, we will notify affected users and regulators as required by applicable law.',
      },
      {
        title: 'Children and teens',
        body: 'DigestSnap is not directed to children under 13. Users under the age of majority should use DigestSnap only with involvement from a parent or guardian, especially when entering allergy, symptom, or body-profile information.',
      },
      {
        title: 'Contact',
        body: 'For privacy requests, account deletion, or data questions, contact DigestSnap support at support@digestisnap.ai or use the Support page.',
      },
    ],
  },
  terms: {
    eyebrow: 'Legal',
    title: 'Terms of Use',
    lede: 'These terms explain the rules for using DigestSnap. They are written to keep the product honest: useful wellness tracking, no fake medical promises.',
    sections: [
      {
        title: 'What DigestSnap does',
        body: 'DigestSnap helps users log meals, symptoms, feelings, and timing so they can notice possible repeat patterns. It is a wellness and personal tracking product.',
      },
      {
        title: 'Not medical advice',
        body: 'DigestSnap does not provide medical advice, diagnosis, treatment, emergency support, or professional dietary care. Do not ignore professional medical advice because of anything shown in DigestSnap. If you have severe pain, allergic reactions, breathing trouble, blood in stool, persistent vomiting, or another urgent symptom, seek medical help immediately.',
      },
      {
        title: 'Food and allergy limitations',
        body: 'DigestSnap may miss ingredients, hidden allergens, cross-contamination, preparation methods, or label details. A scan or pattern result must never be treated as a guarantee that a food is safe. Users with allergies, medical conditions, pregnancy, eating disorders, chronic illness, or prescribed diets should confirm decisions with a qualified professional.',
      },
      {
        title: 'User responsibilities',
        body: 'You are responsible for the information you enter, the decisions you make, and how you use results. You agree not to misuse the product, upload illegal content, attempt to access another account, reverse engineer the service, or use DigestSnap to harm yourself or others.',
      },
      {
        title: 'AI and content accuracy',
        body: 'AI analysis is probabilistic and may be inaccurate, incomplete, delayed, or unavailable. Product rankings, possible triggers, and pattern summaries are informational signals only. We may update, correct, or remove features as the product improves.',
      },
      {
        title: 'Subscriptions and billing',
        body: 'If paid plans are offered, prices, trial periods, renewal dates, and cancellation steps will be shown before purchase. Unless stated otherwise at checkout, subscriptions renew automatically until cancelled. Manage or cancel through the same store, payment provider, or account area used to subscribe.',
      },
      {
        title: 'Account termination',
        body: 'We may suspend or terminate access if an account violates these terms, creates security risk, abuses infrastructure, or uses the product in a way that could harm users, DigestSnap, or third parties.',
      },
      {
        title: 'Disclaimers and liability',
        body: 'To the maximum extent permitted by applicable law, DigestSnap is provided as is and as available. We do not promise uninterrupted service, perfect accuracy, medical outcomes, or that every food trigger will be detected. Liability is limited to the extent allowed by applicable law.',
      },
      {
        title: 'Contact',
        body: 'For questions about these terms, contact DigestSnap at support@digestisnap.ai or use the Contact page.',
      },
    ],
  },
  subscription: {
    eyebrow: 'Account',
    title: 'Manage Subscription',
    lede: 'A clear subscription page reduces confusion, refund disputes, and angry users. This page should connect to your real payment provider before launch.',
    sections: [
      {
        title: 'Before billing goes live',
        body: 'DigestSnap should show the plan price, renewal period, trial length, billing date, cancellation method, and refund rules before a user starts a paid plan.',
        items: [
          'Show the exact monthly or yearly price in the user-facing checkout.',
          'Show whether the trial is free, when it ends, and when billing starts.',
          'Make cancellation reachable from account settings and this page.',
          'Send account-status or billing reminders where required by the payment provider or local law.',
        ],
      },
      {
        title: 'How to cancel',
        body: 'If you subscribed through an app store or payment provider, cancel through that same provider. If DigestSnap bills you directly, cancellation should be available from your account dashboard after payment integration is enabled.',
      },
      {
        title: 'Refunds',
        body: 'Refund handling depends on the payment provider and applicable law. App-store purchases are usually handled by the store. Direct purchases should follow the refund policy shown at checkout.',
      },
      {
        title: 'Billing status',
        body: 'No subscription is created unless a checkout screen clearly shows the plan, price, renewal date, and cancellation method before confirmation.',
      },
    ],
  },
  contact: {
    eyebrow: 'Company',
    title: 'Contact',
    lede: 'Reach DigestSnap for product questions, partnerships, privacy requests, or account help.',
    sections: [
      {
        title: 'General contact',
        body: 'Use this page for product questions, feedback, and non-urgent account questions. You can also contact support@digestisnap.ai.',
      },
      {
        title: 'Privacy requests',
        body: 'For account deletion, data export, or privacy questions, include the email used for your DigestSnap account so the request can be verified.',
      },
      {
        title: 'Medical concerns',
        body: 'DigestSnap cannot answer urgent medical questions. If symptoms are severe, sudden, recurring, or dangerous, contact a doctor or emergency service.',
      },
    ],
  },
  support: {
    eyebrow: 'Help',
    title: 'Support',
    lede: 'Fast support should be clear, calm, and safe. This page separates product help from medical advice.',
    sections: [
      {
        title: 'What support can help with',
        body: 'Support can help with login issues, scan errors, account settings, subscription questions, bug reports, and privacy requests.',
        items: [
          'Google sign-in or account access issues.',
          'Photo upload, scan, or dashboard sync problems.',
          'Deleting an account or requesting data export.',
          'Questions about subscription status after billing is connected.',
        ],
      },
      {
        title: 'What support cannot do',
        body: 'Support cannot diagnose symptoms, confirm whether a food is medically safe, replace allergy guidance, or provide treatment plans.',
      },
      {
        title: 'Emergency and allergy warning',
        body: 'If you may be having a severe allergic reaction, difficulty breathing, severe pain, fainting, or another urgent symptom, seek emergency medical help immediately.',
      },
      {
        title: 'Recommended support details',
        body: 'When reporting a bug, include your account email, device, browser, what you were trying to do, and a screenshot if possible. Do not send medical records or unnecessary sensitive information.',
      },
    ],
  },
};

export function LegalPage({ kind, navigate }: { kind: LegalPageKind; navigate: Navigate }) {
  const page = legalPageContent[kind];
  const [openSection, setOpenSection] = useState(page.sections[0]?.title ?? '');

  return (
    <main className="min-h-screen bg-[#fffef7] px-5 py-6 text-zinc-950 antialiased md:px-10 md:py-10">
      <div className="mx-auto max-w-[1320px]">
        <header className="flex items-center justify-between gap-4">
          <button
            className="flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-black shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 active:scale-[0.98]"
            onClick={() => navigate('/')}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </button>
          <button className="text-lg font-black" onClick={() => navigate('/')} type="button">
            DigestSnap
          </button>
        </header>

        <section className="mt-12 overflow-hidden rounded-[36px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.05]">
          <div className="grid lg:grid-cols-[340px_1fr]">
            <aside className="border-b border-zinc-100 bg-[#fbfaf7] p-6 lg:sticky lg:top-8 lg:h-[calc(100vh-64px)] lg:border-b-0 lg:border-r lg:p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7a7064]">{page.eyebrow}</p>
              <h1 className="mt-4 text-4xl font-black leading-[0.98] md:text-5xl">{page.title}</h1>
              <p className="mt-5 text-sm font-semibold leading-6 text-[#5f574d]">{page.lede}</p>

              <div className="mt-7 grid gap-2">
                {page.sections.map((section, index) => {
                  const selected = openSection === section.title;
                  return (
                    <button
                      className={cn(
                        'flex min-h-[48px] items-center justify-between gap-3 rounded-[16px] px-4 text-left text-sm font-black transition active:scale-[0.99]',
                        selected ? 'bg-zinc-950 text-white shadow-[0_16px_34px_rgba(15,23,42,0.16)]' : 'bg-white text-zinc-600 ring-1 ring-zinc-950/[0.05] hover:text-zinc-950',
                      )}
                      key={section.title}
                      onClick={() => {
                        setOpenSection(section.title);
                        document.getElementById(`legal-section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }}
                      type="button"
                    >
                      <span className="min-w-0 leading-tight">{section.title}</span>
                      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]', selected ? 'bg-white text-zinc-950' : 'bg-[#f3f2ed] text-zinc-500')}>{index + 1}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-7 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.05]">
                <p className="text-sm font-black">Important</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">
                  DigestSnap is a wellness tracker for personal pattern memory. It is not emergency care, diagnosis, or guaranteed allergy safety.
                </p>
              </div>
            </aside>

            <section className="grid gap-4 p-5 md:p-8">
              {page.sections.map((section, index) => {
                const expanded = openSection === section.title;
                return (
                  <article
                    className="scroll-mt-8 overflow-hidden rounded-[28px] bg-[#fbfaf7] shadow-[0_18px_45px_rgba(15,23,42,0.05)] ring-1 ring-zinc-950/[0.04]"
                    id={`legal-section-${index}`}
                    key={section.title}
                  >
                    <button
                      aria-expanded={expanded}
                      className="flex w-full items-center justify-between gap-5 p-6 text-left transition hover:bg-white/70 active:scale-[0.998] md:p-8"
                      onClick={() => setOpenSection(expanded ? '' : section.title)}
                      type="button"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Section {index + 1}</p>
                        <h2 className="mt-2 text-2xl font-black md:text-3xl">{section.title}</h2>
                      </div>
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-zinc-950/[0.05] transition', expanded && 'rotate-90 bg-zinc-950 text-white')}>
                        <ChevronRight className="h-5 w-5" />
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          animate={{ height: 'auto', opacity: 1 }}
                          className="overflow-hidden"
                          exit={{ height: 0, opacity: 0 }}
                          initial={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div className="px-6 pb-6 md:px-8 md:pb-8">
                            <p className="text-base font-semibold leading-7 text-[#5f574d] md:text-lg md:leading-8">{section.body}</p>
                            {section.items && (
                              <ul className="mt-5 grid gap-3">
                                {section.items.map((item) => (
                                  <li className="flex gap-3 rounded-[18px] bg-white p-4 text-sm font-bold leading-6 text-zinc-700 ring-1 ring-zinc-950/[0.04] md:text-base" key={item}>
                                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-zinc-950" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                );
              })}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

export function AboutPage({ navigate }: { navigate: Navigate }) {
  const principles: Array<[typeof Camera, string, string]> = [
    [Camera, 'Capture first', 'Food memory starts with the moment, not with a long form. A photo creates the first clean event.'],
    [Activity, 'Check in later', 'Symptoms often arrive after the meal. DigestSnap keeps the second signal simple enough to actually log.'],
    [BarChart3, 'Learn from repeats', 'The product becomes useful when meals, timing, and reactions appear together more than once.'],
  ];
  const timeline: Array<[string, string, string]> = [
    ['01', 'Meal event', 'A scan saves the food, time, score, and visible context.'],
    ['02', 'Body response', 'A later check-in records how the user felt without forcing a diary entry.'],
    ['03', 'Private timeline', 'Repeat signals become visible without digging through memory or old chats.'],
  ];

  return (
    <main className="min-h-screen bg-[#fffef7] px-5 py-6 text-zinc-950 antialiased md:px-10 md:py-10">
      <div className="mx-auto max-w-[1480px]">
        <header className="flex items-center justify-between gap-4">
          <button
            className="flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-black shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 active:scale-[0.98]"
            onClick={() => navigate('/')}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </button>
          <button className="min-h-11 rounded-full px-4 text-sm font-black" onClick={() => navigate('/auth')} type="button">
            Get Started
          </button>
        </header>

        <section className="grid min-h-[calc(100vh-110px)] items-center gap-10 py-16 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">About DigestSnap</p>
            <h1 className="mt-5 max-w-[760px] text-[48px] font-black leading-[1.02] md:text-[78px]">
              Food memory for people who need proof, not guesses.
            </h1>
            <p className="mt-7 max-w-[680px] text-lg font-semibold leading-8 text-[#5f574d] md:text-2xl md:leading-10">
              DigestSnap exists because the hard part is not knowing that your stomach feels off. The hard part is remembering exactly what happened before it became obvious.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[34px] bg-white p-7 text-zinc-950 shadow-[0_24px_70px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.05] sm:col-span-2">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-zinc-400">Product thesis</p>
              <h2 className="mt-5 text-4xl font-black leading-tight">
                The loop has to be faster than forgetting.
              </h2>
              <p className="mt-5 max-w-[760px] text-base font-semibold leading-7 text-[#5f574d]">
                One scan and one later check-in can become a timeline. That is the behavioral wedge: less typing, less discipline, more useful memory.
              </p>
            </div>

            {principles.map(([Icon, title, body]) => (
              <article className="rounded-[30px] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.05]" key={title}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f1f0ea]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-2xl font-black">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">{body}</p>
              </article>
            ))}

            <article className="rounded-[30px] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.05]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f1f0ea]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-6 text-2xl font-black">Built with caution</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
                DigestSnap shows possible patterns. It avoids guaranteed safety claims and keeps health decisions in the user’s control.
              </p>
            </article>
          </div>
        </section>

        <section className="grid gap-6 pb-20 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="rounded-[34px] bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.05]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Operating system</p>
            <h2 className="mt-4 text-4xl font-black leading-tight">The smallest useful behavior loop.</h2>
            <p className="mt-5 text-base font-semibold leading-7 text-[#5f574d]">
              The product is intentionally narrow: scan what you ate, tap how you felt, and let repeat context build over time.
            </p>
          </div>

          <div className="grid gap-4">
            {timeline.map(([number, title, body]) => (
              <article className="grid gap-4 rounded-[30px] bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] ring-1 ring-zinc-950/[0.05] sm:grid-cols-[88px_1fr] sm:items-center" key={number}>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-950 text-xl font-black text-white">{number}</div>
                <div>
                  <h3 className="text-2xl font-black">{title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export function DashboardPage({ navigate, session }: { navigate: Navigate; session: Session }) {
  const initialName = normalizeProfileName(session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'DigestSnap user');
  const initialUsername = usernameFromName(initialName);
  const [storedProfile, setStoredProfile] = useState<StoredSensiProfile | null>(() => readStoredProfile(session.user.id));
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanProgressText, setScanProgressText] = useState('Analyzing image...');
  const [scanResult, setScanResult] = useState<ImageScanPayload | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>(() => readRecentScans(session.user.id));
  const [logs, setLogs] = useState<DashboardEntry[]>([]);
  const [, setDashboardError] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [profileName, setProfileName] = useState(initialName);
  const [profileUsername, setProfileUsername] = useState(initialUsername);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [profileDraftName, setProfileDraftName] = useState(initialName);
  const [profileDraftUsername, setProfileDraftUsername] = useState(initialUsername);
  const [profileSaving, setProfileSaving] = useState(false);
  const [goalsSheetOpen, setGoalsSheetOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState<StoredSensiProfile>(() => readStoredProfile(session.user.id) ?? {
    age: 24,
    allergies: [],
    answers: {},
    checkInsPerDay: 2,
    dietType: 'No specific diet',
    gender: 'Female',
    goal: 'Find triggers',
    heightCm: 170,
    multiAnswers: {},
    symptoms: [],
    timelineWeeks: 6,
    triggers: [],
    unitSystem: 'metric',
    weightKg: 64,
  });

  useEffect(() => {
    if (isDarkMode) setIsDarkMode(false);
  }, [isDarkMode]);
  const [resultSheetOpen, setResultSheetOpen] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState('');
  const [language, setLanguage] = useState<AppLanguage>(() => readStoredLanguage(session.user.id));
  const [selectedFeeling, setSelectedFeeling] = useState<FeelingOption | null>(null);
  const [cameraSheetOpen, setCameraSheetOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);
  const [waterUnit, setWaterUnit] = useState<WaterUnit>('oz');
  const [waterMl, setWaterMl] = useState(0);
  const [manualWaterAmount, setManualWaterAmount] = useState('');
  const [streak, setStreak] = useState<StoredStreak>(() => readStoredStreak(session.user.id));
  const [selectedHomeDate, setSelectedHomeDate] = useState(() => new Date().toDateString());
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const syncErrorMessage = language === 'Russian' ? 'Не удалось синхронизировать записи. Проверьте подключение.' : 'Unable to sync entries. Please check your connection.';

  useEffect(() => {
    saveStoredLanguage(language, session.user.id);
  }, [language, session.user.id]);

  useEffect(() => {
    let active = true;

    async function loadEntries() {
      const { data, error } = await supabase
        .from('entries')
        .select('id,user_id,title,created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (!active) return;

      if (error) {
        setLogs([]);
        return;
      }

      setLogs(data ?? []);
    }

    loadEntries();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function ensureProfile() {
      const pendingProfile = readPendingStoredProfile();
      if (pendingProfile) {
        try {
          window.localStorage.setItem(profileStorageKey(session.user.id), JSON.stringify(pendingProfile));
        } catch {
          // If storage fails, keep using the in-memory profile for this session.
        }
        clearPendingStoredProfile();
        if (active) setStoredProfile(pendingProfile);
      }

      const { data } = await supabase
        .from('profiles')
        .select('user_id,full_name,username')
        .eq('user_id', session.user.id)
        .maybeSingle<ProfileRow>();

      if (!active) return;

      if (data) {
        setProfileName(data.full_name);
        setProfileUsername(data.username);
        setProfileDraftName(data.full_name);
        setProfileDraftUsername(data.username);
        return;
      }

      const candidates = getProfileUsernameCandidates(usernameFromName(initialName), session.user.id);
      let created: ProfileRow | null = null;

      for (const username of candidates) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .upsert(
            {
              user_id: session.user.id,
              full_name: initialName,
              username,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          )
          .select('user_id,full_name,username')
          .single<ProfileRow>();

        if (profile && !error) {
          created = profile;
          break;
        }

        if (!error?.message?.includes('profiles_username')) {
          break;
        }
      }

      if (!active || !created) return;

      setProfileName(created.full_name);
      setProfileUsername(created.username);
      setProfileDraftName(created.full_name);
      setProfileDraftUsername(created.username);
    }

    ensureProfile();

    return () => {
      active = false;
    };
  }, [initialName, session.user.id]);

  useEffect(() => {
    return () => {
      if (scanPreviewUrl) revokeObjectUrl(scanPreviewUrl);
    };
  }, [scanPreviewUrl]);

  useEffect(() => {
    if (!cameraSheetOpen) {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      return;
    }

    let cancelled = false;
    setCameraError('');

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera is not available in this browser. Try opening DigestSnap in a browser with camera access.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraError('Camera permission was blocked. Allow camera access and try again.');
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraSheetOpen]);

  const saveEntry = async (title: string) => {
    const optimisticEntry: DashboardEntry = {
      id: crypto.randomUUID(),
      user_id: session.user.id,
      title,
      created_at: new Date().toISOString(),
    };

    setLogs((items) => [optimisticEntry, ...items.slice(0, 5)]);

    const { data, error } = await supabase
      .from('entries')
      .insert({ title, user_id: session.user.id })
      .select('id,user_id,title,created_at')
      .single();

    if (error) {
      setLogs((items) => items.filter((item) => item.id !== optimisticEntry.id));
      setDashboardError(syncErrorMessage);
      return false;
    }

    if (data) {
      setLogs((items) => items.map((item) => (item.id === optimisticEntry.id ? data : item)));
    }

    setStreak((current) => touchStoredStreak(current, session.user.id));
    return true;
  };

  const runImageScan = async (file: File | undefined) => {
    if (!file) return;
    setActiveTab('home');
    setScanState('scanning');
    setScanProgress(4);
    setScanProgressText(copy.analyzingImage);
    setDashboardError('');
    setSelectedFeeling(null);
    setResultSheetOpen(false);
    setScanPreviewUrl((current) => {
      if (current) revokeObjectUrl(current);
      return URL.createObjectURL(file);
    });
    let stableImageDataUrl = '';
    try {
      stableImageDataUrl = await fileToDataUrl(file);
    } catch {
      stableImageDataUrl = '';
    }

    const saveImageCheckError = async (imageDataUrl = stableImageDataUrl, errorMessage = '') => {
      const errorResult = makeImageCheckErrorResult(file.name, errorMessage);
      const errorScan: ImageScanPayload = { result: errorResult };
      window.clearInterval(progressTimer);
      setScanResult(errorScan);
      setScanProgress(100);
      setScanProgressText(isAiCoolingDownResult(errorResult) ? copy.aiCoolingDownTitle : copy.visualUnavailable);
      setScanState('done');
      setScanPreviewUrl((current) => current || normalizeImageDataUrl(imageDataUrl));
      window.setTimeout(() => setResultSheetOpen(true), 450);
    };

    const progressTimer = window.setInterval(() => {
      setScanProgress((current) => {
        const next = Math.min(92, current + 7);
        if (next > 58) setScanProgressText(copy.checkingContext);
        return next;
      });
    }, 260);

    try {
      const result = await scanImageWithClientTimeout(file, {
        userLang: language,
        userTriggers: getProfileScanTriggers(storedProfile),
        slowAfterMs: 2_500,
        hardTimeoutMs: 18_000,
      });

      if (isHardImageFailure(result.scan)) {
        await saveImageCheckError(normalizeImageDataUrl(result.compressedImage.imageBase64 || stableImageDataUrl, result.compressedImage.mimeType));
        return;
      }

      const scanImageDataUrl = normalizeImageDataUrl(result.compressedImage.imageBase64 || stableImageDataUrl, result.compressedImage.mimeType);
      window.clearInterval(progressTimer);
      setScanResult(result.scan);
      setScanPreviewUrl(scanImageDataUrl);
      setScanProgress(100);
      setScanProgressText(copy.savedRecent);
      setScanState('done');
      await saveEntry(`${result.scan.result.overallRating}: ${result.scan.result.productName} scored ${result.scan.result.score}/100`);
      const recentScan: RecentScan = {
        id: crypto.randomUUID(),
        imageDataUrl: scanImageDataUrl,
        result: result.scan.result,
        createdAt: new Date().toISOString(),
      };
      setRecentScans((items) => {
        const next = [recentScan, ...items].slice(0, 10);
        saveRecentScans(next, session.user.id);
        return next;
      });
      window.setTimeout(() => setResultSheetOpen(true), 450);
    } catch (error) {
      await saveImageCheckError(stableImageDataUrl, error instanceof Error ? error.message : '');
    }
  };

  const openCamera = () => {
    setResultSheetOpen(false);
    setCameraSheetOpen(true);
  };

  const captureCameraFrame = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setCameraError(copy.cameraLoading);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1080;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError(copy.cameraCaptureError);
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) {
      setCameraError(copy.cameraCaptureError);
      return;
    }

    const file = new File([blob], `digestisnap-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
    setCameraSheetOpen(false);
    await runImageScan(file);
  };

  const getProfileUsernameCandidates = (baseValue: string, userId: string) => {
    const base = normalizeUsername(baseValue) || `user_${userId.slice(0, 6)}`;
    return [
      base,
      `${base}_${userId.slice(0, 4)}`,
      `${base}_${Math.random().toString(36).slice(2, 6)}`,
      `user_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    ].map((value) => normalizeUsername(value).slice(0, 24));
  };

  const saveProfileDetails = async () => {
    const nextName = normalizeProfileName(profileDraftName);
    const nextUsername = normalizeUsername(profileDraftUsername);

    if (!nextName) {
      setDashboardError('Name cannot be empty.');
      return;
    }

    if (nextUsername.length < 3) {
      setDashboardError('Username must be at least 3 characters.');
      return;
    }

    setProfileSaving(true);
    setDashboardError('');

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: session.user.id,
          full_name: nextName,
          username: nextUsername,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('user_id,full_name,username')
      .single<ProfileRow>();

    setProfileSaving(false);

    if (error || !data) {
      setDashboardError(error?.message?.includes('profiles_username_unique') ? 'That username is already taken.' : 'Unable to save profile.');
      return;
    }

    setProfileName(data.full_name);
    setProfileUsername(data.username);
    setProfileDraftName(data.full_name);
    setProfileDraftUsername(data.username);
    setProfileSheetOpen(false);
    setDashboardError('Profile saved.');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const deleteAccount = async () => {
    setDeleteLoading(true);
    setDashboardError('');

    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw error;
      await supabase.auth.signOut();
      navigate('/');
    } catch {
      setDashboardError(copy.deleteError);
      setDeleteLoading(false);
      setDeleteSheetOpen(false);
    }
  };

  const visibleLogs = logs.filter((item) => !/check-in saved|unreadable label|image check error|ai cooling|visual estimate unavailable|визуальная оценка недоступна/i.test(item.title));
  const hasActivity = visibleLogs.length > 0 || Boolean(scanResult && !isImageCheckErrorResult(scanResult.result));
  const isRussian = language === 'Russian';
  const scanCount = visibleLogs.length;
  const gutScoreOutOfTen = scanResult ? Math.max(1, Math.round(scanResult.result.score / 10)) : null;
  const latestTitle = scanResult?.result.productName ?? visibleLogs[0]?.title ?? '';
  const latestReason = scanResult?.result.flaggedChemicals[0]?.reason ?? '';
  const profileBmi = getBmiFromProfile(storedProfile);
  const today = new Date();
  const homeWeek = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + index);
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: String(date.getDate()),
      key: date.toDateString(),
      selected: date.toDateString() === selectedHomeDate,
      future: date > today,
    };
  });
  const checkInCount = logs.filter((item) => /check-in saved/i.test(item.title)).length;
  const latestScore = scanResult?.result.score ?? null;
  const latestRating = scanResult?.result.overallRating ?? null;
  const healthScoreBarColor =
    gutScoreOutOfTen === null
      ? 'bg-zinc-200'
      : gutScoreOutOfTen >= 7
        ? 'bg-emerald-500'
        : gutScoreOutOfTen >= 5
          ? 'bg-yellow-400'
          : 'bg-red-500';
  const healthScoreBarWidth = gutScoreOutOfTen === null ? '0%' : `${gutScoreOutOfTen * 10}%`;
  const healthScoreExplanation =
    gutScoreOutOfTen === null
      ? 'Track a couple foods to generate your health score'
      : 'Your health score reflects recent scan ratings and logged reactions';
  const waterCups = waterMl / 250;
  const waterOz = waterMl / 29.5735;
  const waterValue =
    waterUnit === 'cups'
      ? waterCups
      : waterUnit === 'oz'
        ? waterOz
        : waterMl;
  const waterValueLabel = waterValue % 1 === 0 ? String(waterValue) : waterValue.toFixed(1);
  const waterCardLabel = `${Math.round(waterOz)} fl oz (${Math.round(waterCups)} cups)`;
  const manualWaterNumber = Number(manualWaterAmount);
  const manualWaterMl =
    Number.isFinite(manualWaterNumber) && manualWaterNumber > 0
      ? waterUnit === 'cups'
        ? manualWaterNumber * 250
        : waterUnit === 'oz'
          ? manualWaterNumber * 29.5735
          : manualWaterNumber
      : 0;
  const waterQuickAdds: Record<WaterUnit, Array<{ label: string; amount: string; ml: number }>> = {
    cups: [
      { label: '+1 Glass', amount: '1 cup', ml: 250 },
      { label: '+1 Bottle', amount: '2 cups', ml: 500 },
      { label: '+1 Large Bottle', amount: '3 cups', ml: 750 },
    ],
    oz: [
      { label: '+1 Glass', amount: '8 oz', ml: 250 },
      { label: '+1 Bottle', amount: '16 oz', ml: 500 },
      { label: '+1 Large Bottle', amount: '24 oz', ml: 750 },
    ],
    ml: [
      { label: '+1 Glass', amount: '250 mL', ml: 250 },
      { label: '+1 Bottle', amount: '500 mL', ml: 500 },
      { label: '+1 Large Bottle', amount: '750 mL', ml: 750 },
    ],
  };
  const theme = {
    app: 'bg-white text-zinc-950',
    card: 'bg-white text-zinc-950 ring-black/[0.03]',
    soft: 'bg-zinc-100 text-zinc-950 ring-black/[0.03]',
    input: 'border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-zinc-950/15',
    muted: 'text-zinc-500',
    faint: 'text-zinc-400',
    line: 'border-zinc-200',
  };
  const copy = {
    aiResult: isRussian ? 'Результат AI' : 'AI result',
    verdict: isRussian ? 'Вердикт' : 'Verdict',
    score: isRussian ? 'балл' : 'score',
    noMajorFlags: isRussian ? 'Сильных сигналов нет' : 'No major flags',
    noMajorFlagsReason: isRussian
      ? 'DigestSnap не нашел сильный сигнал в этом скане.'
      : 'DigestSnap did not find a strong issue in this scan.',
    saveToTimeline: isRussian ? 'Сохранить самочувствие' : 'Save feeling',
    profileDetails: isRussian ? 'Профиль' : 'Profile details',
    name: isRussian ? 'Имя' : 'Name',
    username: isRussian ? 'Username' : 'Username',
    saveProfile: isRussian ? 'Сохранить профиль' : 'Save profile',
    language: isRussian ? 'Язык' : 'Language',
    english: isRussian ? 'Английский' : 'English',
    russian: isRussian ? 'Русский' : 'Russian',
    account: isRussian ? 'Аккаунт' : 'Account',
    accountProfile: isRussian ? 'Профиль аккаунта' : 'Account profile',
    personalDetails: isRussian ? 'Личные данные' : 'Personal Details',
    editGoals: isRussian ? 'Изменить цели' : 'Edit Goals',
    manageSubscription: isRussian ? 'Управление подпиской' : 'Manage Subscription',
    supportLegal: isRussian ? 'Поддержка и документы' : 'Support & Legal',
    contactSupport: isRussian ? 'Связаться с поддержкой' : 'Contact Support',
    privacyPolicy: isRussian ? 'Политика конфиденциальности' : 'Privacy Policy',
    terms: isRussian ? 'Условия использования' : 'Terms and Conditions',
    accountActions: isRussian ? 'Действия аккаунта' : 'Account Actions',
    logout: isRussian ? 'Выйти' : 'Logout',
    dayStreak: isRussian ? 'Дней подряд' : 'Day streak',
    streakHelp: isRussian ? 'Сохраняйте хотя бы одну запись за 24 часа' : 'Log once every 24 hours to keep it alive',
    logFood: isRussian ? 'Добавить еду' : 'Log food',
    logFoodHelp: isRussian ? 'Сделайте фото, и AI сохранит еду, время и оценку.' : 'Take a photo, and AI saves the food, time, and score.',
    takePhoto: isRussian ? 'Сделать фото' : 'Take photo',
    takePhotoHelp: isRussian ? 'AI проверит еду и сохранит результат.' : 'AI checks the food and saves the result.',
    fine: isRussian ? 'Норма' : 'Fine',
    bloated: isRussian ? 'Вздутие' : 'Bloated',
    pain: isRussian ? 'Боль' : 'Pain',
    nausea: isRussian ? 'Тошнота' : 'Nausea',
    deleteAccount: isRussian ? 'Удалить аккаунт' : 'Delete Account',
    deleteTitle: isRussian ? 'Удалить аккаунт?' : 'Delete account?',
    deleteBody: isRussian
      ? 'Это удалит ваш аккаунт и выйдет из DigestSnap на этом устройстве.'
      : 'This permanently deletes your account and signs you out of DigestSnap on this device.',
    cancel: isRussian ? 'Отмена' : 'Cancel',
    deleteConfirm: isRussian ? 'Удалить навсегда' : 'Delete permanently',
    deleteError: isRussian ? 'Не удалось удалить аккаунт. Попробуйте позже.' : 'Unable to delete account. Please try again.',
    saving: isRussian ? 'Сохранение...' : 'Saving...',
    deleting: isRussian ? 'Удаление...' : 'Deleting...',
    notScored: isRussian ? 'без оценки' : 'not scored',
    needsRetake: isRussian ? 'Нужно переснять' : 'Needs retake',
    imageNotChecked: isRussian ? 'Фото не проверено' : 'Image not checked',
    betterAlternative: isRussian ? 'Лучше заменить на' : 'Better alternative',
    selected: isRussian ? 'Выбрано' : 'Selected',
    feelingConnectEmpty: isRussian ? 'Выберите самочувствие, чтобы скан стал полезным паттерном позже' : 'Pick one feeling so this scan can become a useful pattern later.',
    analyzingImage: isRussian ? 'Анализируем фото...' : 'Analyzing image...',
    checkingContext: isRussian ? 'Проверяем состав и контекст...' : 'Checking portions and context...',
    savedRecent: isRussian ? 'Сохранено в последние сканы' : 'Saved to Recently uploaded',
    visualUnavailable: isRussian ? 'Визуальная оценка недоступна' : 'Saved with visual estimate unavailable',
    uploadedImage: isRussian ? 'загруженное фото' : 'uploaded image',
    cameraLoading: isRussian ? 'Камера еще загружается. Попробуйте через секунду.' : 'Camera is still loading. Try again in a second.',
    cameraCaptureError: isRussian ? 'Не удалось сделать снимок. Держите продукт внутри рамки.' : 'Unable to capture this frame. Try again with the label inside the square.',
    cameraTitle: isRussian ? 'Камера DigestSnap' : 'DigestSnap camera',
    cameraSubtitle: isRussian ? 'Заполните рамку продуктом или этикеткой' : 'Fill the square with the label',
    cameraHint: isRussian ? 'Держите состав четко и ровно' : 'Keep ingredients sharp and flat',
    cameraUnavailable: isRussian ? 'Камера недоступна' : 'Camera unavailable',
    aiCoolingDownTitle: isRussian ? 'AI временно занят' : 'AI cooling down',
    aiCoolingDownBody: isRussian ? 'Gemini временно ограничил запросы. Этот результат не добавлен в историю. Попробуйте еще раз через минуту' : 'Gemini temporarily rate-limited scans. This result was not added to history; try again in a minute',
  };
  const feelingLabel = (feeling: FeelingOption) => {
    if (feeling === 'Fine') return copy.fine;
    if (feeling === 'Bloated') return copy.bloated;
    if (feeling === 'Pain') return copy.pain;
    return copy.nausea;
  };
  const ratingLabel = (rating: ImageScanPayload['result']['overallRating']) => {
    if (!isRussian) return rating;
    if (rating === 'Safe') return 'Можно';
    if (rating === 'Avoid') return 'Избегать';
    return 'Осторожно';
  };
  const ratingTone = (rating: ImageScanPayload['result']['overallRating']) => {
    if (rating === 'Avoid') {
      return {
        block: 'bg-red-50 text-red-950 ring-red-200',
        badge: 'bg-red-600 text-white',
        circle: 'bg-red-600 text-white ring-red-200',
        bar: 'bg-red-600',
        muted: 'text-red-800/75',
        chip: 'bg-white text-red-950 ring-red-200',
      };
    }

    if (rating === 'Caution') {
      return {
        block: 'bg-amber-50 text-amber-950 ring-amber-200',
        badge: 'bg-amber-500 text-amber-950',
        circle: 'bg-amber-500 text-amber-950 ring-amber-200',
        bar: 'bg-amber-500',
        muted: 'text-amber-900/70',
        chip: 'bg-white text-amber-950 ring-amber-200',
      };
    }

    return {
      block: 'bg-emerald-50 text-emerald-950 ring-emerald-200',
      badge: 'bg-emerald-600 text-white',
      circle: 'bg-emerald-600 text-white ring-emerald-200',
      bar: 'bg-emerald-600',
      muted: 'text-emerald-900/70',
      chip: 'bg-white text-emerald-950 ring-emerald-200',
    };
  };
  const resultVibe = (result: ImageScanPayload['result']) => {
    if (isAiCoolingDownResult(result)) {
      return copy.aiCoolingDownBody;
    }

    if (isImageCheckErrorResult(result)) {
      return isRussian
        ? 'DigestSnap сохранил фото, но скан был недостаточно четким. Сделайте фото резче для точной оценки'
        : 'DigestSnap saved the image, but the scan was not clear enough to trust. Retake it sharper if you want the real read';
    }

    if (result.overallRating === 'Avoid') {
      return isRussian
        ? 'Лучше пропустить сейчас. В скане достаточно красных сигналов, которые могут плохо зайти желудку'
        : 'This is a skip for now. The scan has enough red flags that it is more likely to be a bad bet for your stomach';
    }

    if (result.overallRating === 'Caution') {
      return isRussian
        ? 'Не полный запрет, но и не чистая победа. Отметьте самочувствие позже и посмотрите, повторится ли сигнал'
        : 'Not an instant no, but do not treat it like a clean win. Log how you feel later and see if it keeps showing up';
    }

    return isRussian
      ? 'Выглядит нормально для повторения. Все равно отметьте самочувствие позже, чтобы DigestSnap учился по вашей реакции'
      : 'Looks solid enough to keep in rotation. Still check in later so DigestSnap learns your actual reaction';
  };
  const getBetterAlternative = (result: ImageScanPayload['result']) => {
    if (isImageCheckErrorResult(result)) return null;

    const name = result.productName.toLowerCase();
    const flagged = result.flaggedChemicals.map((item) => `${item.chemicalName} ${item.reason}`.toLowerCase()).join(' ');

    if (name.includes('soda') || name.includes('cola') || name.includes('fuse') || flagged.includes('sugar') || flagged.includes('sweetener')) {
      return {
        title: isRussian ? 'Вода с лимоном' : 'Sparkling water with lemon',
        reason: isRussian ? 'Меньше сахара и проще отследить повторный напиток' : 'Lower sugar and easier to log as a repeat drink pattern',
      };
    }

    if (name.includes('fried') || name.includes('burger') || name.includes('fries') || flagged.includes('oil')) {
      return {
        title: isRussian ? 'Гриль боул с рисом и соусом отдельно' : 'Grilled bowl with rice and sauce on the side',
        reason: isRussian ? 'Оставляет еду сытной, но снижает сигнал жарки и тяжелого соуса' : 'Keeps the meal filling while reducing fried oil and heavy sauce signals',
      };
    }

    if (name.includes('bread') || name.includes('pastry') || name.includes('cookie') || flagged.includes('flour')) {
      return {
        title: isRussian ? 'Йогурт с белком и ягодами' : 'Protein yogurt with berries',
        reason: isRussian ? 'Так же быстро, но дает более чистую базу, чем рафинированная мука' : 'Still quick, but gives DigestSnap a cleaner baseline than refined flour',
      };
    }

    if (name.includes('milk') || name.includes('cream') || name.includes('dairy') || flagged.includes('dairy')) {
      return {
        title: isRussian ? 'Безлактозный йогурт или овсяный вариант' : 'Lactose-free yogurt or oat-based option',
        reason: isRussian ? 'Мягкая замена, если молочное часто появляется перед дискомфортом' : 'A gentler swap if dairy keeps showing up before discomfort',
      };
    }

    return result.score >= 75
      ? {
          title: isRussian ? 'Оставьте это как базовый прием пищи' : 'Keep this as a baseline meal',
          reason: isRussian ? 'Полезная точка сравнения для будущих отметок самочувствия' : 'This looks like a useful comparison meal for future check-ins',
        }
      : {
          title: isRussian ? 'Простой боул из понятных продуктов' : 'Simple whole-food bowl',
          reason: isRussian ? 'Чем понятнее состав, тем легче доверять паттернам' : 'Choose a clearer ingredient list so patterns are easier to trust',
        };
  };
  const betterAlternative = scanResult ? getBetterAlternative(scanResult.result) : null;
  const isResultImageCheckError = scanResult ? isImageCheckErrorResult(scanResult.result) : false;
  const isResultAiCoolingDown = scanResult ? isAiCoolingDownResult(scanResult.result) : false;
  const resultTone = scanResult ? ratingTone(scanResult.result.overallRating) : ratingTone('Caution');
  const resultReasons = scanResult
    ? (scanResult.result.flaggedChemicals.length ? scanResult.result.flaggedChemicals : [
        {
          chemicalName: copy.noMajorFlags,
          severity: scanResult.result.overallRating,
          reason: copy.noMajorFlagsReason,
        },
      ]).slice(0, 3)
    : [];
  const cardClass = cn('rounded-[22px] bg-white p-4 shadow-[0_10px_26px_rgba(15,15,15,0.075)] ring-1 ring-black/[0.03] transition-colors duration-700 sm:rounded-[24px] sm:p-5 sm:shadow-[0_14px_32px_rgba(15,15,15,0.10)]', isDarkMode && theme.card);
  const normalizedStreak = normalizeStreak(streak);
  const activeStreak = normalizedStreak.count;
  const maxStreak = normalizedStreak.maxCount;
  const daysSinceLastLog = normalizedStreak.lastLoggedAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(normalizedStreak.lastLoggedAt)) / ONE_DAY_MS))
    : 0;
  const openProfileEditor = () => {
    setProfileDraftName(profileName);
    setProfileDraftUsername(profileUsername);
    setProfileSheetOpen(true);
  };
  const openGoalsEditor = () => {
    const latestProfile = readStoredProfile(session.user.id) ?? storedProfile ?? goalDraft;
    setGoalDraft(latestProfile);
    setGoalsSheetOpen(true);
  };
  const updateGoalDraftList = (key: 'allergies' | 'symptoms' | 'triggers', value: string) => {
    setGoalDraft((current) => ({
      ...current,
      [key]: value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    }));
  };
  const saveGoalDetails = () => {
    try {
      window.localStorage.setItem(profileStorageKey(session.user.id), JSON.stringify(goalDraft));
    } catch {
      // Keep the in-memory draft if local storage is unavailable.
    }
    setStoredProfile(goalDraft);
    setGoalsSheetOpen(false);
  };
  const progressPage = (
    <div className="mx-auto min-h-full w-full max-w-[430px] space-y-3.5 pb-6 pt-[max(16px,env(safe-area-inset-top))] sm:max-w-[620px] sm:space-y-4 sm:pt-[max(28px,env(safe-area-inset-top))] lg:max-w-[980px]">
      <div className="flex items-center justify-between px-0 sm:px-1">
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-black transition active:scale-95 sm:h-11 sm:w-11" onClick={() => setActiveTab('home')} type="button" aria-label="Back to home">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[28px] font-black leading-none sm:text-[33px]">{isRussian ? 'Прогресс' : 'Progress'}</h1>
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-black transition active:scale-95 sm:h-11 sm:w-11" onClick={() => setActiveTab('profile')} type="button" aria-label="Open profile">
          <CircleUserRound className="h-8 w-8 stroke-[2.4] sm:h-9 sm:w-9" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[
          ['Current streak', String(activeStreak), 'days', Flame],
          ['Best streak', String(maxStreak), 'max', Target],
          ['Scans', String(scanCount), 'saved', ScanLine],
          ['Last log', normalizedStreak.lastLoggedAt ? (daysSinceLastLog === 0 ? 'Today' : `${daysSinceLastLog}d ago`) : 'None', 'activity', Activity],
        ].map(([label, value, helper, Icon]) => (
          <div
            className={cn(
              'min-h-[104px] rounded-[22px] bg-white p-4 text-left text-zinc-950 shadow-[0_10px_26px_rgba(15,15,15,0.075)] ring-1 ring-black/[0.03] transition-colors duration-700 sm:min-h-[126px] sm:rounded-[24px] sm:p-5 sm:shadow-[0_14px_32px_rgba(15,15,15,0.10)]',
              isDarkMode && theme.card,
            )}
            key={String(label)}
          >
            <Icon className="h-5 w-5 opacity-70 sm:h-6 sm:w-6" />
            <p className="mt-4 text-2xl font-black sm:mt-5 sm:text-3xl">{value as string}</p>
            <p className="mt-1 text-xs font-black opacity-70 sm:text-sm">{label as string}</p>
            <p className="mt-1 text-xs font-semibold opacity-45">{helper as string}</p>
          </div>
        ))}
      </div>

      {hasActivity && (
        <>
          <div className={cn(cardClass, 'overflow-hidden')}>
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <p className={cn('text-xs font-black uppercase tracking-[0.16em]', theme.faint)}>
                  {isRussian ? 'Последний скан' : 'Latest scan'}
                </p>
                <h2 className="mt-3 text-3xl font-black leading-none">
                  {latestTitle || (isRussian ? 'Скан сохранен' : 'Scan saved')}
                </h2>
                <p className={cn('mt-3 text-sm font-semibold leading-6', theme.muted)}>
                  {latestReason || (isRussian ? 'Этот скан теперь в вашем таймлайне.' : 'This scan is now saved in your timeline.')}
                </p>
              </div>
              <div className={cn('flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full ring-1', isDarkMode ? 'bg-white/[0.06] ring-white/10' : 'bg-zinc-100 ring-black/[0.03]')}>
                <span className="text-3xl font-black">{gutScoreOutOfTen}</span>
                <span className={cn('text-[10px] font-black uppercase tracking-[0.12em]', theme.faint)}>{isRussian ? 'балл' : 'score'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[
              [isRussian ? 'Сканы' : 'Scans', String(scanCount), isRussian ? 'сохранено' : 'saved', ScanLine],
              [isRussian ? 'Самочувствие' : 'Check-ins', String(checkInCount), isRussian ? 'отмечено' : 'saved', Activity],
              [isRussian ? 'Последний' : 'Latest', latestRating ?? 'None', isRussian ? 'результат' : 'result', Target],
              [isRussian ? 'BMI' : 'BMI', profileBmi?.display ?? '--', isRussian ? 'из профиля' : 'from setup', Flame],
            ].map(([label, value, helper, Icon]) => (
              <div
                className={cn(
                  'min-h-[106px] rounded-[22px] bg-white p-4 text-left text-zinc-950 shadow-[0_10px_26px_rgba(15,15,15,0.075)] ring-1 ring-black/[0.03] transition-colors duration-700 sm:min-h-[130px] sm:rounded-[24px] sm:p-5 sm:shadow-[0_14px_32px_rgba(15,15,15,0.10)]',
                  isDarkMode && theme.card,
                )}
                key={String(label)}
              >
                <Icon className="h-5 w-5 opacity-70 sm:h-6 sm:w-6" />
                <p className="mt-4 text-2xl font-black sm:mt-5 sm:text-3xl">{value as string}</p>
                <p className="mt-1 text-xs font-black opacity-70 sm:text-sm">{label as string}</p>
                <p className="mt-1 text-xs font-semibold opacity-45">{helper as string}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black">{isRussian ? 'Таймлайн' : 'Timeline'}</h2>
          <span className={cn('rounded-full px-3 py-1.5 text-xs font-black', theme.soft)}>{String(scanCount)}</span>
        </div>

        <div className="mt-5 space-y-3">
          {visibleLogs.length > 0 ? visibleLogs.slice(0, 5).map((item) => (
            <article
              className={cn('flex min-h-[64px] w-full items-center gap-4 rounded-[20px] px-4 text-left', theme.soft)}
              key={item.id}
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', isDarkMode ? 'bg-white text-zinc-950' : 'bg-white text-zinc-950')}>
                <Camera className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">{item.title}</span>
                <span className={cn('mt-1 block text-xs font-semibold', theme.muted)}>{new Date(item.created_at).toLocaleDateString()}</span>
              </span>
            </article>
          )) : (
            <div className={cn('rounded-[24px] p-5 text-center', theme.soft)}>
              <ScanLine className={cn('mx-auto h-8 w-8', theme.muted)} />
              <p className="mt-3 text-base font-black">{isRussian ? 'Пусто' : 'Empty'}</p>
            </div>
          )}
        </div>
      </div>

      <div className={cn(cardClass, 'overflow-hidden')}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={cn('text-xs font-black uppercase tracking-[0.16em]', theme.faint)}>{isRussian ? 'Вес' : 'Weight progress'}</p>
            <h2 className="mt-3 text-2xl font-black leading-none sm:text-3xl">
              {storedProfile ? `${storedProfile.weightKg} kg` : '--'}
            </h2>
            <p className={cn('mt-3 text-sm font-semibold leading-6', theme.muted)}>
              {profileBmi
                ? (isRussian ? 'Рассчитано из роста и веса, которые вы указали в настройке.' : `BMI ${profileBmi.display} · ${profileBmi.range}`)
                : (isRussian ? 'Заполните рост и вес в настройке, чтобы увидеть BMI.' : 'Finish setup with height and weight to unlock your baseline')}
            </p>
          </div>
          <div className={cn('flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full ring-1 sm:h-24 sm:w-24', isDarkMode ? 'bg-white/[0.06] ring-white/10' : 'bg-zinc-100 ring-black/[0.03]')}>
            <span className="text-2xl font-black sm:text-3xl">{profileBmi?.display ?? '--'}</span>
            <span className={cn('text-[10px] font-black uppercase tracking-[0.12em]', theme.faint)}>{profileBmi?.category ?? (isRussian ? 'нет' : 'none')}</span>
          </div>
        </div>

        <div className="relative mt-7">
          <div className="h-4 overflow-hidden rounded-full bg-[linear-gradient(90deg,#60a5fa_0%,#818cf8_34%,#f59e0b_68%,#ef4444_100%)] opacity-90" />
          <div
            className={cn(
              'absolute top-1/2 h-8 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.92)] transition-all duration-500',
              isDarkMode ? 'bg-white' : 'bg-black',
            )}
            style={{ left: `${profileBmi?.pointer ?? 0}%` }}
          />
        </div>
        <div className={cn('mt-3 flex justify-between text-[11px] font-black', theme.faint)}>
          <span>15</span>
          <span>18.5</span>
          <span>25</span>
          <span>30</span>
          <span>40</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['Underweight', 'Balanced', 'Elevated', 'High'] as BmiCategory[]).map((label) => (
            <div
              className={cn(
                'rounded-[16px] px-2 py-3 text-center text-[11px] font-black transition-colors',
                profileBmi?.category === label
                  ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-950/10'
                  : theme.soft,
              )}
              key={label}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const profileRows = [
    { label: copy.personalDetails, icon: ClipboardList, action: openProfileEditor },
    { label: copy.editGoals, icon: Target, action: openGoalsEditor },
    { label: copy.manageSubscription, icon: ShieldCheck, action: () => navigate('/manage-subscription') },
  ];
  const supportRows = [
    { label: copy.contactSupport, icon: Mail, action: () => navigate('/support') },
    { label: copy.privacyPolicy, icon: ShieldCheck, action: () => navigate('/privacy') },
    { label: copy.terms, icon: ClipboardList, action: () => navigate('/terms') },
  ];
  const renderRow = ({ label, icon: Icon, action }: { label: string; icon: typeof Home; action: () => void }) => (
    <button className={cn('flex min-h-[60px] w-full items-center gap-3 border-b px-4 text-left last:border-b-0 transition active:scale-[0.99] sm:min-h-[66px] sm:gap-4 sm:px-5', theme.line)} key={label} onClick={action} type="button">
      <Icon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
      <span className="min-w-0 flex-1 text-lg font-black sm:text-xl">{label}</span>
      <ChevronRight className={cn('h-5 w-5 shrink-0 sm:h-6 sm:w-6', theme.muted)} />
    </button>
  );
  const profilePage = (
    <div className="mx-auto min-h-full w-full max-w-[430px] space-y-3.5 pb-6 pt-[max(16px,env(safe-area-inset-top))] sm:max-w-[620px] sm:space-y-4 sm:pt-[max(28px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between px-0 sm:px-1">
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-black transition active:scale-95 sm:h-11 sm:w-11" onClick={() => setActiveTab('home')} type="button" aria-label="Back to home">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[28px] font-black leading-none sm:text-[33px]">{copy.profileDetails}</h1>
        <div className="h-10 w-10 sm:h-11 sm:w-11" />
      </div>
      <button className={cn(cardClass, 'flex w-full items-center gap-4 text-left transition active:scale-[0.99] sm:gap-5')} onClick={openProfileEditor} type="button">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 shadow-inner ring-1 ring-zinc-950/10 sm:h-20 sm:w-20">
          <User className="h-7 w-7 sm:h-9 sm:w-9" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-black', theme.muted)}>{copy.accountProfile}</p>
          <p className="truncate text-xl font-black sm:text-2xl">{profileName}</p>
          <p className={cn('truncate text-base font-bold sm:text-lg', theme.muted)}>@{profileUsername}</p>
        </div>
        <ChevronRight className={cn('h-6 w-6 sm:h-7 sm:w-7', theme.muted)} />
      </button>

      <div className={cn(cardClass, 'flex items-center justify-between gap-5')}>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-[26px] shadow-inner sm:h-16 sm:w-16 sm:text-[30px]">
            🔥
          </div>
          <div>
            <p className="text-xl font-black sm:text-2xl">{activeStreak}</p>
            <p className={cn('text-sm font-black', theme.muted)}>{copy.dayStreak}</p>
          </div>
        </div>
        <p className={cn('max-w-[150px] text-right text-[11px] font-semibold leading-4 sm:max-w-[180px] sm:text-xs sm:leading-5', theme.muted)}>
          {copy.streakHelp}
        </p>
      </div>

      <div className={cn(cardClass, 'space-y-3')}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg font-black sm:text-xl">{copy.language}</p>
          <p className={cn('text-sm font-black', theme.muted)}>{language === 'Russian' ? copy.russian : copy.english}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-zinc-100 p-1.5">
          {(['English', 'Russian'] as AppLanguage[]).map((option) => {
            const active = language === option;
            return (
              <button
                className={cn('h-12 rounded-[16px] text-sm font-black transition active:scale-[0.98]', active ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500')}
                key={option}
                onClick={() => setLanguage(option)}
                type="button"
              >
                {option === 'Russian' ? copy.russian : copy.english}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={cn('mb-3 text-[15px] font-black uppercase tracking-[0.12em]', theme.muted)}>{copy.account}</p>
        <div className={cn('overflow-hidden rounded-[24px] bg-white shadow-[0_14px_32px_rgba(15,15,15,0.10)] ring-1 ring-black/[0.03] transition-colors duration-700', isDarkMode && theme.card)}>
          {profileRows.map(renderRow)}
        </div>
      </div>

      <div>
        <p className={cn('mb-3 text-[15px] font-black uppercase tracking-[0.12em]', theme.muted)}>{copy.supportLegal}</p>
        <div className={cn('overflow-hidden rounded-[24px] bg-white shadow-[0_14px_32px_rgba(15,15,15,0.10)] ring-1 ring-black/[0.03] transition-colors duration-700', isDarkMode && theme.card)}>
          {supportRows.map(renderRow)}
        </div>
      </div>

      <div>
        <p className={cn('mb-3 text-[15px] font-black uppercase tracking-[0.12em]', theme.muted)}>{copy.accountActions}</p>
        <div className={cn('overflow-hidden rounded-[24px] bg-white shadow-[0_14px_32px_rgba(15,15,15,0.10)] ring-1 ring-black/[0.03] transition-colors duration-700', isDarkMode && theme.card)}>
          <button className={cn('flex min-h-[60px] w-full items-center gap-3 border-b px-4 text-left transition active:scale-[0.99] sm:min-h-[66px] sm:gap-4 sm:px-5', theme.line)} onClick={signOut} type="button">
            <LogOut className="h-6 w-6" />
            <span className="flex-1 text-lg font-black sm:text-xl">{copy.logout}</span>
            <ChevronRight className={cn('h-6 w-6', theme.muted)} />
          </button>
          <button className="flex min-h-[60px] w-full items-center gap-3 px-4 text-left text-red-400 transition active:scale-[0.99] sm:min-h-[66px] sm:gap-4 sm:px-5" onClick={() => setDeleteSheetOpen(true)} type="button">
            <AlertCircle className="h-6 w-6" />
            <span className="flex-1 text-lg font-black sm:text-xl">{copy.deleteAccount}</span>
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AppFrame darkMode={false} fullScreen>
      <div className={cn('relative flex h-full w-full min-w-0 flex-col overflow-hidden px-[clamp(12px,4vw,24px)] pb-0 pt-0 transition-colors duration-700 lg:px-8 xl:px-10 2xl:px-12', theme.app)}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-[-220px] h-[560px] w-[960px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.96)_0%,rgba(245,240,248,0.92)_34%,rgba(230,223,236,0.40)_58%,transparent_76%)] blur-3xl" />
          <div className="absolute bottom-[-260px] left-[-180px] h-[520px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.88)_0%,rgba(233,228,238,0.52)_52%,transparent_76%)] blur-3xl" />
          <div className="absolute bottom-[-220px] right-[-140px] h-[520px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.82)_0%,rgba(226,222,232,0.46)_50%,transparent_74%)] blur-3xl" />
        </div>

        <div className={cn('relative z-10 mx-auto min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', activeTab === 'home' ? 'max-w-[430px] pb-28 pt-0 sm:max-w-[620px] lg:max-w-[1040px] xl:max-w-[1120px]' : 'max-w-[430px] pb-28 pt-0 sm:max-w-[620px] lg:max-w-[980px]')}>
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              className="min-h-full"
              exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
              initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
              key={activeTab}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeTab === 'home' && (
              <div className="min-h-full pb-6 pt-[max(14px,env(safe-area-inset-top))] sm:pt-[max(22px,env(safe-area-inset-top))]">
                <div className="flex items-center justify-between px-0 sm:px-1 lg:mx-auto lg:max-w-[1040px]">
                  <button
                    aria-label="Open profile"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-black transition hover:bg-white/70 active:scale-95 sm:h-11 sm:w-11"
                    onClick={() => setActiveTab('profile')}
                    type="button"
                  >
                    <CircleUserRound className="h-8 w-8 stroke-[2.4] sm:h-9 sm:w-9" />
                  </button>
                  <div className="text-center">
                    <h1 className="text-[29px] font-black leading-none sm:text-[33px] md:text-[38px]">DigestSnap</h1>
                  </div>
                  <div className="h-10 w-10 sm:h-11 sm:w-11" />
                </div>

                <div className="mx-auto mt-5 grid max-w-[520px] grid-cols-7 px-0 text-center sm:mt-7 lg:max-w-[680px]">
                  {homeWeek.map(({ day, date, key, selected, future }) => (
                    <button
                      className="flex min-h-[58px] flex-col items-center gap-2 rounded-[16px] transition hover:bg-white/60 active:scale-[0.97] sm:min-h-[72px] sm:gap-3"
                      key={`${day}-${date}`}
                      onClick={() => setSelectedHomeDate(key)}
                      type="button"
                    >
                      <span className="text-[12px] font-black sm:text-[15px] md:text-[16px]">{day}</span>
                      <span className={cn('flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-black sm:h-9 sm:w-9 sm:text-[16px] md:h-10 md:w-10 md:text-[18px]', selected ? 'bg-white text-zinc-950 shadow-[0_10px_24px_rgba(15,15,15,0.10)] ring-1 ring-zinc-950/10' : future ? 'text-zinc-400' : 'text-black')}>
                        {date}
                      </span>
                    </button>
                  ))}
                </div>

                  <div className="mx-auto mt-5 w-full max-w-[430px] space-y-3.5 sm:mt-8 sm:max-w-[620px] sm:space-y-5 lg:max-w-[1040px] xl:max-w-[1120px]">
                  <div className="w-full rounded-[28px] bg-white px-5 py-5 text-center shadow-[0_10px_30px_rgba(15,15,15,0.055)] ring-1 ring-black/[0.05] sm:rounded-[34px] sm:px-6 sm:py-8 md:px-10 md:py-10">
                    <div className="mx-auto flex h-[78px] w-[78px] items-center justify-center rounded-full bg-zinc-100 shadow-inner sm:h-[104px] sm:w-[104px]">
                      <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white shadow-inner sm:h-[76px] sm:w-[76px]">
                        <Camera className="h-6 w-6 text-black sm:h-8 sm:w-8" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-center gap-1 sm:mt-6">
                      <span className="text-[42px] font-black leading-none tracking-normal sm:text-[52px] md:text-[68px]">{latestScore ?? 'Ready'}</span>
                      {latestScore !== null && <span className="pb-2 text-[25px] font-black text-zinc-400">/100</span>}
                    </div>
                    <p className="mx-auto mt-2 max-w-[520px] text-[13px] font-black leading-5 text-zinc-500 sm:mt-3 sm:text-[15px] sm:leading-6 md:text-base">
                      {latestScore !== null ? latestRating : 'Your first scan will start your food timeline'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:gap-5">
                    <div className="min-w-0 rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(15,15,15,0.055)] ring-1 ring-black/[0.05] sm:rounded-[28px] sm:p-5 md:p-7">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[16px] font-black sm:text-[20px] md:text-[24px]">Health score</p>
                          <p className="mt-2 text-[25px] font-black leading-none sm:text-[30px] md:text-[36px]">
                            {latestScore !== null ? `${gutScoreOutOfTen}/10` : 'N/A'}
                          </p>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 sm:mt-4 sm:h-2.5">
                            <div
                              className={cn('h-full rounded-full transition-all duration-500', healthScoreBarColor)}
                              style={{ width: healthScoreBarWidth }}
                            />
                          </div>
                          <p className="mt-2 text-[11px] font-semibold leading-4 text-zinc-500 sm:mt-3 sm:text-[12px] sm:leading-5 md:text-[13px]">
                            {healthScoreExplanation}
                          </p>
                        </div>
                        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 sm:flex">
                          <Activity className="h-5 w-5 text-black" />
                        </span>
                      </div>
                    </div>

                    <button
                      className="min-w-0 rounded-[24px] bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,15,15,0.055)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 active:scale-[0.99] sm:rounded-[28px] sm:p-5 md:p-7"
                      onClick={() => setWaterSheetOpen(true)}
                      type="button"
                    >
                      <div className="flex h-full flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div className="min-w-0">
                          <p className="text-[16px] font-black text-zinc-500 sm:text-[20px] md:text-[24px]">
                            <span className="mb-1 block text-[20px] leading-none sm:text-[24px]">💧</span>
                            Water intake
                          </p>
                          <p className="mt-2 truncate text-[22px] font-black leading-none sm:text-[26px] md:text-[34px]">{waterCardLabel}</p>
                        </div>
                        <span className="w-fit shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black shadow-sm ring-1 ring-zinc-950/10 sm:px-4 sm:py-3 sm:text-sm">
                          Log Water
                        </span>
                      </div>
                    </button>
                  </div>

                  <button
                    className="group flex w-full items-center rounded-[22px] bg-white px-4 py-3.5 text-left shadow-[0_7px_20px_rgba(15,15,15,0.045)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 hover:bg-white active:scale-[0.99] sm:rounded-[24px] sm:px-5 sm:py-4 md:px-7 md:py-5"
                    onClick={() => setActiveTab('progress')}
                    type="button"
                  >
                    <div className="flex w-full items-center justify-between gap-4">
                      <div>
                        <p className="text-[18px] font-black sm:text-[22px] md:text-[26px]">My progress</p>
                        <p className="mt-1 text-[12px] font-semibold leading-4 text-zinc-500 sm:text-[13px] sm:leading-5 md:text-sm">Timeline, streak, and weight</p>
                      </div>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 transition group-hover:scale-105 sm:h-11 sm:w-11">
                        {hasActivity ? <BarChart3 className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </span>
                    </div>
                  </button>

                  <section className="pt-1 sm:pt-2">
                    <h2 className="text-[23px] font-black leading-none sm:text-[28px] md:text-[34px]">Recently uploaded</h2>

                    {scanState === 'scanning' && scanPreviewUrl ? (
                      <div className="mt-3 rounded-[24px] bg-white p-4 shadow-[0_10px_28px_rgba(15,15,15,0.06)] ring-1 ring-black/[0.05] sm:mt-5 sm:rounded-[28px] sm:p-5">
                        <div className="flex items-center gap-4">
                          <img
                            alt="Meal being analyzed"
                            className="h-20 w-20 shrink-0 rounded-[22px] object-cover blur-[2px]"
                            src={scanPreviewUrl}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-[18px] font-black">{scanProgress}% progress</p>
                              <p className="text-xs font-black text-zinc-400">{scanProgressText}</p>
                            </div>
                            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100">
                              <div
                                className="h-full rounded-full bg-black transition-all duration-300"
                                style={{ width: `${scanProgress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : recentScans.length > 0 ? (
                      <div className="mt-3 space-y-2.5 sm:mt-5 sm:space-y-3">
                        {recentScans.slice(0, 10).map((item) => (
                          <button
                            className="flex w-full items-center gap-3 rounded-[24px] bg-white p-3.5 text-left shadow-[0_10px_28px_rgba(15,15,15,0.055)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 active:scale-[0.99] sm:gap-4 sm:rounded-[28px] sm:p-4"
                            key={item.id}
                            onClick={() => {
                              setScanResult({ result: item.result });
                              setScanPreviewUrl(item.imageDataUrl);
                              setResultSheetOpen(true);
                            }}
                            type="button"
                          >
                          <img
                            alt={item.result.productName}
                            className="h-16 w-16 shrink-0 rounded-[18px] object-cover sm:h-20 sm:w-20 sm:rounded-[22px]"
                            src={item.imageDataUrl}
                          />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[16px] font-black sm:text-[18px]">{item.result.productName}</p>
                              <p className="mt-1 text-xs font-semibold leading-4 text-zinc-500 sm:text-sm sm:leading-5">
                                {isImageCheckErrorResult(item.result) ? 'Needs retake · not scored' : `${item.result.overallRating} · ${item.result.score}/100`}
                              </p>
                              <p className="mt-1 line-clamp-1 text-xs font-semibold text-zinc-400">
                                {item.result.flaggedChemicals[0]?.reason ?? 'Saved with scan context'}
                              </p>
                            </div>
                            <ChevronRight className="h-6 w-6 shrink-0 text-zinc-400" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-[24px] bg-[#f7f6fb] p-4 text-center shadow-[0_10px_28px_rgba(15,15,15,0.045)] ring-1 ring-black/[0.05] sm:mt-5 sm:rounded-[28px] sm:p-5">
                        <div className="mx-auto max-w-[560px] rounded-[22px] bg-white p-3.5 shadow-[0_12px_28px_rgba(15,15,15,0.06)] sm:rounded-[24px] sm:p-4">
                          <div className="flex items-center gap-4">
                            <img
                              alt="Example bowl"
                              className="h-16 w-16 shrink-0 rounded-full object-cover"
                              src="https://images.unsplash.com/photo-1546793665-c74683f339c1?q=80&w=500&auto=format&fit=crop"
                            />
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="h-3 w-full rounded-full bg-zinc-200" />
                              <div className="h-3 w-2/3 rounded-full bg-zinc-200" />
                            </div>
                          </div>
                        </div>
                        <p className="mt-4 text-[17px] font-black text-zinc-500 sm:mt-6 sm:text-[22px]">Tap + to add your first meal of the day</p>
                      </div>
                    )}
                  </section>
                </div>

              </div>
              )}
              {activeTab === 'progress' && progressPage}
              {activeTab === 'profile' && profilePage}

            </motion.div>
          </AnimatePresence>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-5 pb-[max(18px,env(safe-area-inset-bottom))] sm:pb-[max(22px,env(safe-area-inset-bottom))]">
          <button
            aria-label={copy.logFood}
            className="pointer-events-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-black text-white shadow-[0_18px_40px_rgba(15,15,15,0.24)] ring-1 ring-black transition hover:-translate-y-1 active:scale-95 sm:h-[82px] sm:w-[82px] sm:shadow-[0_22px_48px_rgba(15,15,15,0.28)]"
            onClick={openCamera}
            type="button"
          >
            <Plus className="h-10 w-10 stroke-[1.9] sm:h-12 sm:w-12" />
          </button>
        </div>

        <AnimatePresence>
          {cameraSheetOpen && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex flex-col bg-black text-white"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
            >
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <video
                  autoPlay
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  ref={videoRef}
                />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-5 pb-12 pt-[max(18px,env(safe-area-inset-top))]">
                  <button
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12 backdrop-blur-xl transition active:scale-95"
                    onClick={() => setCameraSheetOpen(false)}
                    type="button"
                    aria-label="Close camera"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="text-center">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">{copy.cameraTitle}</p>
                    <p className="mt-1 text-sm font-black">{copy.cameraSubtitle}</p>
                  </div>
                  <div aria-hidden className="h-12 w-12" />
                </div>

                <div className="pointer-events-none absolute inset-x-6 top-1/2 aspect-square -translate-y-1/2 rounded-[30px] border-2 border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,0.22)] sm:inset-x-10 sm:rounded-[34px]">
                  <div className="absolute inset-x-4 top-4 rounded-full bg-black/38 px-3 py-2 text-center text-[11px] font-black backdrop-blur-md sm:inset-x-5 sm:top-5 sm:px-4 sm:text-xs">
                    {copy.cameraHint}
                  </div>
                </div>

                {cameraError && (
                  <div className="absolute inset-x-5 top-28 rounded-[22px] bg-white p-4 text-zinc-950 shadow-2xl">
                    <p className="text-sm font-black">{copy.cameraUnavailable}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">{cameraError}</p>
                  </div>
                )}
              </div>

              <div className="shrink-0 bg-black px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
                <div className="mx-auto flex max-w-[420px] items-center justify-center">
                  <button
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-zinc-950 shadow-[0_0_0_8px_rgba(255,255,255,0.16)] transition active:scale-95"
                    onClick={captureCameraFrame}
                    type="button"
                    aria-label="Capture food photo"
                  >
                    <Camera className="h-9 w-9 stroke-[2.8]" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {profileSheetOpen && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-end justify-center bg-black/55 px-[clamp(12px,4vw,20px)] pb-[max(18px,env(safe-area-inset-bottom))] sm:pb-[max(22px,env(safe-area-inset-bottom))]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setProfileSheetOpen(false)}
            >
              <motion.div
                animate={{ y: 0 }}
                className={cn('w-full max-w-[430px] rounded-[28px] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ring-1 sm:rounded-[32px] sm:p-5', theme.card)}
                exit={{ y: 24 }}
                initial={{ y: 24 }}
                onClick={(event) => event.stopPropagation()}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-[22px] font-black sm:text-2xl">{copy.profileDetails}</p>
                <label className="mt-5 block">
                  <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{copy.name}</span>
                  <input
                    className={cn('mt-2 h-[52px] w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2 sm:h-14', theme.input)}
                    placeholder={copy.name}
                    onChange={(event) => setProfileDraftName(event.target.value)}
                    value={profileDraftName}
                  />
                </label>
                <label className="mt-4 block">
                  <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{copy.username}</span>
                  <input
                    className={cn('mt-2 h-[52px] w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2 sm:h-14', theme.input)}
                    placeholder="username"
                    onChange={(event) => setProfileDraftUsername(normalizeUsername(event.target.value))}
                    value={profileDraftUsername}
                  />
                  <span className={cn('mt-2 block text-xs font-semibold', theme.muted)}>Unique. 3-24 characters. Letters, numbers, underscore.</span>
                </label>
                <button
                  className="mt-5 h-14 w-full rounded-full bg-white text-base font-black text-zinc-950 shadow-[0_14px_30px_rgba(15,15,15,0.10)] ring-1 ring-zinc-950/10 transition active:scale-[0.98] disabled:opacity-50"
                  disabled={profileSaving}
                  onClick={saveProfileDetails}
                  type="button"
                >
                  {profileSaving ? copy.saving : copy.saveProfile}
                </button>
              </motion.div>
            </motion.div>
          )}

          {goalsSheetOpen && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-end justify-center bg-black/55 px-[clamp(12px,4vw,20px)] pb-[max(18px,env(safe-area-inset-bottom))] sm:pb-[max(22px,env(safe-area-inset-bottom))]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setGoalsSheetOpen(false)}
            >
              <motion.div
                animate={{ y: 0 }}
                className={cn('max-h-[86vh] w-full max-w-[430px] overflow-y-auto rounded-[28px] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ring-1 [scrollbar-width:none] sm:rounded-[32px] sm:p-5 [&::-webkit-scrollbar]:hidden', theme.card)}
                exit={{ y: 24 }}
                initial={{ y: 24 }}
                onClick={(event) => event.stopPropagation()}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-[22px] font-black sm:text-2xl">Edit goals</p>
                <p className={cn('mt-2 text-sm font-semibold leading-6', theme.muted)}>Update the setup data DigestSnap uses for scans</p>

                <div className="mt-5 grid gap-4">
                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>Main goal</span>
                    <select
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      onChange={(event) => setGoalDraft((current) => ({ ...current, goal: event.target.value as SensiGoal }))}
                      value={goalDraft.goal}
                    >
                      <option>Find triggers</option>
                      <option>Reduce bloating</option>
                      <option>Build consistency</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>Diet type</span>
                    <input
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      onChange={(event) => setGoalDraft((current) => ({ ...current, dietType: event.target.value }))}
                      value={goalDraft.dietType}
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <label className="block">
                      <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>Age</span>
                      <input
                        className={cn('mt-2 h-[52px] w-full rounded-[16px] border px-2.5 text-base font-bold outline-none transition focus:ring-2 sm:h-14 sm:rounded-[18px] sm:px-3', theme.input)}
                        inputMode="numeric"
                        onChange={(event) => setGoalDraft((current) => ({ ...current, age: Number(event.target.value) }))}
                        type="number"
                        value={goalDraft.age}
                      />
                    </label>
                    <label className="block">
                      <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>Height</span>
                      <input
                        className={cn('mt-2 h-[52px] w-full rounded-[16px] border px-2.5 text-base font-bold outline-none transition focus:ring-2 sm:h-14 sm:rounded-[18px] sm:px-3', theme.input)}
                        inputMode="numeric"
                        onChange={(event) => setGoalDraft((current) => ({ ...current, heightCm: Number(event.target.value) }))}
                        type="number"
                        value={goalDraft.heightCm}
                      />
                    </label>
                    <label className="block">
                      <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>Weight</span>
                      <input
                        className={cn('mt-2 h-[52px] w-full rounded-[16px] border px-2.5 text-base font-bold outline-none transition focus:ring-2 sm:h-14 sm:rounded-[18px] sm:px-3', theme.input)}
                        inputMode="decimal"
                        onChange={(event) => setGoalDraft((current) => ({ ...current, weightKg: Number(event.target.value) }))}
                        type="number"
                        value={goalDraft.weightKg}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>Symptoms</span>
                    <input
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      onChange={(event) => updateGoalDraftList('symptoms', event.target.value)}
                      placeholder="Bloated, nausea"
                      value={goalDraft.symptoms.join(', ')}
                    />
                  </label>

                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>Suspected foods</span>
                    <input
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      onChange={(event) => updateGoalDraftList('triggers', event.target.value)}
                      placeholder="Dairy, bread, fried food"
                      value={goalDraft.triggers.join(', ')}
                    />
                  </label>

                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>Allergies / avoids</span>
                    <input
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      onChange={(event) => updateGoalDraftList('allergies', event.target.value)}
                      placeholder="Gluten, lactose"
                      value={goalDraft.allergies.join(', ')}
                    />
                  </label>

                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>Daily check-ins</span>
                    <input
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      inputMode="numeric"
                      max={6}
                      min={1}
                      onChange={(event) => setGoalDraft((current) => ({ ...current, checkInsPerDay: Number(event.target.value) }))}
                      type="number"
                      value={goalDraft.checkInsPerDay}
                    />
                  </label>
                </div>

                <button
                  className="mt-5 h-14 w-full rounded-full bg-white text-base font-black text-zinc-950 shadow-[0_14px_30px_rgba(15,15,15,0.10)] ring-1 ring-zinc-950/10 transition active:scale-[0.98]"
                  onClick={saveGoalDetails}
                  type="button"
                >
                  Save goals
                </button>
              </motion.div>
            </motion.div>
          )}

          {resultSheetOpen && scanResult && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-end justify-center bg-black/55 px-[clamp(12px,4vw,20px)] pb-[max(18px,env(safe-area-inset-bottom))] sm:pb-[max(22px,env(safe-area-inset-bottom))]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setResultSheetOpen(false)}
            >
              <motion.div
                animate={{ y: 0 }}
                className={cn('max-h-[86vh] w-full max-w-[430px] overflow-y-auto rounded-[28px] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ring-1 [scrollbar-width:none] sm:rounded-[32px] sm:p-5 [&::-webkit-scrollbar]:hidden', theme.card)}
                exit={{ y: 24 }}
                initial={{ y: 24 }}
                onClick={(event) => event.stopPropagation()}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{copy.aiResult}</p>
                    <h2 className="mt-2 text-2xl font-black leading-none sm:text-3xl">{scanResult.result.productName}</h2>
                  </div>
                  <button
                    aria-label="Close AI result"
                    className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95', theme.soft)}
                    onClick={() => setResultSheetOpen(false)}
                    type="button"
                  >
                    <ChevronRight className="h-5 w-5 rotate-90" />
                  </button>
                </div>

                {scanPreviewUrl && (
                  <img
                    alt="Scanned food"
                    className="mt-4 h-40 w-full rounded-[22px] object-cover sm:mt-5 sm:h-44 sm:rounded-[24px]"
                    src={scanPreviewUrl}
                  />
                )}

                <div className={cn('mt-4 rounded-[24px] p-4 ring-1 sm:mt-5 sm:rounded-[28px] sm:p-5', resultTone.block)}>
                  <div className="grid grid-cols-[1fr_auto] items-start gap-4">
                    <div>
                      <span className={cn('inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase', resultTone.badge)}>
                        {isResultAiCoolingDown ? copy.aiCoolingDownTitle : isResultImageCheckError ? copy.needsRetake : ratingLabel(scanResult.result.overallRating)}
                      </span>
                      <p className="mt-3 text-3xl font-black leading-none sm:text-4xl">{isResultAiCoolingDown ? copy.aiCoolingDownTitle : isResultImageCheckError ? copy.imageNotChecked : `${Math.max(1, Math.round(scanResult.result.score / 10))}/10`}</p>
                      <p className={cn('mt-3 max-w-[31rem] text-sm font-bold leading-6', resultTone.muted)}>
                        {resultVibe(scanResult.result)}
                      </p>
                    </div>
                    <div className={cn('flex h-20 w-20 flex-col items-center justify-center rounded-full shadow-inner ring-4 sm:h-24 sm:w-24', resultTone.circle)}>
                      <p className="text-2xl font-black sm:text-3xl">{isResultImageCheckError ? '--' : scanResult.result.score}</p>
                      <p className="text-[10px] font-black uppercase opacity-75">{isResultImageCheckError ? copy.notScored : copy.score}</p>
                    </div>
                  </div>

                  {!isResultImageCheckError && (
                    <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/70">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', resultTone.bar)}
                        style={{ width: `${Math.max(5, scanResult.result.score)}%` }}
                      />
                    </div>
                  )}

                  <div className="mt-5 space-y-2">
                    {resultReasons.map((item) => (
                      <div className={cn('rounded-[20px] p-4 ring-1', resultTone.chip)} key={`${item.chemicalName}-${item.reason}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-base font-black">{item.chemicalName}</p>
                          <span className={cn('shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase', resultTone.badge)}>{ratingLabel(item.severity)}</span>
                        </div>
                        <p className={cn('mt-2 text-sm font-semibold leading-6', resultTone.muted)}>{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {betterAlternative && (
                  <button
                    className={cn('mt-4 w-full rounded-[24px] p-4 text-left ring-1 transition hover:-translate-y-0.5 active:scale-[0.99] sm:mt-5 sm:rounded-[26px] sm:p-5', theme.soft)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{copy.betterAlternative}</p>
                        <p className="mt-2 text-xl font-black leading-tight sm:text-2xl">{betterAlternative.title}</p>
                        <p className={cn('mt-2 text-sm font-semibold leading-6', theme.muted)}>{betterAlternative.reason}</p>
                      </div>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-950/10">
                        <ChevronRight className="h-5 w-5" />
                      </span>
                    </div>
                  </button>
                )}

                {!isResultImageCheckError && (
                <div className={cn('mt-4 rounded-[24px] p-4 ring-1 sm:mt-5 sm:rounded-[26px] sm:p-5', theme.soft)}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{isRussian ? 'Самочувствие' : 'Feeling check-in'}</p>
                      <h3 className="mt-2 text-xl font-black leading-tight sm:text-2xl">{isRussian ? 'Как вы себя чувствуете после еды?' : 'How do you feel after eating it?'}</h3>
                    </div>
                    {selectedFeeling && (
                      <span className={cn('rounded-full px-3 py-1 text-xs font-black', isDarkMode ? 'bg-white text-zinc-950' : 'bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-950/[0.08]')}>
                        {copy.selected}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(['Fine', 'Nausea', 'Bloated'] as FeelingOption[]).map((feeling) => {
                      const active = selectedFeeling === feeling;
                      return (
                        <button
                          className={cn(
                            'h-12 rounded-[16px] text-sm font-black transition duration-200 active:scale-[0.97]',
	                            active
	                              ? 'bg-white text-zinc-950 shadow-[0_14px_28px_rgba(15,15,15,0.12)] ring-1 ring-zinc-950/10'
	                              : 'bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-950/[0.05] hover:text-zinc-950',
                          )}
                          key={feeling}
                          onClick={() => setSelectedFeeling(feeling)}
                          type="button"
                        >
                          {feelingLabel(feeling)}
                        </button>
                      );
                    })}
                  </div>
                  <p className={cn('mt-3 text-xs font-semibold leading-5', theme.muted)}>
                   {selectedFeeling
                      ? isRussian
                        ? `${feelingLabel(selectedFeeling)} будет связано с ${scanResult.result.productName}.`
                        : `${selectedFeeling} will be connected to ${scanResult.result.productName}.`
                      : copy.feelingConnectEmpty}
                  </p>
                </div>
                )}

                {!isResultImageCheckError && (
                <div className="mt-5 grid gap-3">
                  <button
	                    className="h-14 rounded-full bg-white text-sm font-black text-zinc-950 shadow-[0_14px_30px_rgba(15,15,15,0.10)] ring-1 ring-zinc-950/10 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!selectedFeeling}
                    onClick={async () => {
                      if (!selectedFeeling) return;
                      const saved = await saveEntry(`${selectedFeeling} check-in saved: ${scanResult.result.productName}`);
                      if (saved) {
                        setDashboardError(isRussian ? `${feelingLabel(selectedFeeling)} связано с этим сканом.` : `${selectedFeeling} connected to this scan.`);
                        setResultSheetOpen(false);
                      }
                    }}
                    type="button"
                  >
                    {selectedFeeling ? copy.saveToTimeline : (isRussian ? 'Выберите самочувствие' : 'Pick feeling first')}
                  </button>
                </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {waterSheetOpen && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-end justify-center bg-black/35 px-[clamp(10px,4vw,18px)] pb-[max(14px,env(safe-area-inset-bottom))] sm:pb-[max(18px,env(safe-area-inset-bottom))]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setWaterSheetOpen(false)}
            >
              <motion.div
                animate={{ y: 0 }}
                className="w-full max-w-[430px] rounded-[28px] bg-white px-4 pb-4 pt-6 text-zinc-950 shadow-[0_24px_70px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.06] sm:rounded-[34px] sm:px-5 sm:pb-5 sm:pt-7"
                exit={{ y: 26 }}
                initial={{ y: 26 }}
                onClick={(event) => event.stopPropagation()}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200" />
                <h2 className="mt-6 text-center text-[22px] font-black">Log Water</h2>

                <div className="mt-8 flex items-center justify-center sm:mt-10">
                  <span className="pr-3 text-[58px] font-black leading-none text-zinc-300 sm:text-[72px]">{waterValueLabel}</span>
                  <span className="h-14 w-px bg-zinc-950 sm:h-16" />
                  <div className="ml-3 flex items-center gap-2">
                    <span className="text-[21px] font-black sm:text-[24px]">{waterUnit === 'ml' ? 'mL' : waterUnit === 'oz' ? 'oz' : 'cup(s)'}</span>
                    <div className="grid gap-0.5">
                      <button
                        aria-label="Set water unit to cups"
                        className={cn('rounded px-1 text-[11px] font-black', waterUnit === 'cups' ? 'bg-zinc-950 text-white' : 'text-zinc-500')}
                        onClick={() => setWaterUnit('cups')}
                        type="button"
                      >
                        cups
                      </button>
                      <button
                        aria-label="Set water unit to ounces"
                        className={cn('rounded px-1 text-[11px] font-black', waterUnit === 'oz' ? 'bg-zinc-950 text-white' : 'text-zinc-500')}
                        onClick={() => setWaterUnit('oz')}
                        type="button"
                      >
                        oz
                      </button>
                      <button
                        aria-label="Set water unit to milliliters"
                        className={cn('rounded px-1 text-[11px] font-black', waterUnit === 'ml' ? 'bg-zinc-950 text-white' : 'text-zinc-500')}
                        onClick={() => setWaterUnit('ml')}
                        type="button"
                      >
                        mL
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-[22px] bg-zinc-50 p-3.5 ring-1 ring-zinc-950/[0.06] sm:mt-7 sm:rounded-[24px] sm:p-4">
                  <label className="text-sm font-black text-zinc-500" htmlFor="manual-water-amount">
                    Manual amount
                  </label>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      className="h-14 min-w-0 flex-1 rounded-[18px] bg-white px-4 text-[24px] font-black outline-none ring-1 ring-zinc-950/[0.08] transition focus:ring-2 focus:ring-zinc-950/20"
                      id="manual-water-amount"
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => setManualWaterAmount(event.target.value)}
                      placeholder="0"
                      type="number"
                      value={manualWaterAmount}
                    />
                    <span className="w-16 text-center text-lg font-black">{waterUnit === 'ml' ? 'mL' : waterUnit}</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
                  {waterQuickAdds[waterUnit].map((option) => (
                    <button
                      className="min-h-[96px] rounded-[20px] bg-zinc-50 px-2.5 py-3 text-left shadow-sm ring-1 ring-zinc-950/[0.06] transition hover:-translate-y-0.5 hover:bg-white active:scale-[0.98] sm:min-h-[112px] sm:rounded-[22px] sm:px-3 sm:py-4"
                      key={`${waterUnit}-${option.label}`}
                      onClick={() => setWaterMl((amount) => amount + option.ml)}
                      type="button"
                    >
                      <span className="block text-[13px] font-black leading-tight sm:text-[16px]">{option.label}</span>
                      <span className="mt-1 block text-[13px] font-black text-zinc-500 sm:text-[15px]">{option.amount}</span>
                    </button>
                  ))}
                </div>

                <button
                  className={cn(
                    'mt-7 h-14 w-full rounded-full text-[17px] font-black transition active:scale-[0.98] sm:mt-9 sm:h-16 sm:text-[18px]',
                    waterMl > 0 || manualWaterMl > 0 ? 'bg-zinc-950 text-white shadow-[0_14px_32px_rgba(15,15,15,0.20)]' : 'bg-zinc-300 text-white',
                  )}
                  disabled={waterMl <= 0 && manualWaterMl <= 0}
                  onClick={() => {
                    if (manualWaterMl > 0) {
                      setWaterMl((amount) => amount + manualWaterMl);
                      setManualWaterAmount('');
                    }
                    setWaterSheetOpen(false);
                  }}
                  type="button"
                >
                  Log
                </button>
              </motion.div>
            </motion.div>
          )}

          {deleteSheetOpen && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 px-[clamp(12px,4vw,20px)] pb-[max(18px,env(safe-area-inset-bottom))] sm:pb-[max(22px,env(safe-area-inset-bottom))]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => !deleteLoading && setDeleteSheetOpen(false)}
            >
              <motion.div
                animate={{ y: 0 }}
                className={cn('w-full max-w-[430px] rounded-[28px] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ring-1 sm:rounded-[32px] sm:p-5', theme.card)}
                exit={{ y: 24 }}
                initial={{ y: 24 }}
                onClick={(event) => event.stopPropagation()}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-3xl font-black">{copy.deleteTitle}</h2>
                <p className={cn('mt-3 text-sm font-semibold leading-6', theme.muted)}>{copy.deleteBody}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    className={cn('h-14 rounded-full text-sm font-black transition active:scale-[0.98] disabled:opacity-50', theme.soft)}
                    disabled={deleteLoading}
                    onClick={() => setDeleteSheetOpen(false)}
                    type="button"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    className="h-14 rounded-full bg-red-500 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
                    disabled={deleteLoading}
                    onClick={deleteAccount}
                    type="button"
                  >
                    {deleteLoading ? copy.deleting : copy.deleteConfirm}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AppFrame>
  );
}

function AppFrame({ children, darkMode = false, fullScreen = false }: { children: ReactNode; darkMode?: boolean; fullScreen?: boolean }) {
  return (
    <main className={cn('min-h-dvh transition-colors duration-700', darkMode ? 'bg-[#050505] text-white' : 'bg-white text-zinc-950')}>
      <section
        className={cn(
          'relative h-dvh w-full overflow-hidden shadow-none transition-colors duration-700',
          fullScreen ? 'mx-0 max-w-none' : 'mx-auto max-w-[560px]',
          darkMode ? 'bg-[#050505]' : 'bg-white',
        )}
      >
        {children}
      </section>
    </main>
  );
}

export function AuthPage({ navigate, startAtLogin = false }: { navigate: Navigate; startAtLogin?: boolean }) {
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [setupStep, setSetupStep] = useState(startAtLogin ? SETUP_TOTAL_STEPS : 0);
  const [processingInsightIndex, setProcessingInsightIndex] = useState(0);
  const [profile, setProfile] = useState<SetupProfile>({
    gender: 'Female',
    unitSystem: 'metric',
    age: 24,
    heightCm: 170,
    weightKg: 64,
    goal: 'Find triggers',
    dietType: 'No specific diet',
    checkInsPerDay: 2,
    triggers: ['Fried food', 'Bread'],
    symptoms: ['Bloating'],
    allergies: [],
    timelineWeeks: 6,
    answers: {},
    multiAnswers: {},
  });

  const setupComplete = setupStep >= SETUP_TOTAL_STEPS;
  const currentStep = setupSteps[Math.min(setupStep, SETUP_TOTAL_STEPS - 1)];
  const progress = setupComplete ? 100 : ((setupStep + 1) / SETUP_TOTAL_STEPS) * 100;
  const timelineDate = new Date(Date.now() + profile.timelineWeeks * 7 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  useEffect(() => {
    if (currentStep.kind !== 'processing') return;

    saveStoredProfile(profile);
    try {
      window.localStorage.setItem(SENSIBITE_PENDING_PROFILE_KEY, '1');
    } catch {
      // The setup still works if browser storage is unavailable.
    }
    setProcessingInsightIndex(0);
    const interval = window.setInterval(() => {
      setProcessingInsightIndex((index) => (index + 1) % processingInsights.length);
    }, 700);
    const timeout = window.setTimeout(() => setSetupStep(SETUP_TOTAL_STEPS), 3000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [currentStep.kind]);

  const goForward = () => {
    if (currentStep.kind === 'processing') return;
    setSetupStep((step) => Math.min(step + 1, SETUP_TOTAL_STEPS - 1));
  };

  const goBack = () => {
    if (setupStep === 0) {
      navigate('/');
      return;
    }

    setSetupStep((step) => Math.max(step - 1, 0));
  };

  const getSingleValue = (field = '') => {
    if (field === 'goal') return profile.goal;
    if (field === 'dietType') return profile.dietType;
    if (field === 'checkInsPerDay') return `${profile.checkInsPerDay}x daily`;
    return profile.answers[field] ?? '';
  };

  const setSingleValue = (field: string, value: string) => {
    setProfile((current) => {
      if (field === 'goal') return { ...current, goal: value as SensiGoal, answers: { ...current.answers, [field]: value } };
      if (field === 'dietType') return { ...current, dietType: value, answers: { ...current.answers, [field]: value } };
      if (field === 'checkInsPerDay') {
        const nextCount = value === 'Only after meals' ? 3 : Number.parseInt(value, 10);
        return { ...current, checkInsPerDay: Number.isFinite(nextCount) ? nextCount : 2, answers: { ...current.answers, [field]: value } };
      }
      return { ...current, answers: { ...current.answers, [field]: value } };
    });
  };

  const getMultiValue = (field = '') => {
    if (field === 'symptoms') return profile.symptoms;
    if (field === 'allergies') return profile.allergies;
    if (field === 'triggers') return profile.triggers;
    return profile.multiAnswers[field] ?? [];
  };

  const setMultiValue = (field: string, value: string) => {
    setProfile((current) => {
      const existing = field === 'symptoms' ? current.symptoms : field === 'allergies' ? current.allergies : field === 'triggers' ? current.triggers : current.multiAnswers[field] ?? [];
      const next = value === 'None' ? ['None'] : existing.includes(value) ? existing.filter((item) => item !== value) : [...existing.filter((item) => item !== 'None'), value];
      const multiAnswers = { ...current.multiAnswers, [field]: next };

      if (field === 'symptoms') return { ...current, symptoms: next, multiAnswers };
      if (field === 'allergies') return { ...current, allergies: next, multiAnswers };
      if (field === 'triggers') return { ...current, triggers: next, multiAnswers };
      return { ...current, multiAnswers };
    });
  };

  const canContinueOnboarding =
    currentStep.kind === 'intro' ||
    currentStep.kind === 'timeline' ||
    currentStep.kind === 'basics' ||
    currentStep.kind === 'insight' ||
    (currentStep.kind === 'single' && Boolean(getSingleValue(currentStep.field))) ||
    (currentStep.kind === 'multi' && getMultiValue(currentStep.field).length > 0);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);

    try {
      const redirectTo = `${window.location.origin}/dashboard`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign in failed.');
      setAuthLoading(false);
    }
  };

  const heightMeters = profile.heightCm / 100;
  const bmiValue = heightMeters > 0 ? profile.weightKg / (heightMeters * heightMeters) : 0;
  const bmi = Number.isFinite(bmiValue) ? bmiValue : 0;
  const bmiDisplay = bmi > 0 ? bmi.toFixed(1) : '--';
  const bmiPointer = Math.min(100, Math.max(0, ((Math.min(40, Math.max(15, bmi || 15)) - 15) / 25) * 100));
  const bmiLabel = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Balanced' : bmi < 30 ? 'Elevated' : 'High';

  const renderSingleChoice = (step: OnboardingStep) => (
    <div className="space-y-3">
      {step.options?.map((option) => {
        const selected = getSingleValue(step.field) === option;
        return (
          <button
            className={cn(
              'group flex min-h-[74px] w-full items-center justify-between rounded-[22px] border px-5 text-left text-[16px] font-black transition duration-300 active:scale-[0.985]',
              selected
                ? 'border-[#1c171d] bg-[#1c171d] text-white shadow-[0_24px_46px_rgba(28,23,29,0.20)]'
                : 'border-zinc-100 bg-[#f7f6f2] text-zinc-800 shadow-[0_8px_24px_rgba(15,23,42,0.035)] hover:border-zinc-200 hover:bg-white',
            )}
            key={option}
            onClick={() => step.field && setSingleValue(step.field, option)}
            type="button"
          >
            <span className="pr-4 leading-tight">{option}</span>
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition', selected ? 'bg-white text-zinc-950' : 'bg-white text-zinc-300 ring-1 ring-zinc-200 group-hover:text-zinc-500')}>
              {selected ? <Check className="h-4 w-4 stroke-[3]" /> : <span className="h-2 w-2 rounded-full bg-zinc-300" />}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderMultiChoice = (step: OnboardingStep) => (
    <div className="grid grid-cols-2 gap-3">
      {step.options?.map((option) => {
        const selected = getMultiValue(step.field).includes(option);
        return (
          <button
            className={cn(
              'flex min-h-[68px] items-center justify-center gap-2 rounded-[22px] border px-3 text-sm font-black leading-tight transition duration-300 active:scale-[0.98]',
              selected
                ? 'border-[#1c171d] bg-[#1c171d] text-white shadow-[0_18px_34px_rgba(28,23,29,0.16)]'
                : 'border-zinc-100 bg-[#f7f6f2] text-zinc-800 shadow-[0_8px_24px_rgba(15,23,42,0.035)] hover:border-zinc-200 hover:bg-white',
            )}
            key={option}
            onClick={() => step.field && setMultiValue(step.field, option)}
            type="button"
          >
            {selected && <Check className="h-4 w-4 shrink-0 stroke-[3]" />}
            {option}
          </button>
        );
      })}
    </div>
  );

  const renderTimeline = () => {
    const label = profile.timelineWeeks <= 4 ? 'Fast clarity' : profile.timelineWeeks <= 8 ? 'Balanced pace' : 'Low pressure';

    return (
      <div className="mt-8 rounded-[32px] bg-[#f7f6f2] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.055)]">
        <div className="mx-auto flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-5xl font-black text-zinc-950">{profile.timelineWeeks}</p>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">weeks</p>
        </div>
        <p className="mt-5 text-center text-sm font-black text-zinc-500">First useful pattern estimate</p>
        <input
          aria-label="Pattern clarity timeline"
          className="mt-8 h-2 w-full accent-zinc-950"
          max={12}
          min={2}
          onChange={(event) => setProfile((current) => ({ ...current, timelineWeeks: Number(event.target.value) }))}
          type="range"
          value={profile.timelineWeeks}
        />
        <div className="mt-4 grid grid-cols-3 text-center text-[11px] font-black text-zinc-400">
          <span>Fast</span>
          <span>Recommended</span>
          <span>Easy</span>
        </div>
        <div className="mt-6 rounded-[24px] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-black text-zinc-950">{label}</p>
            <p className="text-sm font-black text-zinc-700">{timelineDate}</p>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">
            {profile.timelineWeeks <= 4
              ? 'Daily scans and check-ins should reveal early repeat triggers quickly.'
              : profile.timelineWeeks <= 8
                ? 'A realistic pace for finding patterns without forcing perfect discipline.'
                : 'Gentler tracking with slower but still useful pattern confidence.'}
          </p>
        </div>
      </div>
    );
  };

  const renderBasics = () => {
    const heightValue = profile.unitSystem === 'metric' ? profile.heightCm : Math.round(profile.heightCm / 2.54);
    const weightValue = profile.unitSystem === 'metric' ? profile.weightKg : Math.round(profile.weightKg * 2.20462);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-full bg-[#f3f2ed] p-1.5 shadow-inner">
          {(['metric', 'imperial'] as const).map((unit) => (
            <button
              className={cn('h-11 rounded-full text-sm font-black transition duration-300', profile.unitSystem === unit ? 'bg-[#1c171d] text-white shadow-sm' : 'text-zinc-500')}
              key={unit}
              onClick={() => setProfile((current) => ({ ...current, unitSystem: unit }))}
              type="button"
            >
              {unit === 'metric' ? 'kg / cm' : 'lbs / in'}
            </button>
          ))}
        </div>

        <div className="rounded-[28px] bg-[#f7f6f2] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-400">Biological sex</p>
          <div className="grid grid-cols-3 gap-2">
            {genderOptions.map((gender) => (
              <button
                className={cn('h-12 rounded-[18px] text-sm font-black transition duration-300', profile.gender === gender ? 'bg-[#1c171d] text-white shadow-[0_14px_26px_rgba(28,23,29,0.18)]' : 'bg-white text-zinc-600 shadow-sm')}
                key={gender}
                onClick={() => setProfile((current) => ({ ...current, gender }))}
                type="button"
              >
                {gender}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="rounded-[26px] bg-[#f7f6f2] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <span className="block text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Age</span>
            <input
              className="mt-2 w-full bg-transparent text-5xl font-black outline-none"
              inputMode="numeric"
              max={99}
              min={13}
              onChange={(event) => setProfile((current) => ({ ...current, age: Number(event.target.value) }))}
              type="number"
              value={profile.age}
            />
          </label>
          <label className="rounded-[26px] bg-[#f7f6f2] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <span className="block text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Height</span>
            <input
              className="mt-2 w-full bg-transparent text-5xl font-black outline-none"
              inputMode="numeric"
              onChange={(event) => {
                const value = Number(event.target.value);
                setProfile((current) => ({ ...current, heightCm: current.unitSystem === 'metric' ? value : Math.round(value * 2.54) }));
              }}
              type="number"
              value={heightValue}
            />
            <span className="text-sm font-black text-zinc-400">{profile.unitSystem === 'metric' ? 'cm' : 'in'}</span>
          </label>
          <label className="col-span-2 rounded-[26px] bg-[#f7f6f2] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <span className="block text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Weight</span>
            <input
              className="mt-2 w-full bg-transparent text-6xl font-black outline-none"
              inputMode="numeric"
              onChange={(event) => {
                const value = Number(event.target.value);
                setProfile((current) => ({ ...current, weightKg: current.unitSystem === 'metric' ? value : Math.round(value / 2.20462) }));
              }}
              type="number"
              value={weightValue}
            />
            <span className="text-sm font-black text-zinc-400">{profile.unitSystem === 'metric' ? 'kg' : 'lbs'}</span>
          </label>
        </div>

        <div className="rounded-[30px] bg-white p-5 shadow-[0_22px_55px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.04]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">Your BMI</p>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-6xl font-black leading-none">{bmiDisplay}</p>
                <p className="pb-1 text-sm font-black text-zinc-400">{bmiLabel}</p>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f6f2] text-xs font-black text-zinc-500">BMI</div>
          </div>
          <div className="relative mt-6">
            <div className="h-4 overflow-hidden rounded-full bg-[linear-gradient(90deg,#60a5fa_0%,#818cf8_34%,#f59e0b_68%,#ef4444_100%)]" />
            <div
              className="absolute top-1/2 h-8 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-950 shadow-[0_0_0_4px_rgba(255,255,255,0.9)] transition-all duration-300"
              style={{ left: `${bmiPointer}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-[11px] font-black text-zinc-400">
            <span>15</span>
            <span>25</span>
            <span>30</span>
            <span>40</span>
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-zinc-500">Used only to calibrate your starting profile and dashboard context.</p>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    if (currentStep.kind === 'intro') {
      const introRows: Array<[typeof Camera, string, string]> = [
        [Camera, 'Photo first', 'Save the meal and time before you forget.'],
        [Activity, 'Feeling later', 'Tap the symptom when it actually happens.'],
        [BarChart3, 'Pattern view', 'See repeat signals after enough real entries.'],
      ];

      return (
        <div className="flex min-h-0 flex-col">
          <div className="pt-2">
            <h1 className="text-[34px] font-black leading-[0.98] text-zinc-950 sm:text-[38px]">{currentStep.title}</h1>
            <p className="mt-3 text-[15px] font-semibold leading-6 text-zinc-500">{currentStep.subtitle}</p>
          </div>

          <div className="mt-6 rounded-[30px] bg-white p-4 shadow-[0_22px_60px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.05] sm:p-5">
            <div className="rounded-[24px] bg-[#f7f6f2] p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Personal scan context</p>
              <h2 className="mt-3 text-[24px] font-black leading-[1.04] text-zinc-950 sm:text-[28px]">
                Give the AI a better starting point.
              </h2>
              <p className="mt-3 text-[13px] font-semibold leading-6 text-zinc-500 sm:text-[14px]">
                Your answers help DigestSnap judge scans with your symptoms, habits, and avoided foods in mind.
              </p>
            </div>

            <div className="mt-3 grid gap-2.5">
              {introRows.map(([Icon, title, body]) => (
                <div className="flex items-center gap-3 rounded-[20px] bg-[#fbfaf7] p-2.5 ring-1 ring-zinc-950/[0.04] sm:p-3" key={String(title)}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 shadow-sm sm:h-11 sm:w-11">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-black text-zinc-950">{title}</span>
                    <span className="mt-0.5 hidden text-[12px] font-semibold leading-5 text-zinc-500 sm:block">{body}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (currentStep.kind === 'processing') {
      return (
        <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-zinc-950 text-white shadow-2xl">
            <Sparkles className="h-10 w-10 animate-pulse" />
            <span className="absolute inset-0 rounded-full border-4 border-zinc-300/60 animate-ping" />
          </div>
          <h1 className="mt-10 text-[34px] font-black leading-tight text-zinc-950">{currentStep.title}</h1>
          <p className="mt-4 min-h-7 text-base font-black text-zinc-700">{processingInsights[processingInsightIndex]}</p>
          <div className="mt-8 w-full space-y-2">
            {[0, 1, 2].map((bar) => (
              <div className="h-3 overflow-hidden rounded-full bg-[#f0efea]" key={bar}>
                <div className={cn('h-full rounded-full bg-zinc-950 transition-all duration-700', bar <= processingInsightIndex % 3 ? 'w-full' : 'w-1/3')} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (currentStep.kind === 'insight') {
      return (
        <div className="flex min-h-[560px] flex-col justify-center">
          <div className="rounded-[30px] bg-[#f7f6fb] p-6">
            <div className="rounded-[24px] bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-700">Profile insight</p>
              <h1 className="mt-5 text-[34px] font-black leading-[1.02] text-zinc-950">{currentStep.title}</h1>
              <p className="mt-5 text-base font-semibold leading-7 text-zinc-500">{currentStep.insight}</p>
              <div className="mt-7 rounded-[22px] bg-[#f7f6f2] p-4 text-zinc-950 ring-1 ring-zinc-950/[0.05]">
                <p className="text-sm font-black">Your starting profile</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-zinc-500">
                  <span>{profile.symptoms.length} symptoms</span>
                  <span>{profile.triggers.length} triggers</span>
                  <span>{profile.timelineWeeks} week target</span>
                  <span>{profile.checkInsPerDay}x check-ins</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div>
          <h1 className="text-[38px] font-black leading-[0.98] text-zinc-950">{currentStep.title}</h1>
        </div>
        <div className="mt-9">
          {currentStep.kind === 'single' && renderSingleChoice(currentStep)}
          {currentStep.kind === 'multi' && renderMultiChoice(currentStep)}
          {currentStep.kind === 'timeline' && renderTimeline()}
          {currentStep.kind === 'basics' && renderBasics()}
        </div>
      </>
    );
  };

  if (setupComplete) {
    return (
      <AppFrame fullScreen>
        <div className="relative mx-auto flex h-full w-full max-w-[680px] flex-col overflow-hidden bg-[#fbfaf7] px-6 pb-8 pt-7 text-zinc-950">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(113,113,122,0.10),transparent_36%)]" />
          <button
            aria-label={startAtLogin ? 'Back to landing' : 'Edit setup'}
            className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-950 shadow-[0_12px_34px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.05] transition active:scale-95"
            onClick={() => {
              if (startAtLogin) {
                navigate('/');
                return;
              }

              setSetupStep(Math.max(0, SETUP_TOTAL_STEPS - 2));
            }}
            type="button"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="relative z-10 flex flex-1 flex-col justify-center pb-8 text-center">
            <div className="mx-auto max-w-[360px]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-zinc-950 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
                <Sparkles className="h-8 w-8" />
              </div>
              <h1 className="mt-7 text-[42px] font-black leading-[0.98]">
                Welcome to
                <br />
                DigestSnap
              </h1>
              <p className="mx-auto mt-4 text-base font-semibold leading-7 text-zinc-500">
                Sign in to keep your scans, check-ins, and personal food patterns in one private place.
              </p>

              <div className="mt-7 grid gap-2 text-left">
                {['Clear label scans', 'Personal trigger context', 'Private pattern timeline'].map((item) => (
                  <div className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)] ring-1 ring-zinc-950/[0.04]" key={item}>
                    <Check className="h-4 w-4 stroke-[3]" />
                    <span className="text-sm font-black text-zinc-800">{item}</span>
                  </div>
                ))}
              </div>

              <button
                className="mt-7 flex h-16 w-full items-center justify-center gap-3 rounded-full bg-zinc-950 text-base font-black text-white shadow-[0_22px_55px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={authLoading}
                onClick={handleGoogleSignIn}
                type="button"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-zinc-950">G</span>
                {authLoading ? 'Opening Google...' : 'Continue with Google'}
              </button>

              {authError && (
                <div className="mt-4 rounded-[18px] border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700" role="alert">
                  {authError}
                </div>
              )}
            </div>
          </div>
        </div>
      </AppFrame>
    );
  }

  return (
    <AppFrame fullScreen>
      <div className="relative mx-auto h-full w-full max-w-[680px] overflow-hidden bg-white">
        <div className="absolute inset-x-0 top-0 z-30 h-1 bg-zinc-100">
          <div className="h-full bg-zinc-950 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex h-full flex-col px-6 pb-7 pt-7">
          <div className="flex items-center justify-between">
            <button
              aria-label="Go back"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f7f6fb] text-zinc-950 transition hover:bg-zinc-100 active:scale-95"
              onClick={goBack}
              type="button"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-7 pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <AnimatePresence mode="wait">
              <motion.div
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
                initial={{ opacity: 0, y: 14, filter: 'blur(5px)' }}
                key={currentStep.id}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </div>

          {currentStep.kind !== 'processing' && (
            <div className="shrink-0 border-t border-zinc-100 bg-white pt-4">
              <button
                className="flex h-16 w-full items-center justify-center rounded-full bg-[#1c171d] text-base font-black text-white shadow-[0_18px_40px_rgba(28,23,29,0.18)] transition duration-300 hover:bg-zinc-900 active:scale-[0.99] disabled:bg-zinc-300 disabled:text-white disabled:shadow-none"
                disabled={!canContinueOnboarding}
                onClick={goForward}
                type="button"
              >
                {currentStep.id === 'welcome' ? 'Start setup' : setupStep === SETUP_TOTAL_STEPS - 2 ? 'Build my profile' : 'Continue'}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppFrame>
  );
}
