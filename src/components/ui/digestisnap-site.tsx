import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  Download,
  Flame,
  Home,
  LoaderCircle,
  LogOut,
  Mail,
  Plus,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Utensils,
  User,
  X,
} from 'lucide-react';
import { scanFoodTextWithClientTimeout, scanImageWithClientTimeout, type ImageScanPayload, type NutritionFacts } from '../../lib/imageScanClient';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import IPhoneMockup from './iphone-mockup';

type Navigate = (path: string, options?: { replace?: boolean }) => void;
type AppLanguage = 'English' | 'Russian';
type DashboardTab = 'home' | 'progress' | 'profile';
type ScanHistoryFilter = 'all' | 'eaten' | 'not_eaten' | 'safe' | 'caution' | 'avoid' | 'with_feeling';
type IncludePreview = 'scan' | 'symptoms' | 'timeline' | 'speed';
type LandingPhoneVariant = 'score' | 'macros' | 'water' | 'feeling';
type FeelingOption = 'Fine' | 'Bloated' | 'Pain' | 'Nausea';
type WaterUnit = 'oz' | 'ml';
type PortionOption = 'small' | 'medium' | 'large' | 'package';
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
type FoodEventRow = {
  user_id: string;
  local_scan_id: string;
  result: unknown;
  nutrition: unknown;
  image_data_url: string | null;
  eaten: boolean | null;
  feeling: string | null;
  feeling_logged_at: string | null;
  feeling_delay_minutes: number | null;
  food_category: string | null;
  consumed_at: string | null;
  note: string | null;
  created_at: string;
};
type ScanCorrectionRow = {
  user_id: string;
  corrected_result: unknown;
  corrected_nutrition: unknown;
};
type UserDailyStateRow = {
  user_id: string;
  day: string;
  water_ml: number;
  water_unit: string;
  streak_count: number;
  streak_max_count: number;
  streak_last_logged_at: string | null;
  updated_at: string;
};
type GenderOption = 'Male' | 'Female' | 'Other';
type DigestGoal = 'Lose weight' | 'Maintain weight' | 'Gain weight' | 'Find triggers' | 'Reduce bloating' | 'Build consistency';
type UnitSystem = 'metric' | 'imperial';
type OnboardingStepKind = 'intro' | 'single' | 'multi' | 'basics' | 'timeline' | 'insight' | 'processing';
type BmiCategory = 'Underweight' | 'Balanced' | 'Elevated' | 'High';

type SetupProfile = {
  gender: GenderOption;
  unitSystem: UnitSystem;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: DigestGoal;
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
const goalOptions: DigestGoal[] = ['Lose weight', 'Maintain weight', 'Gain weight', 'Find triggers', 'Reduce bloating', 'Build consistency'];
const isDigestGoal = (value: unknown): value is DigestGoal => typeof value === 'string' && goalOptions.includes(value as DigestGoal);
const processingInsights = ['Reading your scan context', 'Mapping symptom timing', 'Building your trigger baseline', 'Preparing DigestSnap'];
const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    kind: 'intro',
    title: 'Set your scan context',
    subtitle: 'Answer a few quick questions so every scan starts with your goals, symptoms, and habits in mind.',
  },
  {
    id: 'goal',
    kind: 'single',
    field: 'goal',
    title: 'What should DigestSnap help with first?',
    subtitle: 'Pick the outcome that should shape your first scans.',
    options: goalOptions,
  },
  {
    id: 'symptoms',
    kind: 'multi',
    field: 'symptoms',
    title: 'What do you notice most often?',
    options: ['Bloating', 'Pain', 'Nausea', 'Gas', 'Acid reflux', 'Not sure'],
  },
  {
    id: 'symptom-time',
    kind: 'single',
    field: 'symptomTime',
    title: 'When does it usually hit?',
    subtitle: 'Timing helps DigestSnap connect a reaction to the right meal later.',
    options: ['Right after eating', '1-2 hours later', 'At night', 'Next morning'],
  },
  {
    id: 'tracking-style',
    kind: 'single',
    field: 'trackingStyle',
    title: 'What happens after symptoms?',
    subtitle: 'This tells DigestSnap what memory gap to solve.',
    options: ['I forget the meal', 'I guess', 'I Google later', 'I do nothing'],
  },
  {
    id: 'suspected-foods',
    kind: 'multi',
    field: 'triggers',
    title: 'Which foods feel suspicious?',
    subtitle: 'These become your first watchlist.',
    options: ['Fried food', 'Bread', 'Dairy', 'Soda', 'Late meals', 'Not sure yet'],
  },
  {
    id: 'allergies',
    kind: 'multi',
    field: 'allergies',
    title: 'Any hard avoids?',
    subtitle: 'If none, tap None. Keep this list clean and specific.',
    options: ['Dairy', 'Gluten', 'Peanuts', 'Tree nuts', 'Eggs', 'Soy', 'None'],
  },
  {
    id: 'diet-type',
    kind: 'single',
    field: 'dietType',
    title: 'What eating style fits you best?',
    subtitle: 'This helps DigestSnap avoid generic scan advice.',
    options: ['No specific diet', 'High protein', 'Vegetarian', 'Vegan', 'Low carb', 'Halal', 'Low FODMAP'],
  },
  {
    id: 'meal-rhythm',
    kind: 'single',
    field: 'mealRhythm',
    title: 'What does a normal day look like?',
    subtitle: 'This tells the AI when timing might matter.',
    options: ['Regular meals', 'I snack a lot', 'I skip meals', 'Late meals often'],
  },
  {
    id: 'restaurant-frequency',
    kind: 'single',
    field: 'restaurantFrequency',
    title: 'How often do you eat out?',
    subtitle: 'Restaurant meals can change portions, oils, sauces, and timing.',
    options: ['Rarely', '1-2 times weekly', '3-5 times weekly', 'Almost daily'],
  },
  {
    id: 'late-food',
    kind: 'single',
    field: 'lateFood',
    title: 'How often do late meals happen?',
    subtitle: 'Late food can change what patterns mean.',
    options: ['Rarely', 'Sometimes', 'Often', 'Almost every night'],
  },
  {
    id: 'stress',
    kind: 'single',
    field: 'stressImpact',
    title: 'Does stress affect your stomach?',
    subtitle: 'This helps separate food signals from stressful-day noise.',
    options: ['Not really', 'Sometimes', 'Clearly yes', 'I am not sure'],
  },
  {
    id: 'sleep',
    kind: 'single',
    field: 'sleepImpact',
    title: 'Does poor sleep change your digestion?',
    subtitle: 'Sleep can change how the same meal feels.',
    options: ['No', 'A little', 'A lot', 'I never noticed'],
  },
  {
    id: 'water',
    kind: 'single',
    field: 'hydration',
    title: 'How is your water intake?',
    subtitle: 'Simple context that helps read patterns later.',
    options: ['Low', 'Average', 'Good', 'Very high'],
  },
  {
    id: 'caffeine',
    kind: 'single',
    field: 'caffeine',
    title: 'How much caffeine do you drink?',
    subtitle: 'This can matter for sensitivity and energy drinks.',
    options: ['None', '1 cup', '2-3 cups', 'Energy drinks'],
  },
  {
    id: 'soda',
    kind: 'single',
    field: 'carbonation',
    title: 'How often do fizzy drinks show up?',
    subtitle: 'Soda, sweet tea, and carbonation can create pattern noise.',
    options: ['Rarely', 'Sometimes', 'Often', 'Daily'],
  },
  {
    id: 'spice',
    kind: 'single',
    field: 'spiceTolerance',
    title: 'How do spicy foods treat you?',
    subtitle: 'This gives DigestSnap a sensitivity baseline.',
    options: ['Fine', 'Sometimes bad', 'Usually bad', 'I avoid them'],
  },
  {
    id: 'dairy',
    kind: 'single',
    field: 'dairyPattern',
    title: 'How does dairy usually go?',
    subtitle: 'This gives the AI useful personal context.',
    options: ['Usually fine', 'Sometimes bloated', 'Often bloated', 'I avoid dairy'],
  },
  {
    id: 'bread',
    kind: 'single',
    field: 'breadPattern',
    title: 'How do bread or floury foods feel?',
    subtitle: 'This is a high-signal question for many users.',
    options: ['Usually fine', 'Heavy stomach', 'Bloating', 'I avoid it'],
  },
  {
    id: 'fried',
    kind: 'single',
    field: 'friedPattern',
    title: 'How does fried food usually feel?',
    subtitle: 'This helps the scanner read heavier meals with your context.',
    options: ['Usually fine', 'Sometimes bad', 'Often bad', 'I avoid it'],
  },
  {
    id: 'consistency',
    kind: 'single',
    field: 'consistency',
    title: 'Why do trackers usually fail?',
    subtitle: 'Your answer helps keep DigestSnap lightweight.',
    options: ['I forget', 'Too much typing', 'No useful result', 'I never tried'],
  },
  {
    id: 'motivation',
    kind: 'single',
    field: 'motivation',
    title: 'What should scan explanations focus on?',
    subtitle: 'This keeps results useful instead of noisy.',
    options: ['Simple verdict', 'Ingredient concerns', 'Calories/macros', 'Possible triggers'],
  },
  {
    id: 'timeline',
    kind: 'timeline',
    title: 'How patient should DigestSnap be?',
    subtitle: 'Patterns need repeat signals. Choose a pace you can keep.',
  },
  {
    id: 'basics',
    kind: 'basics',
    title: 'Last basics',
    subtitle: 'This personalizes the baseline without making tracking heavy.',
  },
  {
    id: 'checkins',
    kind: 'single',
    field: 'checkInsPerDay',
    title: 'How light should check-ins feel?',
    subtitle: 'The best system is the one you can keep using.',
    options: ['1x daily', '2x daily', 'Only after meals'],
  },
  {
    id: 'data-priority',
    kind: 'single',
    field: 'dataPriority',
    title: 'What should the app show first?',
    subtitle: 'This keeps your dashboard focused instead of noisy.',
    options: ['Symptoms', 'Likely triggers', 'Scan ratings', 'Consistency'],
  },
  {
    id: 'investment',
    kind: 'insight',
    title: 'Your scan profile is ready',
    subtitle: 'DigestSnap now has enough context to make scans less generic.',
    insight: 'DigestSnap will use your symptoms, timing, suspected foods, allergies, and explanation style when reading scans.',
  },
  {
    id: 'processing',
    kind: 'processing',
    title: 'Building your scan profile',
    subtitle: 'DigestSnap is preparing your first personalized scan context.',
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
const DIGESTSNAP_PROFILE_STORAGE_KEY = 'digestisnap-profile-v1';
const DIGESTSNAP_PENDING_PROFILE_KEY = 'digestisnap-profile-pending';
const DIGESTSNAP_STREAK_STORAGE_KEY = 'digestisnap-streak-v1';
const DIGESTSNAP_RECENT_SCANS_STORAGE_KEY = 'digestisnap-recent-scans-v2';
const DIGESTSNAP_LANGUAGE_STORAGE_KEY = 'digestisnap-language-v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_SCANS = 50;
const MAX_RECENT_UPLOADS = 10;

type StoredDigestSnapProfile = Pick<
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
  ownerId?: string;
  imageDataUrl: string;
  result: ImageScanPayload['result'];
  baseNutrition?: NutritionFacts;
  nutrition: NutritionFacts;
  portion?: PortionOption;
  eaten?: boolean;
  feeling?: FeelingOption;
  feelingLoggedAt?: string;
  feelingDelayMinutes?: number;
  foodCategory?: string;
  consumedAt?: string;
  note?: string;
  createdAt: string;
};

function toStoredProfile(profile: SetupProfile): StoredDigestSnapProfile {
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
  return userId ? `${DIGESTSNAP_PROFILE_STORAGE_KEY}:${userId}` : DIGESTSNAP_PROFILE_STORAGE_KEY;
}

function streakStorageKey(userId?: string) {
  return userId ? `${DIGESTSNAP_STREAK_STORAGE_KEY}:${userId}` : DIGESTSNAP_STREAK_STORAGE_KEY;
}

function recentScansStorageKey(userId?: string) {
  return userId ? `${DIGESTSNAP_RECENT_SCANS_STORAGE_KEY}:${userId}` : DIGESTSNAP_RECENT_SCANS_STORAGE_KEY;
}

function languageStorageKey(userId?: string) {
  return userId ? `${DIGESTSNAP_LANGUAGE_STORAGE_KEY}:${userId}` : DIGESTSNAP_LANGUAGE_STORAGE_KEY;
}

function scanCorrectionProductKey(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .slice(0, 160);
}

function nutritionNumber(value: unknown, fallback = 0) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.round(numberValue));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function localDateKey(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function normalizeNutritionFacts(value: unknown): NutritionFacts | null {
  if (!isRecord(value)) return null;

  return {
    calories: nutritionNumber(value.calories),
    proteinG: nutritionNumber(value.proteinG),
    carbsG: nutritionNumber(value.carbsG),
    fatG: nutritionNumber(value.fatG),
    fiberG: nutritionNumber(value.fiberG),
    sugarG: nutritionNumber(value.sugarG),
    sodiumMg: nutritionNumber(value.sodiumMg),
  };
}

function isPortionOption(value: unknown): value is PortionOption {
  return value === 'small' || value === 'medium' || value === 'large' || value === 'package';
}

function estimateNutritionFromScan(result: ImageScanPayload['result']): NutritionFacts {
  const text = [
    result.productName,
    result.overallRating,
    ...result.flaggedChemicals.flatMap((item) => [item.chemicalName, item.reason]),
  ].join(' ').toLowerCase();

  const has = (pattern: RegExp) => pattern.test(text);

  if (has(/\bwater\b|mineral|spring\s*water|borjomi|вода|боржоми/i)) {
    return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 25 };
  }
  if (has(/\bsoda|cola|fanta|sprite|pepsi|fuse|iced?\s*tea|sweetened\s*tea|juice|газиров|кола|сок|чай/i)) {
    return { calories: 140, proteinG: 0, carbsG: 35, fatG: 0, fiberG: 0, sugarG: 32, sodiumMg: 45 };
  }
  if (has(/\bburger|cheeseburger|fast\s*food|shawarma|kebab|бургер|фастфуд/i)) {
    return { calories: 620, proteinG: 28, carbsG: 55, fatG: 32, fiberG: 4, sugarG: 9, sodiumMg: 980 };
  }
  if (has(/\bfried|fries|chips|crisps|cheetos|doritos|pringles|nuggets|жарен|чипс|фри|наггет/i)) {
    return { calories: 430, proteinG: 14, carbsG: 34, fatG: 26, fiberG: 3, sugarG: 2, sodiumMg: 720 };
  }
  if (has(/\bcandy|chocolate|snickers|kinder|cookie|wafer|cake|pastry|конфет|шоколад|печень|вафл/i)) {
    return { calories: 240, proteinG: 4, carbsG: 28, fatG: 12, fiberG: 1, sugarG: 20, sodiumMg: 95 };
  }
  if (has(/\bpasta|macaroni|spaghetti|noodles|макарон|паста|спагетти/i)) {
    return { calories: 360, proteinG: 12, carbsG: 70, fatG: 4, fiberG: 4, sugarG: 3, sodiumMg: 180 };
  }
  if (has(/\bbread|toast|wrap|bun|pita|хлеб|тост|лаваш|булоч/i)) {
    return { calories: 190, proteinG: 7, carbsG: 36, fatG: 3, fiberG: 3, sugarG: 4, sodiumMg: 320 };
  }
  if (has(/\bmilk|yogurt|yoghurt|cheese|kefir|молок|йогурт|сыр|кефир|творог/i)) {
    return { calories: 150, proteinG: 9, carbsG: 12, fatG: 6, fiberG: 0, sugarG: 10, sodiumMg: 130 };
  }
  if (has(/\bavocado|авокадо/i)) {
    return { calories: 240, proteinG: 3, carbsG: 13, fatG: 22, fiberG: 10, sugarG: 1, sodiumMg: 12 };
  }
  if (has(/\begg|omelette|яйц|омлет/i)) {
    return { calories: 155, proteinG: 13, carbsG: 1, fatG: 11, fiberG: 0, sugarG: 1, sodiumMg: 125 };
  }
  if (has(/\bchicken|turkey|beef|steak|meat|fish|salmon|tuna|куриц|индейк|говядин|мясо|рыб|лосос|тунец/i)) {
    return { calories: 280, proteinG: 36, carbsG: 0, fatG: 13, fiberG: 0, sugarG: 0, sodiumMg: 160 };
  }
  if (has(/\brice|buckwheat|oats|oatmeal|гречк|рис|овсян/i)) {
    return { calories: 250, proteinG: 7, carbsG: 50, fatG: 4, fiberG: 5, sugarG: 1, sodiumMg: 15 };
  }
  if (has(/\bbanana|apple|orange|berries|grapes|kiwi|банан|яблок|апельсин|ягод|виноград|киви/i)) {
    return { calories: 100, proteinG: 1, carbsG: 25, fatG: 0, fiberG: 4, sugarG: 17, sodiumMg: 2 };
  }
  if (has(/\bvegetable|salad|cucumber|tomato|carrot|broccoli|spinach|овощ|салат|огур|помидор|морков|брокколи/i)) {
    return { calories: 70, proteinG: 3, carbsG: 12, fatG: 1, fiberG: 5, sugarG: 5, sodiumMg: 40 };
  }

  if (result.overallRating === 'Avoid') {
    return { calories: 360, proteinG: 8, carbsG: 42, fatG: 17, fiberG: 2, sugarG: 18, sodiumMg: 520 };
  }
  if (result.overallRating === 'Caution') {
    return { calories: 240, proteinG: 8, carbsG: 30, fatG: 9, fiberG: 3, sugarG: 8, sodiumMg: 260 };
  }
  return { calories: 160, proteinG: 8, carbsG: 18, fatG: 5, fiberG: 3, sugarG: 4, sodiumMg: 120 };
}

const EMPTY_NUTRITION: NutritionFacts = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 };

function nutritionSearchText(result: ImageScanPayload['result']) {
  return [
    result.productName,
    result.overallRating,
    result.basis?.portionBasis,
    result.basis?.decisionBasis,
    ...result.flaggedChemicals.flatMap((item) => [item.chemicalName, item.reason]),
  ].join(' ').toLowerCase();
}

function isLikelyPackagedNutrition(result: ImageScanPayload['result']) {
  const text = nutritionSearchText(result);
  return /\b(package|packaged|wrapper|label|barcode|bottle|can|bar|chips|crisps|snack|candy|chocolate|soda|cola|fanta|sprite|pepsi|fuse|iced?\s*tea|energy\s*drink|juice|kinder|lays?|pringles|doritos|cheetos)\b|упаков|этикетк|штрихкод|бутыл|банка|батончик|чипс|снек|конфет|шоколад|газиров|кола|сок|холодн\w*\s+чай|энергет|молочный\s+ломтик/i.test(text);
}

function isLikelyMealOrWholeFoodNutrition(result: ImageScanPayload['result']) {
  const text = nutritionSearchText(result);
  return /\b(apple|banana|orange|berries|grapes|kiwi|avocado|egg|omelette|chicken|turkey|beef|steak|meat|fish|salmon|tuna|rice|buckwheat|oats|oatmeal|pasta|macaroni|spaghetti|noodles|bread|toast|wrap|bun|potato|beans|lentils|vegetable|salad|cucumber|tomato|carrot|broccoli|spinach|burger|shawarma|kebab|fried\s+chicken|meal|plate|bowl)\b|яблок|банан|апельсин|ягод|виноград|киви|авокад|яйц|омлет|куриц|индейк|говядин|мясо|рыб|лосос|тунец|рис|гречк|овсян|паста|макарон|спагетти|лапша|хлеб|тост|лаваш|картоф|боб|овощ|салат|огур|помидор|морков|брокколи|бургер|шаурм|кебаб|жарен\w*\s+куриц|тарелк|миска/i.test(text);
}

function shouldSuppressUnverifiedPackagedNutrition(result: ImageScanPayload['result']) {
  const source = result.nutritionMeta?.source;
  if (source === 'database' || source === 'label_estimate' || source === 'manual_estimate' || source === 'user_corrected') {
    return false;
  }

  return isLikelyPackagedNutrition(result) && !isLikelyMealOrWholeFoodNutrition(result);
}

function nutritionForResult(result: ImageScanPayload['result']): NutritionFacts {
  if (shouldSuppressUnverifiedPackagedNutrition(result)) {
    return EMPTY_NUTRITION;
  }

  return normalizeNutritionFacts(result.nutrition) ?? (isLikelyMealOrWholeFoodNutrition(result) ? estimateNutritionFromScan(result) : EMPTY_NUTRITION);
}

function isScanResultLike(value: unknown): value is ImageScanPayload['result'] {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ImageScanPayload['result']>;
  return typeof candidate.productName === 'string'
    && ['Safe', 'Caution', 'Avoid'].includes(String(candidate.overallRating))
    && typeof candidate.score === 'number'
    && Array.isArray(candidate.flaggedChemicals);
}

const PORTION_MULTIPLIERS: Record<PortionOption, number> = {
  small: 0.65,
  medium: 1,
  large: 1.45,
  package: 1,
};

function scaleNutritionFacts(nutrition: NutritionFacts, portion: PortionOption): NutritionFacts {
  const multiplier = PORTION_MULTIPLIERS[portion];
  return scaleNutritionByMultiplier(nutrition, multiplier);
}

function scaleNutritionByMultiplier(nutrition: NutritionFacts, multiplier: number): NutritionFacts {
  return {
    calories: nutritionNumber(nutrition.calories * multiplier),
    proteinG: nutritionNumber(nutrition.proteinG * multiplier),
    carbsG: nutritionNumber(nutrition.carbsG * multiplier),
    fatG: nutritionNumber(nutrition.fatG * multiplier),
    fiberG: nutritionNumber((nutrition.fiberG ?? 0) * multiplier),
    sugarG: nutritionNumber((nutrition.sugarG ?? 0) * multiplier),
    sodiumMg: nutritionNumber((nutrition.sodiumMg ?? 0) * multiplier),
  };
}

function addNutritionValues(items: NutritionFacts[]): NutritionFacts {
  return items.reduce<NutritionFacts>(
    (total, item) => ({
      calories: total.calories + item.calories,
      proteinG: total.proteinG + item.proteinG,
      carbsG: total.carbsG + item.carbsG,
      fatG: total.fatG + item.fatG,
      fiberG: (total.fiberG ?? 0) + (item.fiberG ?? 0),
      sugarG: (total.sugarG ?? 0) + (item.sugarG ?? 0),
      sodiumMg: (total.sodiumMg ?? 0) + (item.sodiumMg ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
  );
}

function isNutritionCountedScan(scan: RecentScan) {
  return scan.eaten === true;
}

function isSameLocalDay(value: string | undefined, dayKey: string) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toDateString() === dayKey;
}

function patternFoodKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(likely|visual|estimate|scanned|food|meal|plate|package|product)\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}

function deriveFoodCategory(result: ImageScanPayload['result']) {
  const text = nutritionSearchText(result);
  if (/\b(water|mineral water|cola|soda|fanta|sprite|pepsi|fuse|iced?\s*tea|juice|energy|drink)\b|вода|кола|газиров|сок|чай|энергет/i.test(text)) return 'Drink';
  if (/\b(chips|crisps|snack|candy|chocolate|bar|cookie|biscuit|kinder|lays?|doritos|pringles)\b|чипс|снек|конфет|шоколад|батончик|печен|киндер/i.test(text)) return 'Snack';
  if (/\b(apple|banana|orange|berries|grapes|kiwi|avocado|fruit)\b|яблок|банан|апельсин|ягод|виноград|киви|авокад|фрукт/i.test(text)) return 'Fruit';
  if (/\b(cucumber|tomato|carrot|broccoli|spinach|salad|vegetable)\b|огур|помидор|морков|брокколи|салат|овощ/i.test(text)) return 'Vegetable';
  if (/\b(egg|chicken|turkey|beef|steak|meat|fish|salmon|tuna)\b|яйц|куриц|индейк|говядин|мясо|рыб|лосос|тунец/i.test(text)) return 'Protein';
  if (/\b(rice|buckwheat|oats|oatmeal|pasta|macaroni|spaghetti|noodles|bread|toast|wrap|bun|potato)\b|рис|гречк|овсян|паста|макарон|лапша|хлеб|тост|лаваш|картоф/i.test(text)) return 'Carb';
  if (/\b(burger|shawarma|kebab|fried chicken|meal|plate|bowl|takeout|restaurant)\b|бургер|шаурм|кебаб|жарен|тарелк|миска|ресторан/i.test(text)) return 'Meal';
  return 'Food';
}

function feelingDelayMinutes(consumedAt?: string, feelingLoggedAt = new Date().toISOString()) {
  const consumedMs = consumedAt ? Date.parse(consumedAt) : NaN;
  const loggedMs = Date.parse(feelingLoggedAt);
  if (!Number.isFinite(consumedMs) || !Number.isFinite(loggedMs)) return 0;
  return Math.max(0, Math.round((loggedMs - consumedMs) / 60000));
}

function buildPatternInsight(scans: RecentScan[], language: AppLanguage) {
  const isRussian = language === 'Russian';
  const eatenScans = scans.filter((scan) => scan.eaten === true);
  const discomfortScans = eatenScans.filter((scan) => scan.feeling && scan.feeling !== 'Fine');
  const grouped = new Map<string, {
    count: number;
    displayName: string;
    feelings: Partial<Record<FeelingOption, number>>;
    categories: Record<string, number>;
    delayMinutes: number[];
    firstSeen: number;
    lastSeen: number;
  }>();

  discomfortScans.forEach((scan) => {
    const key = patternFoodKey(scan.result.productName);
    if (!key) return;
    const createdAt = Date.parse(scan.consumedAt ?? scan.createdAt);
    const scanTime = Number.isFinite(createdAt) ? createdAt : Date.now();
    const current = grouped.get(key) ?? {
      count: 0,
      displayName: scan.result.productName,
      feelings: {},
      categories: {},
      delayMinutes: [],
      firstSeen: scanTime,
      lastSeen: scanTime,
    };
    current.count += 1;
    if (scan.feeling) current.feelings[scan.feeling] = (current.feelings[scan.feeling] ?? 0) + 1;
    if (scan.foodCategory) current.categories[scan.foodCategory] = (current.categories[scan.foodCategory] ?? 0) + 1;
    if (typeof scan.feelingDelayMinutes === 'number' && scan.feelingDelayMinutes > 0) current.delayMinutes.push(scan.feelingDelayMinutes);
    current.firstSeen = Math.min(current.firstSeen, scanTime);
    current.lastSeen = Math.max(current.lastSeen, scanTime);
    grouped.set(key, current);
  });

  const strongest = Array.from(grouped.values()).sort((a, b) => {
    const aTopFeelingCount = Math.max(...Object.values(a.feelings).map(Number), 0);
    const bTopFeelingCount = Math.max(...Object.values(b.feelings).map(Number), 0);
    return (b.count * 2 + bTopFeelingCount) - (a.count * 2 + aTopFeelingCount);
  })[0];

  if (strongest && strongest.count >= 2) {
    const topFeeling = Object.entries(strongest.feelings).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] ?? 'Bloated';
    const topFeelingCount = Number(strongest.feelings[topFeeling as FeelingOption] ?? 0);
    const uniqueFeelings = Object.keys(strongest.feelings).length;
    const spanDays = Math.max(1, Math.ceil((strongest.lastSeen - strongest.firstSeen) / ONE_DAY_MS) + 1);
    const topCategory = Object.entries(strongest.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const avgDelay = strongest.delayMinutes.length
      ? Math.round(strongest.delayMinutes.reduce((sum, item) => sum + item, 0) / strongest.delayMinutes.length)
      : 0;
    const delayPhrase = avgDelay > 0
      ? isRussian
        ? ` примерно через ${avgDelay} мин`
        : ` about ${avgDelay} min later`
      : '';
    const categoryPhrase = topCategory
      ? isRussian
        ? ` (${topCategory.toLowerCase()})`
        : ` (${topCategory.toLowerCase()})`
      : '';
    const confidenceScore = Math.min(100, Math.round((strongest.count * 22) + (topFeelingCount * 12) + (uniqueFeelings > 1 ? 6 : 0) + (spanDays >= 2 ? 8 : 0)));
    const strength = confidenceScore >= 82 ? 'strong' : confidenceScore >= 58 ? 'medium' : 'weak';
    const confidenceLabel = isRussian
      ? strength === 'strong' ? 'Сильный сигнал' : strength === 'medium' ? 'Средний сигнал' : 'Ранний сигнал'
      : strength === 'strong' ? 'Strong signal' : strength === 'medium' ? 'Medium signal' : 'Early signal';
    const readableFeeling = isRussian
      ? topFeeling === 'Fine' ? 'нормальное самочувствие' : topFeeling === 'Bloated' ? 'вздутие' : topFeeling === 'Pain' ? 'боль' : 'тошноту'
      : topFeeling.toLowerCase();
    return {
      state: 'active' as const,
      strength,
      confidenceScore,
      confidenceLabel,
      title: isRussian ? 'Повтор уже виден' : 'Repeat signal found',
      body: isRussian
        ? `${strongest.displayName}${categoryPhrase} повторилось ${strongest.count} раза перед реакцией: ${readableFeeling}${delayPhrase}. В следующий раз проверьте, повторится ли это снова`
        : `${strongest.displayName}${categoryPhrase} repeated ${strongest.count} times before you logged ${readableFeeling}${delayPhrase}. Watch the next meal to confirm it`,
      count: strongest.count,
      topFeeling,
    };
  }

  if (eatenScans.length > 0 && eatenScans.some((scan) => !scan.feeling)) {
    return {
      state: 'waiting' as const,
      strength: 'none' as const,
      confidenceScore: 25,
      confidenceLabel: isRussian ? 'Ждем отметки' : 'Needs check-in',
      title: isRussian ? 'Нужны отметки самочувствия' : 'Waiting for check-ins',
      body: isRussian
        ? 'Еда учтена. Отметьте самочувствие позже, чтобы появились реальные паттерны'
        : 'Eaten meals are saved. Add later feelings to turn them into real patterns',
      count: discomfortScans.length,
      topFeeling: null,
    };
  }

  if (scans.length > 0) {
    return {
      state: 'waiting' as const,
      strength: 'none' as const,
      confidenceScore: 15,
      confidenceLabel: isRussian ? 'Нужен статус' : 'Needs meal status',
      title: isRussian ? 'Сначала отметьте, что ели' : 'Mark eaten first',
      body: isRussian
        ? 'Сканы сохранены, но паттерны строятся только из еды, которую вы реально съели'
        : 'Scans are saved, but patterns only use food you actually ate',
      count: 0,
      topFeeling: null,
    };
  }

  return {
    state: 'empty' as const,
    strength: 'none' as const,
    confidenceScore: 0,
    confidenceLabel: isRussian ? 'Пока пусто' : 'Empty for now',
    title: isRussian ? 'Сначала нужен скан' : 'Scan first',
    body: isRussian
      ? 'Сохраните еду и отметьте самочувствие позже. Тогда здесь появятся повторяющиеся сигналы'
      : 'Save food and check in later. Repeat signals will appear here when there is enough history',
    count: 0,
    topFeeling: null,
  };
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
      .filter((item): item is Partial<RecentScan> & { id: string; imageDataUrl: string; createdAt: string; result: ImageScanPayload['result'] } => (
        typeof item.id === 'string' &&
        typeof item.imageDataUrl === 'string' &&
        typeof item.createdAt === 'string' &&
        (!userId || typeof item.ownerId !== 'string' || item.ownerId === userId) &&
        Boolean(item.result?.productName)
      ))
      .map((item) => {
        const portion = isPortionOption(item.portion) ? item.portion : 'medium';
        const baseNutrition = normalizeNutritionFacts(item.baseNutrition) ?? normalizeNutritionFacts(item.result.nutrition) ?? nutritionForResult(item.result);
        const nutrition = normalizeNutritionFacts(item.nutrition) ?? scaleNutritionFacts(baseNutrition, portion);

        return {
          id: item.id,
          ownerId: typeof item.ownerId === 'string' ? item.ownerId : userId,
          imageDataUrl: normalizeImageDataUrl(item.imageDataUrl),
          result: {
            ...item.result,
            nutrition: baseNutrition,
          },
          baseNutrition,
          nutrition,
          portion,
          eaten: typeof item.eaten === 'boolean' ? item.eaten : undefined,
          feeling: item.feeling === 'Fine' || item.feeling === 'Bloated' || item.feeling === 'Pain' || item.feeling === 'Nausea' ? item.feeling : undefined,
          feelingLoggedAt: typeof item.feelingLoggedAt === 'string' ? item.feelingLoggedAt : undefined,
          feelingDelayMinutes: typeof item.feelingDelayMinutes === 'number' ? item.feelingDelayMinutes : undefined,
          foodCategory: typeof item.foodCategory === 'string' ? item.foodCategory : deriveFoodCategory(item.result),
          consumedAt: typeof item.consumedAt === 'string' ? item.consumedAt : undefined,
          note: typeof item.note === 'string' ? item.note : undefined,
          createdAt: item.createdAt,
        };
      })
      .slice(0, MAX_STORED_SCANS);
  } catch {
    return [];
  }
}

function saveRecentScans(scans: RecentScan[], userId?: string) {
  try {
    const ownedScans = scans
      .filter((scan) => !userId || !scan.ownerId || scan.ownerId === userId)
      .map((scan) => ({ ...scan, ownerId: scan.ownerId ?? userId }))
      .slice(0, MAX_STORED_SCANS);
    window.localStorage.setItem(recentScansStorageKey(userId), JSON.stringify(ownedScans));
  } catch {
    // Recent scan thumbnails are a convenience cache; scanning still works without it.
  }
}

function foodEventRowToRecentScan(row: FoodEventRow): RecentScan | null {
  if (!row.local_scan_id || !isRecord(row.result)) return null;
  const productName = typeof row.result.productName === 'string' ? row.result.productName : '';
  if (!productName) return null;
  const result = row.result as ImageScanPayload['result'];
  const baseNutrition = normalizeNutritionFacts(result.nutrition) ?? nutritionForResult(result);
  const nutrition = normalizeNutritionFacts(row.nutrition) ?? baseNutrition;

  return {
    id: row.local_scan_id,
    ownerId: row.user_id,
    imageDataUrl: normalizeImageDataUrl(row.image_data_url ?? ''),
    result: {
      ...result,
      nutrition: baseNutrition,
    },
    baseNutrition,
    nutrition,
    portion: 'medium',
    eaten: typeof row.eaten === 'boolean' ? row.eaten : undefined,
    feeling: row.feeling === 'Fine' || row.feeling === 'Bloated' || row.feeling === 'Pain' || row.feeling === 'Nausea' ? row.feeling : undefined,
    feelingLoggedAt: row.feeling_logged_at ?? undefined,
    feelingDelayMinutes: typeof row.feeling_delay_minutes === 'number' ? row.feeling_delay_minutes : undefined,
    foodCategory: row.food_category ?? deriveFoodCategory(result),
    consumedAt: row.consumed_at ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function createMenuScanThumbnail(title: string) {
  const safeTitle = title.trim().replace(/[<&>]/g, '').slice(0, 42) || 'Menu item';
  const initials = safeTitle
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || 'DS';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
      <rect width="640" height="640" rx="128" fill="#f7f5f1"/>
      <rect x="62" y="62" width="516" height="516" rx="104" fill="#ffffff" stroke="#e7e2da" stroke-width="4"/>
      <circle cx="320" cy="250" r="86" fill="#111111"/>
      <text x="320" y="276" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="54" font-weight="900" fill="#ffffff">${initials}</text>
      <text x="320" y="390" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="900" fill="#111111">Menu check</text>
      <text x="320" y="438" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#7a766f">${safeTitle}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
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
    return { count: 0, maxCount: 0, lastLoggedAt: '' };
  }

  const lastLogTime = Date.parse(streak.lastLoggedAt);
  const now = Date.now();
  const maxCount = Math.min(365, Math.max(0, streak.maxCount || streak.count || 0));
  if (!Number.isFinite(lastLogTime)) {
    return { count: 0, maxCount, lastLoggedAt: '' };
  }
  if (now - lastLogTime > ONE_DAY_MS) {
    return { count: 1, maxCount, lastLoggedAt: streak.lastLoggedAt };
  }

  const count = Math.min(365, Math.max(0, streak.count));
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
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      maxCount: typeof parsed.maxCount === 'number' ? parsed.maxCount : typeof parsed.count === 'number' ? parsed.count : 0,
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

function readStoredProfile(userId?: string): StoredDigestSnapProfile | null {
  try {
    const raw = window.localStorage.getItem(profileStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDigestSnapProfile>;
    return {
      age: typeof parsed.age === 'number' ? parsed.age : 24,
      allergies: Array.isArray(parsed.allergies) ? parsed.allergies.filter((value): value is string => typeof value === 'string') : [],
      answers: isRecord(parsed.answers) ? Object.fromEntries(Object.entries(parsed.answers).filter(([, value]) => typeof value === 'string')) as Record<string, string> : {},
      checkInsPerDay: typeof parsed.checkInsPerDay === 'number' ? parsed.checkInsPerDay : 2,
      dietType: typeof parsed.dietType === 'string' ? parsed.dietType : 'No specific diet',
      gender: parsed.gender === 'Male' || parsed.gender === 'Other' ? parsed.gender : 'Female',
      goal: isDigestGoal(parsed.goal) ? parsed.goal : 'Maintain weight',
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
    if (window.localStorage.getItem(DIGESTSNAP_PENDING_PROFILE_KEY) !== '1') return null;
    return readStoredProfile();
  } catch {
    return null;
  }
}

function clearPendingStoredProfile() {
  try {
    window.localStorage.removeItem(DIGESTSNAP_PENDING_PROFILE_KEY);
    window.localStorage.removeItem(DIGESTSNAP_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function clearUserLocalData(userId: string) {
  try {
    [
      profileStorageKey(userId),
      streakStorageKey(userId),
      recentScansStorageKey(userId),
      languageStorageKey(userId),
      DIGESTSNAP_PENDING_PROFILE_KEY,
      DIGESTSNAP_PROFILE_STORAGE_KEY,
      DIGESTSNAP_STREAK_STORAGE_KEY,
      DIGESTSNAP_RECENT_SCANS_STORAGE_KEY,
      DIGESTSNAP_LANGUAGE_STORAGE_KEY,
    ].forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Account deletion should not fail because local cleanup is unavailable.
  }
}

function getProfileScanTriggers(profile: StoredDigestSnapProfile | null) {
  const values = [
    ...(profile?.triggers ?? []),
    ...(profile?.allergies ?? []),
    ...(profile?.symptoms ?? []),
    profile?.dietType,
    profile?.goal,
    ...Object.entries(profile?.answers ?? {}).map(([key, value]) => `${key}: ${value}`),
    ...Object.entries(profile?.multiAnswers ?? {}).flatMap(([key, values]) => values.map((value) => `${key}: ${value}`)),
  ];

  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value !== 'None')))).slice(0, 20);
}

function getBmiFromProfile(profile: StoredDigestSnapProfile | null) {
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

function getCalorieGoalMode(profile: StoredDigestSnapProfile | null): 'lose' | 'maintain' | 'gain' {
  const goalText = `${profile?.goal ?? ''} ${profile?.answers?.goal ?? ''}`.toLowerCase();
  if (/gain|bulk|muscle|build/.test(goalText)) return 'gain';
  if (/lose|cut|reduce|weight loss/.test(goalText)) return 'lose';
  return 'maintain';
}

function estimateDailyCalories(profile: StoredDigestSnapProfile | null) {
  const weightKg = profile?.weightKg && profile.weightKg > 0 ? profile.weightKg : 70;
  const heightCm = profile?.heightCm && profile.heightCm > 0 ? profile.heightCm : 170;
  const age = profile?.age && profile.age > 0 ? profile.age : 24;
  const sexAdjustment = profile?.gender === 'Male' ? 5 : profile?.gender === 'Female' ? -161 : -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexAdjustment;
  const maintenance = bmr * 1.45;
  return Math.round(Math.min(3600, Math.max(1400, maintenance)) / 25) * 25;
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
    text.includes('could not verify image') ||
    text.includes('ai cooling down') ||
    text.includes('quota') ||
    text.includes('rate-limited') ||
    text.includes('ai request failed') ||
    text.includes('ai request timed out')
  );
}

function makeImageCheckErrorResult(fileName: string, errorMessage = ''): ImageScanPayload['result'] {
  const isQuotaError = /quota|cooling|too many|rate/i.test(errorMessage);
  return {
    productName: isQuotaError ? 'AI cooling down' : 'Could not verify image',
    overallRating: 'Caution',
    score: 0,
    flaggedChemicals: [
      {
        chemicalName: isQuotaError ? 'AI cooling down' : 'Could not verify image',
        severity: 'Caution',
        reason: isQuotaError
          ? 'Gemini quota is temporarily cooling down'
          : `Saved ${fileName.replace(/\.[^.]+$/, '') || 'this image'}, but AI could not verify it`,
      },
    ],
  };
}

function isImageCheckErrorResult(result: ImageScanPayload['result']) {
  return result.productName === 'Image check error' || result.productName === 'Could not verify image' || isAiCoolingDownResult(result);
}

function isAiCoolingDownResult(result: ImageScanPayload['result']) {
  return result.flaggedChemicals.some((item) => /cooling|quota|rate/i.test(`${item.chemicalName} ${item.reason}`));
}

const friedFoodPreviewUrl = 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?q=80&w=1000&auto=format&fit=crop';
const waterPreviewUrl = 'https://images.unsplash.com/photo-1564419320461-6870880221ad?q=80&w=900&auto=format&fit=crop';

function LandingPhoneMockup({ className = '', scale = 0.66, variant = 'score' }: { className?: string; scale?: number; variant?: LandingPhoneVariant }) {
  const surface = 'bg-white text-zinc-950';
  const card = 'bg-white ring-zinc-950/[0.04]';
  const soft = 'bg-[#f7f6f2] ring-zinc-950/[0.04]';
  const mockMacros = [
    ['0', '2180', '', 'Calories', 'Cal'],
    ['0', '112', 'g', 'Protein', 'P'],
    ['0', '245', 'g', 'Carbs', 'C'],
    ['0', '72', 'g', 'Fat', 'F'],
  ];
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
          className={cn('h-full w-full overflow-y-auto px-5 pb-24 pt-16', surface)}
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-2xl font-black">DigestSnap</p>
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

          {variant === 'score' && (
            <div className={cn('mt-5 rounded-[26px] p-5 ring-1', card)}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-end gap-1">
                    <p className="text-[48px] font-black leading-none">88</p>
                    <p className="pb-1 text-xl font-black text-zinc-400">/100</p>
                  </div>
                  <p className="mt-3 text-sm font-black text-zinc-500">Safe scan saved</p>
                </div>
                <div className={cn('flex h-24 w-24 shrink-0 items-center justify-center rounded-full', soft)}>
                  <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                    <Camera className="h-5 w-5" />
                    <span className="mt-1 text-lg font-black">1</span>
                  </div>
                </div>
              </div>
              <div className="mt-7 grid grid-cols-3 gap-3">
                {[
                  ['Scan', 'Done', 'w-full'],
                  ['Score', '8/10', 'w-[88%]'],
                  ['Latest', 'Borjomi', 'w-3/4'],
                ].map(([label, value, width]) => (
                  <div key={label}>
                    <p className="text-xs font-black">{label}</p>
                    <div className={cn('mt-2 h-1.5 rounded-full', soft)}>
                      <div className={cn('h-full rounded-full bg-zinc-950', width)} />
                    </div>
                    <p className="mt-2 truncate text-xs font-black text-zinc-600">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {variant === 'macros' && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {mockMacros.map(([value, target, unit, label, icon]) => (
                <div className={cn('flex min-h-[122px] flex-col justify-between rounded-[22px] p-4 ring-1', card)} key={label}>
                  <div>
                    <p className="text-2xl font-black leading-none">
                      {value}<span className="text-sm text-zinc-400">/{target}{unit}</span>
                    </p>
                    <p className="mt-2 text-[11px] font-black uppercase text-zinc-400">{label}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-[7px] border-[#f4f2f8]">
                    <span className="text-xs font-black">{icon}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {variant === 'water' && (
            <div className="mt-5 grid gap-3">
              <div className={cn('rounded-[26px] p-5 ring-1', card)}>
                <p className="text-xl font-black text-zinc-500">Water intake</p>
                <p className="mt-2 text-[34px] font-black leading-none">16 fl oz</p>
                <p className="mt-1 text-sm font-black text-zinc-400">Manual water log</p>
                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#f4f2f8]">
                  <div className="h-full w-[38%] rounded-full bg-zinc-950" />
                </div>
              </div>
              <div className={cn('rounded-[26px] p-5 ring-1', card)}>
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xl font-black">Health score</p>
                  <p className="text-2xl font-black">8/10</p>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#f4f2f8]">
                  <div className="h-full w-[80%] rounded-full bg-zinc-950" />
                </div>
                <p className="mt-3 text-xs font-bold leading-5 text-zinc-500">Recent scans look simple and low-trigger.</p>
              </div>
            </div>
          )}

          {variant === 'feeling' && (
            <div className="mt-5 grid gap-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['8/10', 'Meal'],
                  ['2h', 'Later'],
                  ['Bloated', 'Feel'],
                ].map(([value, label]) => (
                  <div className={cn('rounded-[20px] p-3 ring-1', card)} key={label}>
                    <p className="truncate text-xl font-black leading-none">{value}</p>
                    <p className="mt-2 text-[10px] font-black uppercase text-zinc-400">{label}</p>
                  </div>
                ))}
              </div>

              <div className={cn('rounded-[26px] p-4 ring-1', card)}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-black">How do you feel?</p>
                    <p className="mt-1 text-xs font-bold text-zinc-500">One tap after eating</p>
                  </div>
                  <Activity className="h-5 w-5" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {['Fine', 'Bloated', 'Pain', 'Nausea'].map((label) => (
                    <div
                      className={cn(
                        'flex h-10 items-center justify-center rounded-[14px] text-xs font-black',
                        label === 'Bloated' ? 'bg-zinc-950 text-white' : 'bg-[#f7f6f2] text-zinc-950',
                      )}
                      key={label}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <div className={cn('rounded-[24px] p-4 ring-1', card)}>
                <p className="text-base font-black">Saved reaction</p>
                <p className="mt-1 text-xs font-bold text-zinc-500">Connected to the scanned meal</p>
              </div>
            </div>
          )}

          <div className={cn('mt-4 rounded-[24px] p-4 ring-1', card)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-black">My progress</p>
                <p className="mt-1 text-xs font-bold text-zinc-500">Patterns, streak, and check-ins</p>
              </div>
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5">
            <p className="text-lg font-black">Recently uploaded</p>
            <div className={cn('mt-3 rounded-[24px] p-3.5 ring-1', card)}>
              <div className="flex items-center gap-3">
                <img
                  alt="Recent food scan"
                  className="h-16 w-16 shrink-0 rounded-[18px] object-cover"
                  src={variant === 'water' ? waterPreviewUrl : friedFoodPreviewUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{variant === 'water' ? 'Borjomi Mineral Water' : 'Fried chicken plate'}</p>
                  <p className="mt-1 text-xs font-bold text-zinc-500">{variant === 'water' ? 'Safe · 88/100' : 'Avoid · 40/100'}</p>
                  <p className="mt-1 truncate text-xs font-bold text-zinc-400">{variant === 'water' ? 'Low risk signal from image' : 'Fried foods often repeat before discomfort'}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
              </div>
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
  useEffect(() => {
    clearPendingStoredProfile();
  }, []);

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    window.scrollTo({ top: Math.max(0, target.offsetTop - 108), behavior: 'smooth' });
  };
  const includeCards: Array<{ icon: typeof Camera; preview: IncludePreview; title: string; body: string }> = [
    {
      icon: Camera,
      preview: 'scan',
      title: 'Scan the food',
      body: 'One photo saves what you ate, when it happened, and the first AI read while the moment is still fresh.',
    },
    {
      icon: Activity,
      preview: 'symptoms',
      title: 'Decide if it counted',
      body: 'Mark whether you actually ate it, so saved scans do not pollute your day or your patterns.',
    },
    {
      icon: BarChart3,
      preview: 'timeline',
      title: 'Check in later',
      body: 'When the reaction happens, tap how you feel and connect it back to the exact food.',
    },
    {
      icon: ShieldCheck,
      preview: 'speed',
      title: 'See repeat signals',
      body: 'DigestSnap only calls out a pattern when the same food, timing, and feeling start repeating.',
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
            <button className="h-11 rounded-full bg-zinc-950 px-5 text-sm font-black text-white transition active:scale-[0.98]" onClick={() => navigate('/start')} type="button">
              Get Started
            </button>
          </div>
          <button className="h-8 rounded-full bg-zinc-950 px-3 text-xs font-black text-white md:h-11 md:px-5 md:text-sm lg:hidden" onClick={() => navigate('/login')} type="button">
            Login
          </button>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1680px] items-center gap-5 px-4 pb-10 pt-7 md:min-h-[calc(100svh-86px)] md:gap-8 md:px-10 md:py-10 xl:grid-cols-[0.78fr_1.22fr] xl:px-12">
        <div className="relative z-10 max-w-[700px] text-center xl:text-left">
          <h1 className="mx-auto max-w-[760px] text-[34px] font-black leading-[1.02] sm:text-[60px] md:text-[74px] xl:mx-0 xl:text-[84px]">
            Find the food pattern.
          </h1>
          <p className="mx-auto mt-4 max-w-[660px] text-[15px] font-semibold leading-6 text-[#5f574d] md:mt-6 md:text-[23px] md:leading-[1.42] xl:mx-0">
            Take a photo of what you eat. Log how you feel. DigestSnap connects the repeat.
          </p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-center md:mt-8 md:gap-4 xl:justify-start">
            <button
              className="flex h-11 items-center justify-center rounded-[12px] bg-zinc-950 px-5 text-sm font-black text-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 active:scale-[0.98] md:h-16 md:rounded-[14px] md:px-8 md:text-lg"
              onClick={() => navigate('/start')}
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

        <div className="relative mx-auto h-[430px] w-full max-w-[420px] overflow-hidden rounded-[30px] bg-white sm:h-[590px] sm:max-w-none sm:overflow-visible lg:h-[720px]">
          <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 sm:left-[12%] sm:top-8 sm:translate-x-0 lg:left-[7%] xl:left-[10%]">
            <LandingPhoneMockup className="sm:hidden" scale={0.42} variant="score" />
            <LandingPhoneMockup className="hidden sm:block lg:hidden" scale={0.56} variant="score" />
            <LandingPhoneMockup className="hidden lg:block" scale={0.86} variant="score" />
          </div>
          <div className="absolute right-[-2%] top-20 z-10 hidden rotate-6 opacity-95 sm:block lg:right-[1%] xl:right-[5%]">
            <LandingPhoneMockup className="lg:hidden" scale={0.52} variant="water" />
            <LandingPhoneMockup className="hidden lg:block" scale={0.64} variant="water" />
          </div>
        </div>
      </section>

      <section className="scroll-mt-20 bg-white px-4 py-12 md:scroll-mt-28 md:px-10 md:py-28" id="includes">
        <div className="mx-auto max-w-[1480px]">
          <div className="mx-auto max-w-[960px] text-center">
              <h2 className="mx-auto max-w-[850px] text-[32px] font-black leading-[1.02] md:text-7xl">
                The loop is simple enough to keep using.
              </h2>
          </div>

          <div className="mt-8 grid items-start gap-4 md:mt-14 md:gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="lg:sticky lg:top-28">
              <div className="relative overflow-hidden rounded-[26px] bg-white p-3 text-zinc-950 shadow-[0_18px_54px_rgba(15,23,42,0.07)] ring-1 ring-zinc-950/[0.05] md:rounded-[34px] md:p-8">
                <div className="relative flex h-[420px] items-start justify-center overflow-hidden rounded-[22px] bg-white pt-3 ring-1 ring-zinc-950/[0.04] md:h-[628px] md:rounded-[30px] md:pt-6">
                  <LandingPhoneMockup
                    className="md:hidden"
                    scale={0.43}
                    variant={activeIncludeIndex === 0 ? 'score' : activeIncludeIndex === 1 ? 'score' : activeIncludeIndex === 2 ? 'feeling' : 'macros'}
                  />
                  <LandingPhoneMockup
                    className="hidden md:block"
                    scale={0.66}
                    variant={activeIncludeIndex === 0 ? 'score' : activeIncludeIndex === 1 ? 'score' : activeIncludeIndex === 2 ? 'feeling' : 'macros'}
                  />
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
              DigestSnap keeps the loop short: scan the food, understand the score, save the reaction, and see what repeats.
            </p>
          </div>

          <div className="mt-9 grid gap-4 md:mt-14 md:gap-5 lg:grid-cols-3">
            {[
              {
                icon: Camera,
                title: 'Scan first, decide fast',
                body: 'A photo becomes a food name, score, confidence, and short explanation without forcing label research.',
              },
              {
                icon: Activity,
                title: 'The reaction stays linked',
                body: 'A later Fine, Bloated, Nausea, or Pain tap connects back to the exact scan instead of becoming a vague memory.',
              },
              {
                icon: ShieldCheck,
                title: 'The pattern becomes visible',
                body: 'DigestSnap waits for repeat signals, then shows what keeps appearing before discomfort.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                className="group flex min-h-[148px] gap-4 rounded-[26px] bg-white p-5 shadow-[0_18px_54px_rgba(15,23,42,0.07)] ring-1 ring-zinc-950/[0.06] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_76px_rgba(15,23,42,0.10)] md:min-h-[178px] md:gap-5 md:rounded-[30px] md:p-6"
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
    lede: 'Your DigestSnap account is currently free. There is no payment method connected and no active billing.',
    sections: [
      {
        title: 'Current status',
        body: 'You can use the core scan, eaten/not eaten, check-in, and pattern flow without a paid plan.',
        items: [
          'Plan: Free',
          'Billing: Not active',
          'Payment method: Not connected',
          'Renewal: None',
        ],
      },
      {
        title: 'Before any billing',
        body: 'If paid plans are added later, price, renewal date, cancellation method, and refund terms must be shown before confirmation.',
      },
      {
        title: 'Cancellation',
        body: 'No cancellation is needed while billing is inactive. If payments are connected later, cancellation must be reachable from this page.',
      },
      {
        title: 'Receipts and refunds',
        body: 'There are no receipts or refunds while no payment is active. Future purchases would follow the payment provider and policy shown at checkout.',
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

  if (kind === 'subscription') {
    const statusCards = [
      ['Plan', 'Free'],
      ['Billing', 'Not active'],
      ['Payment method', 'Not connected'],
      ['Renewal', 'None'],
    ];
    const accountChecks = [
      ['Access', 'Core loop available', 'Scan food, mark eaten, check in later, and save the pattern context.'],
      ['Billing', 'Inactive', 'There is no connected payment method or automatic renewal.'],
      ['Control', 'User-owned data', 'Export and delete actions stay in the account area.'],
    ];

    return (
      <main className="min-h-screen bg-white px-5 py-6 text-zinc-950 antialiased md:px-10 md:py-10">
        <div className="mx-auto max-w-[1180px]">
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

          <section className="mt-12 grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div className="rounded-[36px] bg-[#f8f7f4] p-6 ring-1 ring-zinc-950/[0.05] md:p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">{page.eyebrow}</p>
              <h1 className="mt-4 max-w-[680px] text-5xl font-black leading-[0.94] md:text-7xl">{page.title}</h1>
              <p className="mt-6 max-w-[620px] text-lg font-semibold leading-8 text-zinc-600">{page.lede}</p>

              <div className="mt-8 grid grid-cols-2 gap-3">
                {statusCards.map(([label, value]) => (
                  <div className="rounded-[24px] bg-white p-5 shadow-[0_16px_34px_rgba(15,15,15,0.04)] ring-1 ring-zinc-950/[0.05]" key={label}>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{label}</p>
                    <p className="mt-3 text-2xl font-black leading-none">{value}</p>
                  </div>
                ))}
              </div>

              <button
                className="mt-8 h-14 w-full cursor-not-allowed rounded-full bg-zinc-200 text-base font-black text-zinc-500"
                disabled
                type="button"
              >
                Billing inactive
              </button>
              <p className="mt-3 text-center text-xs font-bold leading-5 text-zinc-400">
                No payment can be started from this page
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[36px] bg-white p-6 shadow-[0_22px_70px_rgba(15,15,15,0.08)] ring-1 ring-zinc-950/[0.06] md:p-8">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Account clarity</p>
                <div className="mt-6 grid gap-4">
                  {accountChecks.map(([label, title, body], index) => (
                    <div className="grid grid-cols-[74px_1fr] gap-4" key={label}>
                      <div className="flex flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-white">{index + 1}</div>
                        {index < accountChecks.length - 1 && <div className="mt-2 h-12 w-px bg-zinc-200" />}
                      </div>
                      <div className="pb-5">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{label}</p>
                        <h2 className="mt-1 text-2xl font-black">{title}</h2>
                        <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                {page.sections.slice(1).map((section) => (
                  <article className="rounded-[26px] bg-[#f8f7f4] p-5 ring-1 ring-zinc-950/[0.05]" key={section.title}>
                    <h2 className="text-xl font-black">{section.title}</h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{section.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

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
    ['03', 'Pattern view', 'Repeat signals become visible without digging through memory or old chats.'],
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
          <button className="min-h-11 rounded-full px-4 text-sm font-black" onClick={() => navigate('/start')} type="button">
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
  const [storedProfile, setStoredProfile] = useState<StoredDigestSnapProfile | null>(() => readStoredProfile(session.user.id));
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanProgressText, setScanProgressText] = useState('Analyzing image...');
  const [scanResult, setScanResult] = useState<ImageScanPayload | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [logs, setLogs] = useState<DashboardEntry[]>([]);
  const [profileFormMessage, setProfileFormMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const isDarkMode = false;
  const [profileName, setProfileName] = useState(initialName);
  const [profileUsername, setProfileUsername] = useState(initialUsername);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [profileDraftName, setProfileDraftName] = useState(initialName);
  const [profileDraftUsername, setProfileDraftUsername] = useState(initialUsername);
  const [profileSaving, setProfileSaving] = useState(false);
  const [goalsSheetOpen, setGoalsSheetOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState<StoredDigestSnapProfile>(() => readStoredProfile(session.user.id) ?? {
    age: 24,
    allergies: [],
    answers: {},
    checkInsPerDay: 2,
    dietType: 'No specific diet',
    gender: 'Female',
    goal: 'Maintain weight',
    heightCm: 170,
    multiAnswers: {},
    symptoms: [],
    timelineWeeks: 6,
    triggers: [],
    unitSystem: 'metric',
    weightKg: 64,
  });

  const [resultSheetOpen, setResultSheetOpen] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState('');
  const [language, setLanguage] = useState<AppLanguage>(() => readStoredLanguage(session.user.id));
  const [selectedFeeling, setSelectedFeeling] = useState<FeelingOption | null>(null);
  const [selectedMealStatus, setSelectedMealStatus] = useState<'eaten' | 'not_eaten' | null>(null);
  const [selectedPortion, setSelectedPortion] = useState<PortionOption>('medium');
  const [fixResultSheetOpen, setFixResultSheetOpen] = useState(false);
  const [fixDraft, setFixDraft] = useState({
    productName: '',
    rating: 'Caution' as ImageScanPayload['result']['overallRating'],
    reason: '',
    portionBasis: '',
    servingMultiplier: '1',
    score: '',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
    sugarG: '',
    sodiumMg: '',
  });
  const [activeRecentScanId, setActiveRecentScanId] = useState<string | null>(null);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState<ScanHistoryFilter>('all');
  const [cameraSheetOpen, setCameraSheetOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraCapturing, setCameraCapturing] = useState(false);
  const [menuDishInput, setMenuDishInput] = useState('');
  const [menuDishScanning, setMenuDishScanning] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);
  const [waterUnit, setWaterUnit] = useState<WaterUnit>('oz');
  const [waterMl, setWaterMl] = useState(0);
  const [manualWaterAmount, setManualWaterAmount] = useState('');
  const [streak, setStreak] = useState<StoredStreak>(() => readStoredStreak(session.user.id));
  const [selectedHomeDate, setSelectedHomeDate] = useState(() => new Date().toDateString());
  const [nutritionPanel, setNutritionPanel] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const todayKey = localDateKey();

  useEffect(() => {
    setRecentScans([]);
    setLogs([]);
    setScanResult(null);
    setScanPreviewUrl((current) => {
      if (current) revokeObjectUrl(current);
      return '';
    });
    setActiveRecentScanId(null);
    setSelectedMealStatus(null);
    setSelectedFeeling(null);
    setSelectedPortion('medium');
    setResultSheetOpen(false);
    setHistorySheetOpen(false);
    setFixResultSheetOpen(false);
    setWaterMl(0);
    setWaterUnit('oz');
    setManualWaterAmount('');
    setStreak(readStoredStreak(session.user.id));
    setLanguage(readStoredLanguage(session.user.id));
    setProfileName(initialName);
    setProfileUsername(initialUsername);
    setProfileDraftName(initialName);
    setProfileDraftUsername(initialUsername);
  }, [initialName, initialUsername, session.user.id]);

  const persistDailyState = async (patch: { waterMl?: number; waterUnit?: WaterUnit; streak?: StoredStreak }) => {
    const nextWaterMl = Math.round(clampNumber(patch.waterMl ?? waterMl, waterMl, 0, 20000));
    const nextWaterUnit = patch.waterUnit ?? waterUnit;
    const nextStreak = normalizeStreak(patch.streak ?? streak);

    const { error } = await supabase
      .from('user_daily_state')
      .upsert(
        {
          user_id: session.user.id,
          day: todayKey,
          water_ml: nextWaterMl,
          water_unit: nextWaterUnit,
          streak_count: nextStreak.count,
          streak_max_count: nextStreak.maxCount,
          streak_last_logged_at: nextStreak.lastLoggedAt || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,day' },
      );

    if (error) {
      console.warn('DigestSnap daily state persistence failed.', error.message);
      return false;
    }

    return true;
  };

  useEffect(() => {
    saveStoredLanguage(language, session.user.id);
  }, [language, session.user.id]);

  useEffect(() => {
    let active = true;

    async function loadDailyState() {
      const { data, error } = await supabase
        .from('user_daily_state')
        .select('user_id,day,water_ml,water_unit,streak_count,streak_max_count,streak_last_logged_at,updated_at')
        .eq('user_id', session.user.id)
        .eq('day', todayKey)
        .maybeSingle();

      if (!active || error || !data) {
        return;
      }

      const row = data as UserDailyStateRow;
      const nextWaterUnit: WaterUnit = row.water_unit === 'ml' ? 'ml' : 'oz';
      const nextWaterMl = Math.round(clampNumber(row.water_ml, 0, 0, 20000));
      const nextStreak = normalizeStreak({
        count: row.streak_count,
        maxCount: row.streak_max_count,
        lastLoggedAt: row.streak_last_logged_at ?? '',
      });

      setWaterMl(nextWaterMl);
      setWaterUnit(nextWaterUnit);
      setStreak(nextStreak);
      saveStoredStreak(nextStreak, session.user.id);
    }

    loadDailyState();

    return () => {
      active = false;
    };
  }, [session.user.id, todayKey]);

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

      setLogs((data ?? []).filter((item) => item.user_id === session.user.id));
    }

    loadEntries();
    return () => {
      active = false;
    };
  }, [session.user.id]);

  useEffect(() => {
    let active = true;
    const loadStartedAt = Date.now();

    async function loadFoodEvents() {
      const { data, error } = await supabase
        .from('food_events')
        .select('user_id,local_scan_id,result,nutrition,image_data_url,eaten,feeling,feeling_logged_at,feeling_delay_minutes,food_category,consumed_at,note,created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_STORED_SCANS);

      if (!active || error || !data) {
        return;
      }

      const remoteScans = (data as FoodEventRow[])
        .filter((row) => row.user_id === session.user.id)
        .map(foodEventRowToRecentScan)
        .filter((item): item is RecentScan => item !== null);

      if (remoteScans.length === 0) {
        const cachedScans = readRecentScans(session.user.id);
        if (cachedScans.length > 0) {
          const backfillResults = await Promise.allSettled(cachedScans.map((scan) => persistFoodEvent(scan)));
          if (!active) return;
          const recoveredScans = cachedScans.filter((_, index) => {
            const result = backfillResults[index];
            return result.status === 'fulfilled' && result.value === true;
          });
          setRecentScans(recoveredScans);
          saveRecentScans(recoveredScans, session.user.id);
        }
        return;
      }

      setRecentScans((current) => {
        const byId = new Map<string, RecentScan>();
        const remoteIds = new Set(remoteScans.map((scan) => scan.id));
        const freshLocalScans = current.filter((scan) =>
          (!scan.ownerId || scan.ownerId === session.user.id) &&
          !remoteIds.has(scan.id) &&
          Date.parse(scan.createdAt) >= loadStartedAt,
        );
        [...freshLocalScans, ...remoteScans].forEach((scan) => {
          if (!byId.has(scan.id)) byId.set(scan.id, scan);
        });
        const next = Array.from(byId.values())
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .slice(0, MAX_STORED_SCANS);
        saveRecentScans(next, session.user.id);
        return next;
      });
    }

    loadFoodEvents();

    return () => {
      active = false;
    };
  }, [session.user.id]);

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

      if (data && data.user_id === session.user.id) {
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

        if (profile && !error && profile.user_id === session.user.id) {
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
        setCameraError(copy.cameraBrowserUnsupported);
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
        setCameraError(copy.cameraPermissionBlocked);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraSheetOpen]);

  const touchUserStreak = () => {
    setStreak((current) => {
      const next = touchStoredStreak(current, session.user.id);
      void persistDailyState({ streak: next });
      return next;
    });
  };

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
      return false;
    }

    if (data?.user_id === session.user.id) {
      setLogs((items) => items.map((item) => (item.id === optimisticEntry.id ? data : item)));
    }

    return true;
  };

  const persistScanCorrection = async (
    localScanId: string | null,
    originalResult: ImageScanPayload['result'],
    correctedResult: ImageScanPayload['result'],
    correctedNutrition: NutritionFacts,
  ) => {
    if (!localScanId) return false;
    const productKey = scanCorrectionProductKey(correctedResult.productName || originalResult.productName);
    const payload = {
      user_id: session.user.id,
      local_scan_id: localScanId,
      product_key: productKey,
      original_result: originalResult,
      corrected_result: correctedResult,
      corrected_nutrition: correctedNutrition,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('scan_corrections')
      .upsert(payload, { onConflict: 'user_id,local_scan_id' });

    if (error) {
      if (/product_key/i.test(error.message)) {
        const { product_key: _productKey, ...fallbackPayload } = payload;
        const { error: fallbackError } = await supabase
          .from('scan_corrections')
          .upsert(fallbackPayload, { onConflict: 'user_id,local_scan_id' });

        if (!fallbackError) return true;
      }

      console.warn('DigestSnap correction persistence failed.', error.message);
      return false;
    }

    return true;
  };

  const applyReusableScanCorrection = async (scan: ImageScanPayload): Promise<ImageScanPayload> => {
    const productKey = scanCorrectionProductKey(scan.result.productName);
    if (!productKey) return scan;

    const { data, error } = await supabase
      .from('scan_corrections')
      .select('user_id,corrected_result,corrected_nutrition')
      .eq('user_id', session.user.id)
      .eq('product_key', productKey)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle<ScanCorrectionRow>();

    if (error || !data || data.user_id !== session.user.id || !isScanResultLike(data.corrected_result)) {
      return scan;
    }

    const correctedNutrition = normalizeNutritionFacts(data.corrected_nutrition)
      ?? normalizeNutritionFacts(data.corrected_result.nutrition)
      ?? nutritionForResult(data.corrected_result);

    return {
      result: {
        ...data.corrected_result,
        nutrition: correctedNutrition,
        nutritionMeta: {
          source: 'user_corrected',
          confidence: 'high',
          label: isRussian ? 'Питание исправлено' : 'User corrected nutrition',
          detail: isRussian ? 'Использовано ваше последнее исправление для этого продукта' : 'Used your latest correction for this product',
        },
        confidence: {
          level: 'high',
          source: 'user_corrected',
          score: 100,
          label: isRussian ? 'Исправлено вручную' : 'User corrected',
          detail: isRussian ? 'Использовано сохраненное исправление' : 'Used your saved correction',
        },
      },
    };
  };

  const persistFoodEvent = async (scan: RecentScan) => {
    const { error } = await supabase
      .from('food_events')
      .upsert(
        {
          user_id: session.user.id,
          local_scan_id: scan.id,
          product_name: scan.result.productName,
          rating: scan.result.overallRating,
          score: scan.result.score,
          result: scan.result,
          nutrition: scan.nutrition,
          image_data_url: scan.imageDataUrl,
          eaten: typeof scan.eaten === 'boolean' ? scan.eaten : null,
          feeling: scan.feeling ?? null,
          feeling_logged_at: scan.feelingLoggedAt ?? null,
          feeling_delay_minutes: typeof scan.feelingDelayMinutes === 'number' ? scan.feelingDelayMinutes : null,
          food_category: scan.foodCategory ?? deriveFoodCategory(scan.result),
          consumed_at: scan.consumedAt ?? null,
          note: scan.note ?? null,
          created_at: scan.createdAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,local_scan_id' },
      );

    if (error) {
      console.warn('DigestSnap food event persistence failed.', error.message);
      return false;
    }

    return true;
  };

  const updateRecentScan = (id: string | null, patch: Partial<Pick<RecentScan, 'eaten' | 'feeling' | 'feelingLoggedAt' | 'feelingDelayMinutes' | 'foodCategory' | 'consumedAt' | 'nutrition' | 'baseNutrition' | 'portion' | 'result' | 'note'>>) => {
    if (!id) return;
    setRecentScans((items) => {
      let updatedScan: RecentScan | null = null;
      const next = items.map((item) => {
        if (item.id !== id) return item;
        updatedScan = { ...item, ...patch };
        return updatedScan;
      });
      saveRecentScans(next, session.user.id);
      if (updatedScan) void persistFoodEvent(updatedScan);
      return next;
    });
  };

  const openSavedScan = (item: RecentScan) => {
    setScanResult({ result: { ...item.result, nutrition: item.baseNutrition ?? item.result.nutrition ?? item.nutrition } });
    setScanPreviewUrl(item.imageDataUrl);
    setActiveRecentScanId(item.id);
    setSelectedMealStatus(typeof item.eaten === 'boolean' ? (item.eaten ? 'eaten' : 'not_eaten') : null);
    setSelectedFeeling(item.feeling ?? null);
    setSelectedPortion(item.portion ?? 'medium');
    setHistorySheetOpen(false);
    setResultSheetOpen(true);
  };

  const runImageScan = async (file: File | undefined) => {
    if (!file) return;
    setActiveTab('home');
    setScanState('scanning');
    setScanProgress(4);
    setScanProgressText(copy.analyzingImage);
    setSelectedFeeling(null);
    setSelectedMealStatus(null);
    setSelectedPortion('medium');
    setFixResultSheetOpen(false);
    setActiveRecentScanId(null);
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
      const errorNutrition = nutritionForResult(errorResult);
      const errorRecentScan: RecentScan = {
        id: crypto.randomUUID(),
        ownerId: session.user.id,
        imageDataUrl: normalizeImageDataUrl(imageDataUrl),
        result: {
          ...errorResult,
          nutrition: errorNutrition,
        },
        baseNutrition: errorNutrition,
        nutrition: errorNutrition,
        portion: 'medium',
        foodCategory: deriveFoodCategory(errorResult),
        createdAt: new Date().toISOString(),
      };
      window.clearInterval(progressTimer);
      setScanResult(errorScan);
      setScanProgress(100);
      setScanProgressText(isAiCoolingDownResult(errorResult) ? copy.aiCoolingDownTitle : copy.visualUnavailable);
      setScanState('done');
      setScanPreviewUrl((current) => current || normalizeImageDataUrl(imageDataUrl));
      setActiveRecentScanId(errorRecentScan.id);
      setRecentScans((items) => {
        const next = [errorRecentScan, ...items].slice(0, MAX_STORED_SCANS);
        saveRecentScans(next, session.user.id);
        return next;
      });
      void persistFoodEvent(errorRecentScan);
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
      const scanProfile = readStoredProfile(session.user.id) ?? storedProfile;
      const result = await scanImageWithClientTimeout(file, {
        userLang: language,
        userTriggers: getProfileScanTriggers(scanProfile),
        slowAfterMs: 2_500,
        hardTimeoutMs: 18_000,
      });

      if (isHardImageFailure(result.scan)) {
        await saveImageCheckError(normalizeImageDataUrl(result.compressedImage.imageBase64 || stableImageDataUrl, result.compressedImage.mimeType));
        return;
      }

      const correctedScan = await applyReusableScanCorrection(result.scan);
      const scanImageDataUrl = normalizeImageDataUrl(result.compressedImage.imageBase64 || stableImageDataUrl, result.compressedImage.mimeType);
      const nutrition = nutritionForResult(correctedScan.result);
      const normalizedScan: ImageScanPayload = {
        result: {
          ...correctedScan.result,
          nutrition,
        },
      };
      const recentId = crypto.randomUUID();
      window.clearInterval(progressTimer);
      setScanResult(normalizedScan);
      setScanPreviewUrl(scanImageDataUrl);
      setScanProgress(100);
      setScanProgressText(copy.savedRecent);
      setScanState('done');
      await saveEntry(`${normalizedScan.result.overallRating}: ${normalizedScan.result.productName} scored ${normalizedScan.result.score}/100`);
      const recentScan: RecentScan = {
        id: recentId,
        ownerId: session.user.id,
        imageDataUrl: scanImageDataUrl,
        result: normalizedScan.result,
        baseNutrition: nutrition,
        nutrition,
        portion: 'medium',
        foodCategory: deriveFoodCategory(normalizedScan.result),
        createdAt: new Date().toISOString(),
      };
      setActiveRecentScanId(recentId);
      setRecentScans((items) => {
        const next = [recentScan, ...items].slice(0, MAX_STORED_SCANS);
        saveRecentScans(next, session.user.id);
        return next;
      });
      touchUserStreak();
      void persistFoodEvent(recentScan);
      window.setTimeout(() => setResultSheetOpen(true), 450);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      await saveImageCheckError(stableImageDataUrl, message);
    }
  };

  const runMenuDishScan = async () => {
    const dishName = menuDishInput.trim();
    if (dishName.length < 2 || menuDishScanning) return;

    setMenuDishScanning(true);
    setCameraSheetOpen(false);
    setActiveTab('home');
    setScanState('scanning');
    setScanProgress(12);
    setScanProgressText(copy.menuFallbackLoading);
    setSelectedFeeling(null);
    setSelectedMealStatus(null);
    setSelectedPortion('medium');
    setFixResultSheetOpen(false);
    setActiveRecentScanId(null);
    setResultSheetOpen(false);

    const thumbnail = createMenuScanThumbnail(dishName);
    setScanPreviewUrl(thumbnail);
    const progressTimer = window.setInterval(() => {
      setScanProgress((current) => Math.min(92, current + 9));
    }, 260);

    try {
      const scanProfile = readStoredProfile(session.user.id) ?? storedProfile;
      const result = await scanFoodTextWithClientTimeout({
        dishName,
        productKey: dishName,
        userLang: language,
        userTriggers: getProfileScanTriggers(scanProfile),
        slowAfterMs: 1_800,
        hardTimeoutMs: 9_000,
      });
      const correctedScan = await applyReusableScanCorrection(result);
      const nutrition = nutritionForResult(correctedScan.result);
      const normalizedScan: ImageScanPayload = {
        result: {
          ...correctedScan.result,
          nutrition,
        },
      };
      const recentId = crypto.randomUUID();
      const recentScan: RecentScan = {
        id: recentId,
        ownerId: session.user.id,
        imageDataUrl: thumbnail,
        result: normalizedScan.result,
        baseNutrition: nutrition,
        nutrition,
        portion: 'medium',
        foodCategory: deriveFoodCategory(normalizedScan.result),
        createdAt: new Date().toISOString(),
      };

      await saveEntry(`${normalizedScan.result.overallRating}: ${normalizedScan.result.productName} scored ${normalizedScan.result.score}/100`);
      window.clearInterval(progressTimer);
      setScanResult(normalizedScan);
      setScanProgress(100);
      setScanProgressText(copy.savedRecent);
      setScanState('done');
      setActiveRecentScanId(recentId);
      setRecentScans((items) => {
        const next = [recentScan, ...items].slice(0, MAX_STORED_SCANS);
        saveRecentScans(next, session.user.id);
        return next;
      });
      setMenuDishInput('');
      touchUserStreak();
      void persistFoodEvent(recentScan);
      window.setTimeout(() => setResultSheetOpen(true), 450);
    } catch {
      window.clearInterval(progressTimer);
      setScanState('error');
      setScanProgress(0);
      setScanProgressText(copy.cameraCaptureError);
    } finally {
      setMenuDishScanning(false);
    }
  };

  const openCamera = () => {
    setResultSheetOpen(false);
    setCameraSheetOpen(true);
  };

  const captureCameraFrame = async () => {
    if (cameraCapturing) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setCameraError(copy.cameraLoading);
      return;
    }

    setCameraCapturing(true);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1080;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraCapturing(false);
      setCameraError(copy.cameraCaptureError);
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) {
      setCameraCapturing(false);
      setCameraError(copy.cameraCaptureError);
      return;
    }

    const file = new File([blob], `digestisnap-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
    setCameraSheetOpen(false);
    setCameraCapturing(false);
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
      setProfileFormMessage({ tone: 'error', text: copy.profileNameRequired });
      return;
    }

    if (nextUsername.length < 3) {
      setProfileFormMessage({ tone: 'error', text: copy.profileUsernameShort });
      return;
    }

    setProfileSaving(true);
    setProfileFormMessage(null);

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
      setProfileFormMessage({
        tone: 'error',
        text: /profiles_username|username/i.test(error?.message ?? '') ? copy.profileUsernameTaken : copy.profileSaveError,
      });
      return;
    }

    setProfileName(data.full_name);
    setProfileUsername(data.username);
    setProfileDraftName(data.full_name);
    setProfileDraftUsername(data.username);
    setProfileSheetOpen(false);
    setProfileFormMessage({ tone: 'success', text: copy.profileSaved });
  };

  const signOut = async () => {
    clearUserLocalData(session.user.id);
    await supabase.auth.signOut();
    navigate('/');
  };

  const exportAccountData = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      account: {
        id: session.user.id,
        email: session.user.email ?? null,
        fullName: profileName,
        username: profileUsername,
      },
      profile: storedProfile,
      streak: readStoredStreak(session.user.id),
      water: {
        amountMl: waterMl,
        unit: waterUnit,
      },
      entries: logs,
      scans: ownedRecentScans.map((scan) => ({
        id: scan.id,
        createdAt: scan.createdAt,
        consumedAt: scan.consumedAt ?? null,
        eaten: scan.eaten ?? null,
        feeling: scan.feeling ?? null,
        note: scan.note ?? null,
        productName: scan.result.productName,
        rating: scan.result.overallRating,
        score: scan.result.score,
        confidence: scan.result.confidence ?? null,
        nutrition: scan.nutrition,
        flags: scan.result.flaggedChemicals,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `digestsnap-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const deleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw error;
      clearUserLocalData(session.user.id);
      await supabase.auth.signOut();
      navigate('/');
    } catch {
      setDeleteError(copy.deleteError);
      setDeleteLoading(false);
    }
  };

  const visibleLogs = logs.filter((item) => !/check-in saved|unreadable label|image check error|ai cooling|visual estimate unavailable|визуальная оценка недоступна/i.test(item.title));
  const ownedRecentScans = recentScans.filter((scan) => !scan.ownerId || scan.ownerId === session.user.id);
  const latestSavedScan = ownedRecentScans[0];
  const hasActivity = ownedRecentScans.some((scan) => !isImageCheckErrorResult(scan.result));
  const isRussian = language === 'Russian';
  const validScoredScans = ownedRecentScans.filter((scan) => !isImageCheckErrorResult(scan.result));
  const scanCount = validScoredScans.length;
  const recentAverageScore = validScoredScans.length
    ? Math.round(validScoredScans.slice(0, 7).reduce((sum, scan) => sum + scan.result.score, 0) / validScoredScans.slice(0, 7).length)
    : null;
  const gutScoreOutOfTen = recentAverageScore === null ? null : Math.max(1, Math.round(recentAverageScore / 10));
  const latestTitle = scanResult?.result.productName ?? latestSavedScan?.result.productName ?? visibleLogs[0]?.title ?? '';
  const latestReason = scanResult?.result.flaggedChemicals[0]?.reason ?? latestSavedScan?.result.flaggedChemicals[0]?.reason ?? '';
  const profileBmi = getBmiFromProfile(storedProfile);
  const today = new Date();
  const homeWeek = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + index);
    return {
      day: date.toLocaleDateString(isRussian ? 'ru-RU' : 'en-US', { weekday: 'short' }),
      date: String(date.getDate()),
      key: date.toDateString(),
      selected: date.toDateString() === selectedHomeDate,
      future: date > today,
    };
  });
  const checkInCount = ownedRecentScans.filter((item) => item.eaten === true && item.feeling).length;
  const laterCheckInCandidate = ownedRecentScans.find((item) => item.eaten === true && !item.feeling && !isImageCheckErrorResult(item.result));
  const laterCheckInAge = laterCheckInCandidate?.consumedAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(laterCheckInCandidate.consumedAt)) / (60 * 60 * 1000)))
    : null;
  const latestScore = scanResult?.result.score ?? latestSavedScan?.result.score ?? null;
  const latestRating = scanResult?.result.overallRating ?? latestSavedScan?.result.overallRating ?? null;
  const homeHeroTitle = laterCheckInCandidate
    ? isRussian ? 'Проверка' : 'Check in'
    : latestScore !== null
      ? isRussian ? 'Сохранено' : 'Saved'
      : isRussian ? 'Готово' : 'Ready';
  const homeHeroSubtitle = laterCheckInCandidate
    ? isRussian
      ? `Отметьте самочувствие после ${laterCheckInCandidate.result.productName}`
      : `Log how you felt after ${laterCheckInCandidate.result.productName}`
    : latestScore !== null
      ? latestRating ?? (isRussian ? 'Результат сохранен' : 'Result saved')
      : isRussian ? 'Первый снимок начнет вашу историю' : 'Your first photo starts the timeline';
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
      ? isRussian ? 'Сделайте первый скан, чтобы появился счет' : 'Your first clear scan creates the score'
      : isRussian ? 'Счет отражает последние сканы и отметки самочувствия' : 'Score reflects recent scans and feeling logs';
  const waterOz = waterMl / 29.5735;
  const waterCardLabel = waterUnit === 'ml' ? `${Math.round(waterMl)} mL` : `${Math.round(waterOz)} fl oz`;
  const calorieMode = getCalorieGoalMode(storedProfile);
  const maintenanceCalories = estimateDailyCalories(storedProfile);
  const calorieTarget =
    calorieMode === 'gain'
      ? maintenanceCalories + 350
      : calorieMode === 'lose'
        ? Math.max(1200, maintenanceCalories - 350)
        : maintenanceCalories;
  const calorieTargetReason =
    calorieMode === 'gain'
      ? isRussian ? 'Профиль добавляет умеренный запас к поддержке веса' : 'Your profile adds a moderate surplus to maintenance'
      : calorieMode === 'lose'
        ? isRussian ? 'Профиль ставит умеренный дефицит от поддержки веса' : 'Your profile sets a moderate deficit from maintenance'
        : isRussian ? 'Профиль держит цель около поддержки веса' : 'Your profile keeps the target near maintenance';
  const selectedDayScans = ownedRecentScans.filter((item) => isSameLocalDay(item.createdAt, selectedHomeDate));
  const selectedDayEatenScans = selectedDayScans.filter(isNutritionCountedScan);
  const selectedDayFeelingCount = selectedDayScans.filter((item) => item.eaten === true && item.feeling).length;
  const selectedDayAverageScore = selectedDayScans.length
    ? Math.round(selectedDayScans.reduce((sum, item) => sum + item.result.score, 0) / selectedDayScans.length)
    : null;
  const inAppReminder = laterCheckInCandidate
    ? {
        kind: 'checkin' as const,
        title: isRussian ? 'Проверить самочувствие' : 'Check in on this meal',
        body: `${laterCheckInCandidate.result.productName} · ${laterCheckInAge === null ? (isRussian ? 'позже' : 'later') : laterCheckInAge === 0 ? (isRussian ? 'только что' : 'just now') : `${laterCheckInAge}h ago`}`,
        action: () => openSavedScan(laterCheckInCandidate),
      }
    : null;
  const eatenNutrition = addNutritionValues(selectedDayEatenScans.map((item) => item.nutrition));
  const caloriesEaten = eatenNutrition.calories;
  const remainingCalories = Math.max(0, calorieTarget - caloriesEaten);
  const dailyNutritionSummary =
    selectedDayEatenScans.length === 0
      ? isRussian
        ? 'Питание считается только после отметки “съел”'
        : 'Nutrition counts only after you mark a scan as eaten'
      : isRussian
        ? `${selectedDayEatenScans.length} съеденный скан учтен сегодня`
        : `${selectedDayEatenScans.length} eaten scan${selectedDayEatenScans.length === 1 ? '' : 's'} counted today`;
  const weightKg = storedProfile?.weightKg && storedProfile.weightKg > 0 ? storedProfile.weightKg : 70;
  const proteinTarget = Math.round(weightKg * (calorieMode === 'gain' ? 2 : calorieMode === 'lose' ? 1.8 : 1.6));
  const fatTarget = Math.round((calorieTarget * 0.27) / 9);
  const carbsTarget = Math.max(90, Math.round((calorieTarget - proteinTarget * 4 - fatTarget * 9) / 4));
  const macroCards = [
    { label: isRussian ? 'Калории' : 'Calories', value: caloriesEaten, target: calorieTarget, unit: '', icon: 'Cal', color: 'text-zinc-950' },
    { label: isRussian ? 'Белок' : 'Protein', value: eatenNutrition.proteinG, target: proteinTarget, unit: 'g', icon: 'P', color: 'text-red-500' },
    { label: isRussian ? 'Углеводы' : 'Carbs', value: eatenNutrition.carbsG, target: carbsTarget, unit: 'g', icon: 'C', color: 'text-amber-500' },
    { label: isRussian ? 'Жиры' : 'Fat', value: eatenNutrition.fatG, target: fatTarget, unit: 'g', icon: 'F', color: 'text-blue-500' },
  ];
  const nutritionDetailCards = [
    { label: isRussian ? 'Клетчатка' : 'Fiber', value: eatenNutrition.fiberG ?? 0, target: 30, unit: 'g' },
    { label: isRussian ? 'Сахар' : 'Sugar', value: eatenNutrition.sugarG ?? 0, target: 50, unit: 'g' },
    { label: isRussian ? 'Натрий' : 'Sodium', value: eatenNutrition.sodiumMg ?? 0, target: 2300, unit: 'mg' },
  ];
  const manualWaterNumber = Number(manualWaterAmount);
  const manualWaterMl =
    Number.isFinite(manualWaterNumber) && manualWaterNumber > 0
      ? waterUnit === 'oz'
        ? manualWaterNumber * 29.5735
        : manualWaterNumber
      : 0;
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
    profileNameRequired: isRussian ? 'Введите имя для профиля' : 'Add a profile name',
    profileUsernameShort: isRussian ? 'Username должен быть минимум 3 символа' : 'Username must be at least 3 characters',
    profileUsernameTaken: isRussian ? 'Этот username уже занят' : 'That username is already taken',
    profileSaveError: isRussian ? 'Не удалось сохранить профиль. Попробуйте еще раз' : 'Could not save profile. Try again',
    profileSaved: isRussian ? 'Профиль сохранен' : 'Profile saved',
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
    exportData: isRussian ? 'Скачать данные' : 'Export Data',
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
    savedRecent: isRussian ? 'Сохранено в последние сканы' : 'Saved to Recent scans',
    visualUnavailable: isRussian ? 'Визуальная оценка недоступна' : 'Saved with visual estimate unavailable',
    uploadedImage: isRussian ? 'загруженное фото' : 'uploaded image',
    cameraLoading: isRussian ? 'Камера еще загружается. Попробуйте через секунду.' : 'Camera is still loading. Try again in a second.',
    cameraCaptureError: isRussian ? 'Не удалось сделать снимок. Держите продукт внутри рамки.' : 'Unable to capture this frame. Try again with the label inside the square.',
    cameraBrowserUnsupported: isRussian ? 'Камера недоступна в этом браузере. Откройте DigestSnap в браузере с доступом к камере.' : 'Camera is not available in this browser. Open DigestSnap in a browser with camera access.',
    cameraPermissionBlocked: isRussian ? 'Доступ к камере заблокирован. Разрешите камеру и попробуйте снова.' : 'Camera permission is blocked. Allow camera access and try again.',
    cameraTitle: isRussian ? 'Камера DigestSnap' : 'DigestSnap camera',
    cameraSubtitle: isRussian ? 'Заполните рамку продуктом или этикеткой' : 'Fill the square with the label',
    cameraHint: isRussian ? 'Держите состав четко и ровно' : 'Keep ingredients sharp and flat',
    cameraUnavailable: isRussian ? 'Камера недоступна' : 'Camera unavailable',
    menuFallbackTitle: isRussian ? 'Нет фото? Введите блюдо' : 'No photo? Type the dish',
    menuFallbackPlaceholder: isRussian ? 'Например: курица терияки' : 'Example: chicken teriyaki',
    menuFallbackAction: isRussian ? 'Проверить' : 'Check',
    menuFallbackLoading: isRussian ? 'Проверяем блюдо...' : 'Checking dish...',
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
  const getScanConfidence = (result: ImageScanPayload['result']) => {
    if (result.confidence) {
      const className =
        result.confidence.level === 'high'
          ? 'bg-emerald-50 text-emerald-950 ring-emerald-200'
          : result.confidence.level === 'medium'
            ? 'bg-zinc-100 text-zinc-800 ring-zinc-200'
            : 'bg-amber-50 text-amber-950 ring-amber-200';

      return {
        label: result.confidence.label,
        detail: result.confidence.detail,
        className,
      };
    }

    const scanText = [
      result.productName,
      ...result.flaggedChemicals.flatMap((item) => [item.chemicalName, item.reason]),
    ].join(' ').toLowerCase();

    if (isImageCheckErrorResult(result) || isAiCoolingDownResult(result)) {
      return {
        label: isRussian ? 'Нужна проверка' : 'Needs confirmation',
        detail: isRussian ? 'Фото сохранено, но результату нельзя доверять полностью' : 'Saved, but this result should not be trusted yet',
        className: 'bg-amber-50 text-amber-950 ring-amber-200',
      };
    }

    if (/likely|visual|estimate|label not verified|category|вероят|визуальн|оценк|состав не подтвержден/i.test(scanText)) {
      return {
        label: isRussian ? 'Визуальная оценка' : 'Visual estimate',
        detail: isRussian ? 'AI распознал еду по фото, порция и состав примерные' : 'AI recognized the food visually; portion and label are estimated',
        className: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
      };
    }

    return {
      label: isRussian ? 'AI оценка' : 'AI estimate',
      detail: isRussian ? 'Проверьте порцию ниже перед учетом в калориях' : 'Confirm the portion below before counting calories',
      className: 'bg-white text-zinc-700 ring-zinc-200',
    };
  };
  const getNutritionMeta = (result: ImageScanPayload['result']) => {
    if (shouldSuppressUnverifiedPackagedNutrition(result)) {
      return {
        source: 'unknown' as const,
        confidence: 'low' as const,
        label: isRussian ? 'Питание не подтверждено' : 'Nutrition not confirmed',
        detail: isRussian ? 'Для упаковки нужны база, этикетка или ручное исправление' : 'Packaged nutrition needs database data, a readable label, or a manual correction',
      };
    }

    if (result.nutritionMeta) {
      return result.nutritionMeta;
    }

    const source = result.confidence?.source;
    if (source === 'database_match') {
      return {
        source: 'database' as const,
        confidence: 'high' as const,
        label: isRussian ? 'Питание из базы' : 'Database nutrition',
        detail: isRussian ? 'Калории и макросы взяты из продуктовой базы' : 'Calories and macros use product database data',
      };
    }

    if (source === 'visual_estimate') {
      return {
        source: 'visual_estimate' as const,
        confidence: 'medium' as const,
        label: isRussian ? 'Визуальная оценка питания' : 'Visual nutrition estimate',
        detail: isRussian ? 'Питание примерно оценено по фото и обычной порции' : 'Nutrition is estimated from the photo and a normal serving',
      };
    }

    if (source === 'manual_text') {
      return {
        source: 'manual_estimate' as const,
        confidence: 'medium' as const,
        label: isRussian ? 'Оценка по тексту' : 'Text-based estimate',
        detail: isRussian ? 'Питание оценено по введенному названию или составу' : 'Nutrition is estimated from typed food or label text',
      };
    }

    if (source === 'user_corrected') {
      return {
        source: 'user_corrected' as const,
        confidence: 'high' as const,
        label: isRussian ? 'Питание исправлено' : 'User corrected nutrition',
        detail: isRussian ? 'Калории и макросы исправлены вручную' : 'Calories and macros were edited manually',
      };
    }

    return {
      source: 'label_estimate' as const,
      confidence: 'medium' as const,
      label: isRussian ? 'Оценка по этикетке' : 'Label-based estimate',
      detail: isRussian ? 'Питание оценено по этикетке, упаковке или категории' : 'Nutrition is estimated from label, packaging, or product category',
    };
  };
  const getPortionConfidence = (result: ImageScanPayload['result']) => {
    const source = result.confidence?.source;
    const basisText = `${result.basis?.portionBasis ?? ''} ${result.basis?.decisionBasis ?? ''}`.toLowerCase();
    const hasPackageBasis =
      /\b(package|pack|serving|portion|bottle|can|bar|slice|piece|ml|g|gram|oz|cup)\b|упаков|порци|бутыл|банка|батончик|кусок|мл|г\b/i.test(basisText);

    if (isImageCheckErrorResult(result) || isAiCoolingDownResult(result)) {
      return {
        label: isRussian ? 'Порция не подтверждена' : 'Portion not confirmed',
        detail: isRussian ? 'Фото сохранено, но порцию лучше проверить вручную' : 'Saved, but confirm the serving before counting it',
        score: 30,
        bar: 'bg-amber-500',
        className: 'bg-amber-50 text-amber-950 ring-amber-200',
      };
    }

    if (source === 'user_corrected') {
      return {
        label: isRussian ? 'Порция исправлена' : 'Serving corrected',
        detail: isRussian ? 'Эта оценка основана на вашем исправлении' : 'This estimate uses your saved correction',
        score: 100,
        bar: 'bg-emerald-600',
        className: 'bg-emerald-50 text-emerald-950 ring-emerald-200',
      };
    }

    if ((source === 'database_match' || source === 'label_read' || source === 'manual_text') && hasPackageBasis) {
      return {
        label: isRussian ? 'Сильная основа порции' : 'Strong serving basis',
        detail: isRussian ? 'Оценка опирается на упаковку, базу продукта или явную порцию' : 'Uses package, product data, or a visible serving cue',
        score: 86,
        bar: 'bg-emerald-600',
        className: 'bg-emerald-50 text-emerald-950 ring-emerald-200',
      };
    }

    if (source === 'visual_estimate' || /visual|estimate|normal serving|category|визуальн|оценк|обычн/i.test(basisText)) {
      return {
        label: isRussian ? 'Визуальная порция' : 'Visual serving estimate',
        detail: isRussian ? 'Подходит для быстрого лога, но порцию стоит уточнить' : 'Good for a quick log, but adjust if the serving looks off',
        score: 62,
        bar: 'bg-zinc-900',
        className: 'bg-white text-zinc-800 ring-zinc-200',
      };
    }

    return {
      label: isRussian ? 'Средняя уверенность' : 'Medium serving confidence',
      detail: isRussian ? 'Перед учетом калорий проверьте размер порции' : 'Check serving size before counting calories',
      score: 55,
      bar: 'bg-zinc-900',
      className: 'bg-white text-zinc-800 ring-zinc-200',
    };
  };
  const getBetterAlternative = (result: ImageScanPayload['result']) => {
    if (isImageCheckErrorResult(result)) return null;
    if (result.overallRating === 'Safe' && result.score >= 75) return null;

    const name = result.productName.toLowerCase();
    const flagged = result.flaggedChemicals.map((item) => `${item.chemicalName} ${item.reason}`.toLowerCase()).join(' ');
    const text = `${name} ${flagged}`;
    const matches = (patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

    if (matches([/\bcola\b/i, /\bsoda\b/i, /\bfanta\b/i, /\bsprite\b/i, /\bfuse\b/i, /\biced?\s*tea\b/i, /\benergy\b/i, /газиров/i, /кола/i, /айс\s*ти/i, /холодн\w*\s+чай/i, /энергет/i])) {
      return {
        title: isRussian ? 'Напиток без сахара из той же категории' : 'Same-category zero-sugar drink',
        reason: isRussian ? 'Оставляет формат напитка, но убирает главный сахарный удар' : 'Keeps the drink format while cutting the main sugar hit',
      };
    }

    if (matches([/\bchips?\b/i, /\bcrisps?\b/i, /\bnachos?\b/i, /\bcrackers?\b/i, /чипс/i, /сухар/i, /снэк/i, /snack/i])) {
      return {
        title: isRussian ? 'Запеченные чипсы или простой попкорн' : 'Baked chips or plain popcorn',
        reason: isRussian ? 'Та же хрустящая закуска, меньше масла и тяжелых добавок' : 'Same crunchy snack lane, less oil and fewer heavy additives',
      };
    }

    if (matches([/\bburger\b/i, /\bfries\b/i, /\bfried\b/i, /\bnuggets?\b/i, /\bchicken\s*wings?\b/i, /бургер/i, /картошк\w*\s*фри/i, /жарен/i, /наггет/i])) {
      return {
        title: isRussian ? 'Гриль-версия того же блюда' : 'Grilled version of the same meal',
        reason: isRussian ? 'Остается тот же тип еды, но меньше жарки и тяжелого масла' : 'Same meal type, with less frying oil and heaviness',
      };
    }

    if (matches([/\bchocolate\b/i, /\bcandy\b/i, /\bbar\b/i, /\bkinder\b/i, /\bcookie\b/i, /\bcake\b/i, /\bwafer\b/i, /шоколад/i, /конфет/i, /батончик/i, /киндер/i, /печень/i, /вафл/i, /пирож/i, /ломтик/i])) {
      return {
        title: isRussian ? 'Сладкий батончик с меньшим сахаром' : 'Lower-sugar sweet bar',
        reason: isRussian ? 'Та же сладкая категория, но легче по сахару и составу' : 'Same sweet-snack category, lighter on sugar and ingredients',
      };
    }

    if (matches([/\bbread\b/i, /\btoast\b/i, /\bpastry\b/i, /\bcroissant\b/i, /\bbun\b/i, /\bwrap\b/i, /хлеб/i, /булоч/i, /круас/i, /лаваш/i, /выпеч/i])) {
      return {
        title: isRussian ? 'Хлеб из той же категории, но проще по составу' : 'Same bread category, cleaner label',
        reason: isRussian ? 'Оставляет формат хлеба, но снижает лишний сахар и добавки' : 'Keeps the bread format while reducing sugar and additives',
      };
    }

    if (matches([/\bmilk\b/i, /\byogurt\b/i, /\bcream\b/i, /\bcheese\b/i, /\bdairy\b/i, /\blactose\b/i, /молоч/i, /молок/i, /йогурт/i, /сыр/i, /сливк/i, /лактоз/i])) {
      return {
        title: isRussian ? 'Безлактозная версия того же продукта' : 'Lactose-free version of the same product',
        reason: isRussian ? 'Та же молочная категория, но мягче для чувствительного желудка' : 'Same dairy category, gentler for sensitive digestion',
      };
    }

    if (matches([/\bpasta\b/i, /\bmacaroni\b/i, /\bnoodles?\b/i, /\bramen\b/i, /\binstant\b/i, /макарон/i, /лапш/i, /рамен/i, /доширак/i])) {
      return {
        title: isRussian ? 'Паста с более простым составом' : 'Cleaner pasta in the same lane',
        reason: isRussian ? 'Остается пастой, но меньше соусов, соли и добавок' : 'Still pasta, with less sauce, sodium, and additives',
      };
    }

    if (matches([/\bjuice\b/i, /\bnectar\b/i, /\bsmoothie\b/i, /сок/i, /нектар/i, /смузи/i])) {
      return {
        title: isRussian ? 'Сок без сахара или меньшая порция' : 'No-added-sugar juice or smaller serving',
        reason: isRussian ? 'Та же категория напитка, но меньше сахарной нагрузки' : 'Same drink category with a lower sugar load',
      };
    }

    return {
      title: isRussian ? 'Более простой вариант из той же категории' : 'Cleaner option from the same category',
      reason: isRussian ? 'Меняйте внутри того же типа еды, чтобы сравнение было честным' : 'Swap inside the same food type so the comparison stays fair',
    };
  };
  const betterAlternative = scanResult ? getBetterAlternative(scanResult.result) : null;
  const isResultImageCheckError = scanResult ? isImageCheckErrorResult(scanResult.result) : false;
  const isResultAiCoolingDown = scanResult ? isAiCoolingDownResult(scanResult.result) : false;
  const resultTone = scanResult ? ratingTone(scanResult.result.overallRating) : ratingTone('Caution');
  const baseScanNutrition = scanResult ? nutritionForResult(scanResult.result) : null;
  const scanNutrition = baseScanNutrition ? scaleNutritionFacts(baseScanNutrition, selectedPortion) : null;
  const nutritionMeta = scanResult ? getNutritionMeta(scanResult.result) : null;
  const scanConfidence = scanResult ? getScanConfidence(scanResult.result) : null;
  const portionConfidence = scanResult ? getPortionConfidence(scanResult.result) : null;
  const resultScoreLabel = scanResult
    ? isResultImageCheckError
      ? '--'
      : `${scanResult.result.score}/100`
    : '--';
  const resultConfidenceShort = scanResult
    ? isResultImageCheckError || isResultAiCoolingDown
      ? isRussian
        ? 'Низк'
        : 'Low'
      : scanResult.result.confidence?.level === 'high'
        ? isRussian
          ? 'Выс'
          : 'High'
        : scanResult.result.confidence?.level === 'medium'
          ? isRussian
            ? 'Сред'
            : 'Med'
          : isRussian
            ? 'Низк'
            : 'Low'
    : '--';
  const resultNextAction = scanResult
    ? isResultImageCheckError
      ? isRussian
        ? 'Фото сохранено как неуверенный скан. Сделайте снимок резче, если нужна оценка'
        : 'Saved as an uncertain scan. Retake a sharper photo if you need a real score'
      : selectedMealStatus === 'eaten'
        ? selectedFeeling
          ? isRussian
            ? 'Готово: еда и самочувствие связаны в таймлайне'
            : 'Done: meal and feeling are connected in your timeline'
          : isRussian
            ? 'Еда учтена. Теперь отметьте самочувствие сейчас или позже'
            : 'Meal counted. Add how you feel now or later'
        : selectedMealStatus === 'not_eaten'
          ? isRussian
            ? 'Скан сохранен только для проверки и не влияет на дневные итоги'
            : 'Saved for checking only, not counted in your daily totals'
          : isRussian
            ? 'Дальше выберите: съели это или просто проверяли'
            : 'Next, choose whether you ate it or were just checking'
    : '';
  const resultNutritionSummary = scanResult
    ? scanNutrition && scanNutrition.calories > 0
      ? `${scanNutrition.calories} cal`
      : isRussian
        ? 'Не подтв.'
        : 'Unconfirmed'
    : '--';
  const resultSnapshotItems = scanResult
    ? [
        [isRussian ? 'Вердикт' : 'Verdict', isResultImageCheckError ? copy.needsRetake : ratingLabel(scanResult.result.overallRating)],
        [isRussian ? 'Оценка' : 'Score', resultScoreLabel],
        [isRussian ? 'Доверие' : 'Trust', resultConfidenceShort],
        [isRussian ? 'Питание' : 'Nutrition', resultNutritionSummary],
      ]
    : [];
  const aiIdentifiedText = scanResult
    ? isResultImageCheckError
      ? isRussian ? 'Фото сохранено, но AI не уверен в еде' : 'Image saved, but AI is not confident about the food'
      : scanResult.result.productName
    : '';
  const aiObservedDetail = scanResult
    ? isResultImageCheckError
      ? isRussian
        ? 'Снимок сохранен, но визуальный сигнал слабый'
        : 'Photo was saved, but the visual signal is weak'
      : scanResult.result.confidence?.source === 'database_match'
        ? isRussian
          ? 'Название сверено с продуктовой базой'
          : 'Name was matched against product data'
        : scanResult.result.confidence?.source === 'label_read'
          ? isRussian
            ? 'AI использовал видимый текст на упаковке'
            : 'AI used visible package text'
          : scanResult.result.confidence?.source === 'manual_text'
            ? isRussian
              ? 'Основано на введенном названии или составе'
              : 'Based on the typed name or label'
            : isRussian
              ? 'Основано на форме, упаковке и видимых деталях'
              : 'Based on shape, package, and visible cues'
    : '';
  const aiEstimatedText = scanResult
    ? scanResult.result.basis?.decisionBasis ?? scanConfidence?.detail ?? (isRussian ? 'Оценка основана на фото и категории' : 'Estimate based on the image and food category')
    : '';
  const aiEstimatedDetail = scanResult
    ? isResultImageCheckError
      ? isRussian
        ? 'Оценка выключена, пока фото не станет надежнее'
        : 'Scoring is held back until the photo is reliable'
      : nutritionMeta?.confidence === 'high'
        ? isRussian
          ? 'Оценка сильнее, потому что есть база, этикетка или исправление'
          : 'Estimate is stronger because database, label, or correction data is present'
        : isRussian
          ? 'Порция и питание могут быть примерными'
          : 'Serving and nutrition may still be approximate'
    : '';
  const activeSavedScan = activeRecentScanId ? ownedRecentScans.find((scan) => scan.id === activeRecentScanId) : undefined;
  const activeScanNote = activeSavedScan?.note ?? '';
  const nutritionDraftFromFacts = (nutrition: NutritionFacts) => ({
    calories: String(nutrition.calories),
    proteinG: String(nutrition.proteinG),
    carbsG: String(nutrition.carbsG),
    fatG: String(nutrition.fatG),
    fiberG: String(nutrition.fiberG ?? 0),
    sugarG: String(nutrition.sugarG ?? 0),
    sodiumMg: String(nutrition.sodiumMg ?? 0),
  });
  const setCorrectionServingMultiplier = (multiplier: number) => {
    if (!scanResult) return;
    const baseNutrition = scanNutrition ?? nutritionForResult(scanResult.result);
    const nextNutrition = scaleNutritionByMultiplier(baseNutrition, multiplier);
    setFixDraft((current) => ({
      ...current,
      servingMultiplier: String(multiplier),
      ...nutritionDraftFromFacts(nextNutrition),
    }));
  };
  const openFixResultSheet = () => {
    if (!scanResult) return;
    const nutrition = scanNutrition ?? nutritionForResult(scanResult.result);
    setFixDraft({
      productName: scanResult.result.productName,
      rating: scanResult.result.overallRating,
      reason: scanResult.result.flaggedChemicals[0]?.reason ?? '',
      portionBasis: scanResult.result.basis?.portionBasis ?? '',
      servingMultiplier: '1',
      score: String(scanResult.result.score),
      ...nutritionDraftFromFacts(nutrition),
    });
    setFixResultSheetOpen(true);
  };
  const saveFixedScanResult = async () => {
    if (!scanResult) return;
    const originalResult = scanResult.result;
    const fixedNutrition: NutritionFacts = {
      calories: nutritionNumber(fixDraft.calories),
      proteinG: nutritionNumber(fixDraft.proteinG),
      carbsG: nutritionNumber(fixDraft.carbsG),
      fatG: nutritionNumber(fixDraft.fatG),
      fiberG: nutritionNumber(fixDraft.fiberG),
      sugarG: nutritionNumber(fixDraft.sugarG),
      sodiumMg: nutritionNumber(fixDraft.sodiumMg),
    };
    const fixedScore = Math.max(0, Math.min(100, nutritionNumber(fixDraft.score, scanResult.result.score)));
    const correctedReason = fixDraft.reason.trim() || (isRussian ? 'Результат исправлен пользователем' : 'Result corrected by user');
    const servingMultiplier = Number(fixDraft.servingMultiplier);
    const servingBasis = fixDraft.portionBasis.trim() || (isRussian ? 'Порция исправлена пользователем' : 'Serving corrected by user');
    const servingSuffix = Number.isFinite(servingMultiplier) && servingMultiplier > 0 && servingMultiplier !== 1 ? ` (${servingMultiplier}x)` : '';
    const fixedResult: ImageScanPayload['result'] = {
      ...scanResult.result,
      productName: fixDraft.productName.trim() || scanResult.result.productName,
      score: fixedScore,
      overallRating: fixDraft.rating,
      nutrition: fixedNutrition,
      nutritionMeta: {
        source: 'user_corrected',
        confidence: 'high',
        label: isRussian ? 'Питание исправлено' : 'User corrected nutrition',
        detail: correctedReason,
      },
      confidence: {
        level: 'high',
        source: 'user_corrected',
        score: 100,
        label: isRussian ? 'Исправлено вручную' : 'User corrected',
        detail: correctedReason,
      },
      basis: {
        portionBasis: `${servingBasis}${servingSuffix}`,
        decisionBasis: correctedReason,
      },
      flaggedChemicals: [
        {
          chemicalName: isRussian ? 'Исправлено пользователем' : 'User corrected',
          severity: fixDraft.rating,
          reason: correctedReason,
        },
        ...scanResult.result.flaggedChemicals.filter((item) => !/user corrected|исправлено/i.test(item.chemicalName)).slice(0, 2),
      ],
    };

    setSelectedPortion('medium');
    setScanResult({ result: fixedResult });
    updateRecentScan(activeRecentScanId, {
      result: fixedResult,
      baseNutrition: fixedNutrition,
      nutrition: fixedNutrition,
      portion: 'medium',
    });
    void persistScanCorrection(activeRecentScanId, originalResult, fixedResult, fixedNutrition);
    setFixResultSheetOpen(false);
  };
  const resultReasons = scanResult
    ? (scanResult.result.flaggedChemicals.length ? scanResult.result.flaggedChemicals : [
        {
          chemicalName: copy.noMajorFlags,
          severity: scanResult.result.overallRating,
          reason: copy.noMajorFlagsReason,
        },
      ]).slice(0, 2)
    : [];
  const scanResultSearchText = scanResult
    ? [
        scanResult.result.productName,
        ...scanResult.result.flaggedChemicals.flatMap((item) => [item.chemicalName, item.reason]),
      ].join(' ').toLowerCase()
    : '';
  const hardAvoidWarnings = Array.from(new Set((storedProfile?.allergies ?? []).filter((item) => item && item !== 'None'))).filter((term) => {
    const normalizedTerm = term.toLowerCase();
    const termTokens = normalizedTerm.split(/\s+/).filter((token) => token.length >= 3);
    return scanResultSearchText.includes(normalizedTerm) || termTokens.some((token) => scanResultSearchText.includes(token));
  });
  const personalScanMatches = Array.from(new Set([
    ...(storedProfile?.triggers ?? []),
    ...(storedProfile?.symptoms ?? []),
  ].filter((item) => item && item !== 'None'))).filter((term) => {
    const normalizedTerm = term.toLowerCase();
    const termTokens = normalizedTerm.split(/\s+/).filter((token) => token.length >= 3);
    return scanResultSearchText.includes(normalizedTerm) || termTokens.some((token) => scanResultSearchText.includes(token));
  }).slice(0, 3);
  const personalScanExplanation =
    scanResult && !isResultImageCheckError && personalScanMatches.length > 0
      ? isRussian
        ? `Персонально для вас: совпало с ${personalScanMatches.join(', ')} из профиля`
        : `Personal to you: matches ${personalScanMatches.join(', ')} from your profile`
      : scanResult && !isResultImageCheckError && (storedProfile?.triggers.length || storedProfile?.symptoms.length)
        ? isRussian
          ? 'DigestSnap сравнил результат с вашим профилем, но явных совпадений не нашел'
          : 'DigestSnap checked this against your profile and found no direct match'
        : '';
  const cardClass = cn('rounded-[22px] bg-white p-4 shadow-[0_10px_26px_rgba(15,15,15,0.075)] ring-1 ring-black/[0.03] transition-colors duration-700 sm:rounded-[24px] sm:p-5 sm:shadow-[0_14px_32px_rgba(15,15,15,0.10)]', isDarkMode && theme.card);
  const patternInsight = buildPatternInsight(ownedRecentScans, language);
  const weeklyScans = ownedRecentScans.filter((scan) => Date.now() - Date.parse(scan.createdAt) <= 7 * ONE_DAY_MS);
  const weeklyRealScans = weeklyScans.filter((scan) => scan.eaten === true && !isImageCheckErrorResult(scan.result));
  const weeklySignalScans = weeklyRealScans.filter((scan) => scan.feeling && scan.feeling !== 'Fine');
  const weeklyCheckIns = weeklyRealScans.filter((scan) => scan.feeling).length;
  const weeklyAvoids = weeklyRealScans.filter((scan) => scan.result.overallRating === 'Avoid').length;
  const weeklyConcernCounts = new Map<string, number>();
  weeklySignalScans.forEach((scan) => {
    scan.result.flaggedChemicals.slice(0, 2).forEach((item) => {
      const key = item.chemicalName.trim();
      if (!key) return;
      weeklyConcernCounts.set(key, (weeklyConcernCounts.get(key) ?? 0) + 1);
    });
  });
  const weeklyTopConcern = Array.from(weeklyConcernCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  const weeklyRepeatedConcern = weeklyTopConcern && weeklyTopConcern[1] >= 2 ? weeklyTopConcern : null;
  const showWeeklyRecap = weeklyRealScans.length >= 2 || weeklyCheckIns >= 2 || Boolean(weeklyRepeatedConcern);
  const weeklyRecapBody = weeklyRepeatedConcern
    ? isRussian
      ? `${weeklyRepeatedConcern[0]} повторилось ${weeklyRepeatedConcern[1]} раза на этой неделе`
      : `${weeklyRepeatedConcern[0]} repeated ${weeklyRepeatedConcern[1]} times this week`
    : isRussian
      ? `${weeklyRealScans.length} съеденных скана и ${weeklyCheckIns} отметок самочувствия за неделю`
      : `${weeklyRealScans.length} eaten scans and ${weeklyCheckIns} feeling check-ins this week`;
  const watchlistTerms = Array.from(new Set([
    ...(storedProfile?.triggers ?? []),
    ...(storedProfile?.allergies ?? []),
  ].filter((item) => item && item !== 'None'))).slice(0, 6);
  const triggerWatchlist = watchlistTerms.map((term) => {
    const normalizedTerm = term.toLowerCase();
    const termTokens = normalizedTerm.split(/\s+/).filter((token) => token.length >= 3);
    const matches = ownedRecentScans.filter((scan) => {
      const text = [
        scan.result.productName,
        ...scan.result.flaggedChemicals.flatMap((item) => [item.chemicalName, item.reason]),
      ].join(' ').toLowerCase();
      return text.includes(normalizedTerm) || termTokens.some((token) => text.includes(token));
    });

    return {
      term,
      count: matches.length,
      last: matches[0]?.createdAt,
    };
  });
  const historyFilters: Array<{ id: ScanHistoryFilter; label: string }> = [
    { id: 'all', label: isRussian ? 'Все' : 'All' },
    { id: 'eaten', label: isRussian ? 'Съедено' : 'Eaten' },
    { id: 'not_eaten', label: isRussian ? 'Не ел' : 'Not eaten' },
    { id: 'safe', label: isRussian ? 'Можно' : 'Safe' },
    { id: 'caution', label: isRussian ? 'Осторожно' : 'Caution' },
    { id: 'avoid', label: isRussian ? 'Избегать' : 'Avoid' },
    { id: 'with_feeling', label: isRussian ? 'С ощущением' : 'With feeling' },
  ];
  const filteredHistoryScans = ownedRecentScans
    .filter((scan) => {
      const rating = scan.result.overallRating.toLowerCase();
      if (historyFilter === 'eaten' && scan.eaten !== true) return false;
      if (historyFilter === 'not_eaten' && scan.eaten !== false) return false;
      if (historyFilter === 'with_feeling' && !scan.feeling) return false;
      if ((historyFilter === 'safe' || historyFilter === 'caution' || historyFilter === 'avoid') && rating !== historyFilter) return false;
      const query = historyQuery.trim().toLowerCase();
      if (!query) return true;
      return [
        scan.result.productName,
        scan.result.overallRating,
        scan.result.flaggedChemicals.map((item) => `${item.chemicalName} ${item.reason}`).join(' '),
      ].join(' ').toLowerCase().includes(query);
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const progressTimelineScans = ownedRecentScans
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5);
  const normalizedStreak = normalizeStreak(streak);
  const activeStreak = normalizedStreak.count;
  const maxStreak = normalizedStreak.maxCount;
  const daysSinceLastLog = normalizedStreak.lastLoggedAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(normalizedStreak.lastLoggedAt)) / ONE_DAY_MS))
    : 0;
  const openProfileEditor = () => {
    setProfileDraftName(profileName);
    setProfileDraftUsername(profileUsername);
    setProfileFormMessage(null);
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
    const normalizedGoalDraft: StoredDigestSnapProfile = {
      ...goalDraft,
      age: Math.round(clampNumber(goalDraft.age, storedProfile?.age ?? 24, 13, 99)),
      heightCm: Math.round(clampNumber(goalDraft.heightCm, storedProfile?.heightCm ?? 170, 90, 240)),
      weightKg: Math.round(clampNumber(goalDraft.weightKg, storedProfile?.weightKg ?? 64, 30, 250)),
      checkInsPerDay: Math.round(clampNumber(goalDraft.checkInsPerDay, storedProfile?.checkInsPerDay ?? 2, 1, 6)),
      symptoms: goalDraft.symptoms.map((item) => item.trim()).filter(Boolean).slice(0, 8),
      triggers: goalDraft.triggers.map((item) => item.trim()).filter(Boolean).slice(0, 10),
      allergies: goalDraft.allergies.map((item) => item.trim()).filter(Boolean).slice(0, 10),
    };

    try {
      window.localStorage.setItem(profileStorageKey(session.user.id), JSON.stringify(normalizedGoalDraft));
    } catch {
      // Keep the in-memory draft if local storage is unavailable.
    }
    setGoalDraft(normalizedGoalDraft);
    setStoredProfile(normalizedGoalDraft);
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
          [isRussian ? 'Текущая серия' : 'Current streak', String(activeStreak), isRussian ? 'дней' : 'days', Flame],
          [isRussian ? 'Лучшая серия' : 'Best streak', String(maxStreak), isRussian ? 'макс' : 'max', Target],
          [isRussian ? 'Сканы' : 'Scans', String(scanCount), isRussian ? 'сохранено' : 'saved', ScanLine],
          [
            isRussian ? 'Последняя запись' : 'Last log',
            normalizedStreak.lastLoggedAt
              ? (daysSinceLastLog === 0 ? (isRussian ? 'Сегодня' : 'Today') : `${daysSinceLastLog}d ago`)
              : isRussian ? 'Нет записей' : 'No logs',
            isRussian ? 'активность' : 'activity',
            Activity,
          ],
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

      <div className={cn(cardClass, 'overflow-hidden')}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={cn('text-xs font-black uppercase tracking-[0.16em]', theme.faint)}>
              {isRussian ? 'Паттерн' : 'Pattern'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={cn(
                'rounded-full px-3 py-1 text-xs font-black',
                patternInsight.strength === 'strong'
                  ? 'bg-zinc-950 text-white'
                  : patternInsight.strength === 'medium'
                    ? 'bg-zinc-200 text-zinc-950'
                    : 'bg-zinc-100 text-zinc-500',
              )}>
                {patternInsight.confidenceLabel}
              </span>
              <span className={cn('text-xs font-black', theme.faint)}>{patternInsight.confidenceScore}%</span>
            </div>
            <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{patternInsight.title}</h2>
            <p className={cn('mt-3 text-sm font-semibold leading-6', theme.muted)}>{patternInsight.body}</p>
            <div className={cn('mt-4 grid grid-cols-3 gap-2 rounded-[18px] p-2 ring-1', theme.soft)}>
              {[
                [isRussian ? '7 дней' : '7 days', weeklyScans.length],
                [isRussian ? 'Отметки' : 'Check-ins', weeklyCheckIns],
                [isRussian ? 'Избегать' : 'Avoid', weeklyAvoids],
              ].map(([label, value]) => (
                <div className="rounded-[14px] bg-white px-2 py-2.5 text-center shadow-sm ring-1 ring-zinc-950/[0.04]" key={String(label)}>
                  <p className="text-base font-black leading-none">{value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase text-zinc-400">{label}</p>
                </div>
              ))}
            </div>
            <p className={cn('mt-3 text-xs font-bold leading-5', theme.muted)}>
              {weeklyRepeatedConcern
                ? isRussian
                  ? `Главный сигнал недели: ${weeklyRepeatedConcern[0]} (${weeklyRepeatedConcern[1]}x)`
                  : `Top weekly signal: ${weeklyRepeatedConcern[0]} (${weeklyRepeatedConcern[1]}x)`
                : isRussian ? 'Неделя пока без повторяющихся сигналов' : 'No repeated weekly signal yet'}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  patternInsight.strength === 'strong' ? 'bg-zinc-950' : patternInsight.strength === 'medium' ? 'bg-zinc-500' : 'bg-zinc-300',
                )}
                style={{ width: `${Math.max(5, patternInsight.confidenceScore)}%` }}
              />
            </div>
          </div>
          <div className={cn('flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full ring-1', patternInsight.state === 'active' ? 'bg-zinc-950 text-white ring-zinc-950' : isDarkMode ? 'bg-white/[0.06] ring-white/10' : 'bg-zinc-100 text-zinc-950 ring-black/[0.03]')}>
            <span className="text-2xl font-black">{patternInsight.count}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.12em] opacity-65">{isRussian ? 'сигн' : 'signals'}</span>
          </div>
        </div>
      </div>

      {triggerWatchlist.length > 0 && (
        <div className={cardClass}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={cn('text-xs font-black uppercase tracking-[0.16em]', theme.faint)}>
                {isRussian ? 'Список наблюдения' : 'Watchlist'}
              </p>
              <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
                {isRussian ? 'Ваши подозрительные продукты' : 'Your suspected foods'}
              </h2>
            </div>
            <Target className={cn('h-6 w-6 shrink-0', theme.faint)} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {triggerWatchlist.map((item) => (
              <div className={cn('rounded-[18px] p-3 ring-1', theme.soft)} key={item.term}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-black">{item.term}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-zinc-500 shadow-sm ring-1 ring-zinc-950/[0.05]">
                    {item.count}
                  </span>
                </div>
                <p className={cn('mt-1 text-xs font-semibold leading-5', theme.muted)}>
                  {item.last
                    ? isRussian
                      ? `Последний сигнал: ${new Date(item.last).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
                      : `Last signal: ${new Date(item.last).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`
                    : isRussian ? 'Пока не найдено в сканах' : 'Not found in scans yet'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <span className="text-3xl font-black">{gutScoreOutOfTen ?? (isRussian ? 'Нет' : 'New')}</span>
                <span className={cn('text-[10px] font-black uppercase tracking-[0.12em]', theme.faint)}>{isRussian ? 'балл' : 'score'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[
              [isRussian ? 'Сканы' : 'Scans', String(scanCount), isRussian ? 'сохранено' : 'saved', ScanLine],
              [isRussian ? 'Самочувствие' : 'Check-ins', String(checkInCount), isRussian ? 'отмечено' : 'saved', Activity],
              [isRussian ? 'Последний' : 'Latest', latestRating ?? (isRussian ? 'Пока нет' : 'None yet'), isRussian ? 'результат' : 'result', Target],
              [isRussian ? 'BMI' : 'BMI', profileBmi?.display ?? (isRussian ? 'Добавьте' : 'Set'), isRussian ? 'из профиля' : 'from setup', Flame],
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
          {progressTimelineScans.length > 0 ? progressTimelineScans.map((item) => (
            <button
              className={cn('flex min-h-[72px] w-full items-center gap-3 rounded-[20px] p-3 text-left transition hover:-translate-y-0.5 active:scale-[0.99]', theme.soft)}
              key={item.id}
              onClick={() => openSavedScan(item)}
              type="button"
            >
              <img
                alt={item.result.productName}
                className="h-12 w-12 shrink-0 rounded-[15px] object-cover"
                src={item.imageDataUrl}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">{item.result.productName}</span>
                <span className={cn('mt-1 block truncate text-xs font-semibold', theme.muted)}>
                  {new Date(item.createdAt).toLocaleDateString(language === 'Russian' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })}
                  {' · '}
                  {item.feeling ? feelingLabel(item.feeling) : item.eaten ? (isRussian ? 'Съедено' : 'Eaten') : item.eaten === false ? (isRussian ? 'Не ел' : 'Not eaten') : (isRussian ? 'Открыто' : 'Open')}
                </span>
              </span>
              <span className={cn('shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase', ratingTone(item.result.overallRating).badge)}>
                {item.result.score}
              </span>
            </button>
          )) : (
            <div className={cn('rounded-[24px] p-5 text-center', theme.soft)}>
              <ScanLine className={cn('mx-auto h-8 w-8', theme.muted)} />
              <p className="mt-3 text-base font-black">{isRussian ? 'Пока нет сохраненных сканов' : 'No saved scans yet'}</p>
              <p className={cn('mx-auto mt-2 max-w-[320px] text-sm font-semibold leading-6', theme.muted)}>
                {isRussian ? 'Первый четкий снимок создаст вашу историю' : 'Your first clear photo starts this timeline'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={cn(cardClass, 'overflow-hidden')}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={cn('text-xs font-black uppercase tracking-[0.16em]', theme.faint)}>{isRussian ? 'Вес' : 'Weight progress'}</p>
            <h2 className="mt-3 text-2xl font-black leading-none sm:text-3xl">
              {storedProfile ? `${storedProfile.weightKg} kg` : isRussian ? 'Добавьте профиль' : 'Set profile'}
            </h2>
            <p className={cn('mt-3 text-sm font-semibold leading-6', theme.muted)}>
              {profileBmi
                ? (isRussian ? 'Рассчитано из роста и веса, которые вы указали в настройке.' : `BMI ${profileBmi.display} · ${profileBmi.range}`)
                : (isRussian ? 'Заполните рост и вес в настройке, чтобы увидеть BMI.' : 'Finish setup with height and weight to unlock your baseline')}
            </p>
          </div>
          <div className={cn('flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full ring-1 sm:h-24 sm:w-24', isDarkMode ? 'bg-white/[0.06] ring-white/10' : 'bg-zinc-100 ring-black/[0.03]')}>
            <span className="text-2xl font-black sm:text-3xl">{profileBmi?.display ?? (isRussian ? 'Нет' : 'Set')}</span>
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
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 shadow-inner ring-1 ring-zinc-950/[0.04] sm:h-16 sm:w-16">
            <Flame className="h-7 w-7 sm:h-8 sm:w-8" />
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
          <button className={cn('flex min-h-[60px] w-full items-center gap-3 border-b px-4 text-left transition active:scale-[0.99] sm:min-h-[66px] sm:gap-4 sm:px-5', theme.line)} onClick={exportAccountData} type="button">
            <Download className="h-6 w-6" />
            <span className="flex-1 text-lg font-black sm:text-xl">{copy.exportData}</span>
            <ChevronRight className={cn('h-6 w-6', theme.muted)} />
          </button>
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

                <div className="mx-auto mt-4 grid max-w-[480px] grid-cols-7 px-0 text-center sm:mt-5 lg:max-w-[620px]">
                  {homeWeek.map(({ day, date, key, selected, future }) => (
                    <button
                      className="flex min-h-[48px] flex-col items-center gap-1.5 rounded-[14px] transition hover:bg-white/60 active:scale-[0.97] sm:min-h-[58px] sm:gap-2"
                      key={`${day}-${date}`}
                      onClick={() => setSelectedHomeDate(key)}
                      type="button"
                    >
                      <span className="text-[11px] font-black sm:text-[13px] md:text-[14px]">{day}</span>
                      <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-black sm:h-8 sm:w-8 sm:text-[15px] md:h-9 md:w-9 md:text-[16px]', selected ? 'bg-white text-zinc-950 shadow-[0_8px_18px_rgba(15,15,15,0.09)] ring-1 ring-zinc-950/10' : future ? 'text-zinc-400' : 'text-black')}>
                        {date}
                      </span>
                    </button>
                  ))}
                </div>

                  <div className="mx-auto mt-4 w-full max-w-[430px] space-y-3 sm:mt-5 sm:max-w-[560px] sm:space-y-4 lg:max-w-[860px] xl:max-w-[900px]">
                  <section className="overflow-hidden rounded-[24px] sm:rounded-[28px]">
                    <AnimatePresence mode="wait">
                      {nutritionPanel === 0 && (
                        <motion.div
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="space-y-2.5 sm:space-y-3"
                          exit={{ opacity: 0, scale: 0.985, y: -10 }}
                          initial={{ opacity: 0, scale: 0.985, y: 14 }}
                          key="scan-panel"
                          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div className="w-full rounded-[24px] bg-white px-5 py-5 text-center shadow-[0_10px_26px_rgba(15,15,15,0.055)] ring-1 ring-black/[0.05] sm:rounded-[28px] sm:px-6 sm:py-6 md:px-8 md:py-7">
                            <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-zinc-100 shadow-inner sm:h-[86px] sm:w-[86px]">
                              <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white shadow-inner sm:h-[64px] sm:w-[64px]">
                                <Camera className="h-6 w-6 text-black sm:h-7 sm:w-7" />
                              </div>
                            </div>
                            <div className="mt-4 flex items-end justify-center gap-1 sm:mt-5">
                              <span className="text-[42px] font-black leading-none tracking-normal sm:text-[52px] md:text-[60px]">{laterCheckInCandidate ? homeHeroTitle : latestScore ?? homeHeroTitle}</span>
                              {!laterCheckInCandidate && latestScore !== null && <span className="pb-1.5 text-[22px] font-black text-zinc-400 sm:text-[26px]">/100</span>}
                            </div>
                            <p className="mx-auto mt-2 max-w-[520px] text-[13px] font-black leading-5 text-zinc-500 sm:mt-3 sm:text-[15px] sm:leading-6">
                              {homeHeroSubtitle}
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {nutritionPanel === 1 && (
                        <motion.div
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="space-y-2.5 sm:space-y-3"
                          exit={{ opacity: 0, scale: 0.985, y: -10 }}
                          initial={{ opacity: 0, scale: 0.985, y: 14 }}
                          key="macro-panel"
                          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        >
                          {selectedDayEatenScans.length === 0 ? (
                            <>
                              <div className="rounded-[22px] bg-white p-5 text-center shadow-[0_8px_22px_rgba(15,15,15,0.05)] ring-1 ring-black/[0.05] sm:rounded-[24px] sm:p-6">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-950">
                                  <Utensils className="h-6 w-6" />
                                </div>
                                <p className="mt-4 text-[20px] font-black leading-tight sm:text-[24px]">
                                  {isRussian ? 'Питание пока не считается' : 'Nutrition is not counting yet'}
                                </p>
                                <p className="mx-auto mt-2 max-w-[390px] text-sm font-semibold leading-6 text-zinc-500">
                                  {isRussian
                                    ? 'Скан может быть просто сохранен. Калории и БЖУ появятся только после отметки “съел”'
                                    : 'A scan can stay saved only. Calories and macros appear after you mark food as eaten'}
                                </p>
                              </div>

                              <div className="grid gap-2.5 min-[390px]:grid-cols-2 sm:gap-3">
                                <button
                                  className="rounded-[22px] bg-white p-4 text-left shadow-[0_8px_22px_rgba(15,15,15,0.05)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 active:scale-[0.99] sm:rounded-[24px] sm:p-5"
                                  onClick={() => setWaterSheetOpen(true)}
                                  type="button"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-[15px] font-black text-zinc-500 sm:text-[18px]">{isRussian ? 'Вода' : 'Water intake'}</p>
                                      <p className="mt-1 text-[24px] font-black leading-none sm:text-[30px]">{waterCardLabel}</p>
                                    </div>
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-lg font-black text-white">+</span>
                                  </div>
                                </button>

                                <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(15,15,15,0.05)] ring-1 ring-black/[0.05] sm:rounded-[24px] sm:p-5">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-[15px] font-black sm:text-[18px]">{isRussian ? 'Счет здоровья' : 'Health score'}</p>
                                    <p className="text-[22px] font-black leading-none sm:text-[28px]">
                                      {latestScore !== null ? `${gutScoreOutOfTen}/10` : isRussian ? 'Старт' : 'Start'}
                                    </p>
                                  </div>
                                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f4f2f8]">
                                    <div className={cn('h-full rounded-full transition-all duration-500', healthScoreBarColor)} style={{ width: healthScoreBarWidth }} />
                                  </div>
                                  <p className="mt-2 text-[12px] font-semibold leading-5 text-zinc-500">{healthScoreExplanation}</p>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                          <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(15,15,15,0.05)] ring-1 ring-black/[0.05] sm:rounded-[24px] sm:p-5">
                            <div className="flex items-end justify-between gap-4">
                              <div>
                                <p className="text-[11px] font-black uppercase text-zinc-400 sm:text-xs">{isRussian ? 'Расчет на день' : 'Estimated day'}</p>
                                <p className="mt-1 text-[27px] font-black leading-none sm:text-[34px]">
                                  {caloriesEaten}<span className="text-[15px] text-zinc-400 sm:text-lg">/{calorieTarget} cal</span>
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] font-black uppercase text-zinc-400 sm:text-xs">{isRussian ? 'Осталось' : 'Left'}</p>
                                <p className="mt-1 text-[20px] font-black leading-none sm:text-[24px]">{remainingCalories} cal</p>
                              </div>
                            </div>
                            <p className="mt-3 text-[12px] font-bold leading-5 text-zinc-500 sm:text-sm">
                              {dailyNutritionSummary} · {calorieTargetReason}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                            {macroCards.map((card) => (
                              <div
                                className="flex h-[108px] min-w-0 flex-col justify-between rounded-[18px] bg-white p-3 shadow-[0_8px_20px_rgba(15,15,15,0.05)] ring-1 ring-black/[0.05] sm:h-[142px] sm:rounded-[22px] sm:p-3.5 md:h-[156px] md:p-4"
                                key={card.label}
                              >
                                <div className="min-w-0">
                                  <p className="whitespace-nowrap text-[18px] font-black leading-none sm:text-[24px] md:text-[28px]">
                                    {card.value}<span className="text-[11px] text-zinc-400 sm:text-[15px] md:text-[17px]">/{card.target}{card.unit}</span>
                                  </p>
                                  <p className="mt-1.5 truncate text-[10px] font-black leading-3 text-zinc-500 sm:text-[12px] md:text-[13px]">{card.label}</p>
                                </div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-full border-[7px] border-[#f4f2f8] sm:h-16 sm:w-16 sm:border-[9px] md:h-[72px] md:w-[72px]">
                                  <span className={cn('text-[10px] font-black sm:text-[13px] md:text-[14px]', card.color)}>{card.icon}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-3 gap-2 rounded-[22px] bg-white p-2 shadow-[0_8px_20px_rgba(15,15,15,0.045)] ring-1 ring-black/[0.05] sm:gap-3 sm:rounded-[24px] sm:p-3">
                            {nutritionDetailCards.map((card) => (
                              <div className="rounded-[16px] bg-zinc-50 px-2.5 py-3 text-center ring-1 ring-zinc-950/[0.04] sm:rounded-[18px] sm:px-3 sm:py-3.5" key={card.label}>
                                <p className="text-[17px] font-black leading-none sm:text-[22px]">
                                  {card.value}<span className="text-[10px] text-zinc-400 sm:text-xs">/{card.target}{card.unit}</span>
                                </p>
                                <p className="mt-1.5 text-[10px] font-black uppercase text-zinc-400 sm:text-[11px]">{card.label}</p>
                              </div>
                            ))}
                          </div>

                          <div className="grid gap-2.5 min-[390px]:grid-cols-2 sm:gap-3">
                            <button
                              className="rounded-[22px] bg-white p-4 text-left shadow-[0_8px_22px_rgba(15,15,15,0.05)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 active:scale-[0.99] sm:rounded-[24px] sm:p-5"
                              onClick={() => setWaterSheetOpen(true)}
                              type="button"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[15px] font-black text-zinc-500 sm:text-[18px]">{isRussian ? 'Вода' : 'Water intake'}</p>
                                  <p className="mt-1 text-[24px] font-black leading-none sm:text-[30px]">{waterCardLabel}</p>
                                </div>
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-lg font-black text-white">+</span>
                              </div>
                            </button>

                            <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(15,15,15,0.05)] ring-1 ring-black/[0.05] sm:rounded-[24px] sm:p-5">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-[15px] font-black sm:text-[18px]">{isRussian ? 'Счет здоровья' : 'Health score'}</p>
                                <p className="text-[22px] font-black leading-none sm:text-[28px]">
                                  {latestScore !== null ? `${gutScoreOutOfTen}/10` : isRussian ? 'Старт' : 'Start'}
                                </p>
                              </div>
                              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f4f2f8]">
                                <div className={cn('h-full rounded-full transition-all duration-500', healthScoreBarColor)} style={{ width: healthScoreBarWidth }} />
                              </div>
                              <p className="mt-2 text-[12px] font-semibold leading-5 text-zinc-500">{healthScoreExplanation}</p>
                            </div>
                          </div>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mx-auto mt-3 grid max-w-[300px] grid-cols-2 rounded-full bg-white p-1 shadow-[0_8px_20px_rgba(15,15,15,0.045)] ring-1 ring-black/[0.05] sm:mt-4">
                      {[
                        isRussian ? 'Счет' : 'Score',
                        isRussian ? 'Питание' : 'Nutrition',
                      ].map((label, index) => (
                        <button
                          aria-pressed={nutritionPanel === index}
                          className={cn(
                            'h-10 rounded-full text-xs font-black transition active:scale-[0.98] sm:text-sm',
                            nutritionPanel === index ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-50',
                          )}
                          key={label}
                          onClick={() => setNutritionPanel(index)}
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </section>

                  {inAppReminder && (
                    <button
                      className="group flex w-full items-center rounded-[22px] bg-white px-4 py-3.5 text-left shadow-[0_7px_20px_rgba(15,15,15,0.045)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 active:scale-[0.99] sm:rounded-[24px] sm:px-5 sm:py-4 md:px-7 md:py-5"
                      onClick={inAppReminder.action}
                      type="button"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-950">
                        {inAppReminder.kind === 'checkin' ? <Activity className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1 px-4">
                        <p className="truncate text-[17px] font-black sm:text-[20px]">
                          {inAppReminder.title}
                        </p>
                        <p className="mt-1 truncate text-xs font-bold text-zinc-500 sm:text-sm">
                          {inAppReminder.body}
                        </p>
                      </div>
                      <ChevronRight className="h-6 w-6 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5" />
                    </button>
                  )}

                  {showWeeklyRecap && (
                    <button
                      className="group flex w-full items-center rounded-[22px] bg-white px-4 py-3.5 text-left shadow-[0_7px_20px_rgba(15,15,15,0.045)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 active:scale-[0.99] sm:rounded-[24px] sm:px-5 sm:py-4 md:px-7 md:py-5"
                      onClick={() => setActiveTab('progress')}
                      type="button"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-950">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 px-4">
                        <p className="truncate text-[17px] font-black sm:text-[20px]">
                          {isRussian ? 'Итог недели' : 'Weekly recap'}
                        </p>
                        <p className="mt-1 truncate text-xs font-bold text-zinc-500 sm:text-sm">
                          {weeklyRecapBody}
                        </p>
                      </div>
                      <ChevronRight className="h-6 w-6 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5" />
                    </button>
                  )}

                  <button
                    className="group flex w-full items-center rounded-[22px] bg-white px-4 py-3.5 text-left shadow-[0_7px_20px_rgba(15,15,15,0.045)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 hover:bg-white active:scale-[0.99] sm:rounded-[24px] sm:px-5 sm:py-4 md:px-7 md:py-5"
                    onClick={() => setActiveTab('progress')}
                    type="button"
                  >
                    <div className="flex w-full items-center justify-between gap-4">
                      <div>
                        <p className="text-[18px] font-black sm:text-[22px] md:text-[26px]">{isRussian ? 'Прогресс' : 'Progress'}</p>
                        <p className="mt-1 text-[12px] font-semibold leading-4 text-zinc-500 sm:text-[13px] sm:leading-5 md:text-sm">
                          {isRussian ? 'Серия, реакции и повторяющиеся продукты' : 'Streak, check-ins, and repeat foods'}
                        </p>
                      </div>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 transition group-hover:scale-105 sm:h-11 sm:w-11">
                        {hasActivity ? <BarChart3 className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </span>
                    </div>
                  </button>

                  {selectedDayScans.length > 0 && (
                  <div className="rounded-[22px] bg-white p-4 shadow-[0_7px_20px_rgba(15,15,15,0.045)] ring-1 ring-black/[0.05] sm:rounded-[24px] sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[17px] font-black sm:text-[20px]">{isRussian ? 'Итог дня' : 'Day recap'}</p>
                        <p className="mt-1 text-xs font-bold text-zinc-500 sm:text-sm">
                          {selectedDayScans.length > 0
                            ? isRussian ? 'Сводка по выбранной дате' : 'Summary for the selected date'
                            : isRussian ? 'В этот день пока ничего не сохранено' : 'Nothing saved on this date'}
                        </p>
                      </div>
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
                        {selectedDayAverageScore === null ? (isRussian ? 'Пока нет' : 'None yet') : `${selectedDayAverageScore}/100`}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        [isRussian ? 'Сканы' : 'Scans', selectedDayScans.length],
                        [isRussian ? 'Учтено' : 'Counted', selectedDayEatenScans.length],
                        [isRussian ? 'Ощущения' : 'Check-ins', selectedDayFeelingCount],
                      ].map(([label, value]) => (
                        <div className="rounded-[16px] bg-zinc-50 px-2.5 py-3 text-center ring-1 ring-zinc-950/[0.04]" key={String(label)}>
                          <p className="text-lg font-black leading-none">{value}</p>
                          <p className="mt-1.5 text-[10px] font-black uppercase text-zinc-400">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  <section className="pt-1 sm:pt-2">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-[23px] font-black leading-none sm:text-[28px] md:text-[34px]">{isRussian ? 'Таймлайн' : 'Timeline'}</h2>
                      {ownedRecentScans.length > 0 && (
                        <button
                          className="rounded-full bg-white px-4 py-2 text-xs font-black text-zinc-950 shadow-[0_8px_20px_rgba(15,15,15,0.045)] ring-1 ring-black/[0.06] transition active:scale-95 sm:text-sm"
                          onClick={() => setHistorySheetOpen(true)}
                          type="button"
                        >
                          {isRussian ? 'История' : 'Full history'}
                        </button>
                      )}
                    </div>

                    {scanState === 'scanning' ? (
                      <div className="mt-3 rounded-[24px] bg-white p-4 shadow-[0_10px_28px_rgba(15,15,15,0.06)] ring-1 ring-black/[0.05] sm:mt-5 sm:rounded-[28px] sm:p-5">
                        <div className="flex items-center gap-4">
                          {scanPreviewUrl ? (
                            <img
                              alt="Meal being analyzed"
                              className="h-20 w-20 shrink-0 rounded-[22px] object-cover blur-[2px]"
                              src={scanPreviewUrl}
                            />
                          ) : (
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[22px] bg-zinc-100">
                              <LoaderCircle className="h-7 w-7 animate-spin text-zinc-950" />
                            </div>
                          )}
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
                    ) : ownedRecentScans.length > 0 ? (
                      <div className="mt-3 space-y-2.5 sm:mt-5 sm:space-y-3">
                        {ownedRecentScans.slice(0, MAX_RECENT_UPLOADS).map((item) => (
                          <button
                            className="flex w-full items-center gap-3 rounded-[24px] bg-white p-3.5 text-left shadow-[0_10px_28px_rgba(15,15,15,0.055)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 active:scale-[0.99] sm:gap-4 sm:rounded-[28px] sm:p-4"
                            key={item.id}
                            onClick={() => openSavedScan(item)}
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
                                {isImageCheckErrorResult(item.result) ? `${copy.needsRetake} · ${copy.notScored}` : `${ratingLabel(item.result.overallRating)} · ${item.result.score}/100`}
                              </p>
                              <p className="mt-1 line-clamp-1 text-xs font-semibold text-zinc-400">
                                {item.eaten
                                  ? `${item.nutrition.calories} cal counted today`
                                  : item.eaten === false
                                    ? isRussian ? 'Сохранено без калорий' : 'Saved only, not counted'
                                    : isRussian ? 'Выберите: съедено или нет' : 'Choose eaten or not eaten'}
                              </p>
                            </div>
                            <ChevronRight className="h-6 w-6 shrink-0 text-zinc-400" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-[24px] bg-white p-5 text-center shadow-[0_10px_28px_rgba(15,15,15,0.045)] ring-1 ring-black/[0.05] sm:mt-5 sm:rounded-[28px] sm:p-6">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 shadow-inner ring-1 ring-zinc-950/[0.04]">
                          <Camera className="h-7 w-7" />
                        </div>
                        <p className="mt-4 text-[17px] font-black text-zinc-950 sm:mt-5 sm:text-[22px]">{isRussian ? 'Таймлайн пуст' : 'Timeline is empty'}</p>
                        <p className="mx-auto mt-2 max-w-[420px] text-sm font-semibold leading-6 text-zinc-500">
                          {isRussian ? 'Первое фото еды или состава появится здесь' : 'Your first food or label photo will appear here'}
                        </p>
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
                    disabled={cameraCapturing}
                    onClick={captureCameraFrame}
                    type="button"
                    aria-label="Capture food photo"
                  >
                    {cameraCapturing ? <LoaderCircle className="h-9 w-9 animate-spin stroke-[2.8]" /> : <Camera className="h-9 w-9 stroke-[2.8]" />}
                  </button>
                </div>
                <form
                  className="mx-auto mt-5 flex max-w-[420px] gap-2 rounded-[22px] bg-white/10 p-2 ring-1 ring-white/10 backdrop-blur-xl"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runMenuDishScan();
                  }}
                >
                  <label className="sr-only" htmlFor="menu-dish-input">
                    {copy.menuFallbackTitle}
                  </label>
                  <input
                    className="min-w-0 flex-1 rounded-[16px] border-0 bg-white px-4 py-3 text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400"
                    id="menu-dish-input"
                    maxLength={80}
                    onChange={(event) => setMenuDishInput(event.target.value)}
                    placeholder={copy.menuFallbackPlaceholder}
                    value={menuDishInput}
                  />
                  <button
                    className={cn(
                      'rounded-[16px] px-4 py-3 text-sm font-black transition active:scale-95',
                      menuDishInput.trim().length >= 2 && !menuDishScanning ? 'bg-white text-zinc-950' : 'bg-white/20 text-white/45',
                    )}
                    disabled={menuDishInput.trim().length < 2 || menuDishScanning}
                    type="submit"
                  >
                    {menuDishScanning ? <LoaderCircle className="h-5 w-5 animate-spin" /> : copy.menuFallbackAction}
                  </button>
                </form>
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
                {profileFormMessage && (
                  <div
                    className={cn(
                      'mt-4 rounded-[18px] px-4 py-3 text-sm font-bold leading-5 ring-1',
                      profileFormMessage.tone === 'error'
                        ? 'bg-red-50 text-red-700 ring-red-100'
                        : 'bg-zinc-50 text-zinc-700 ring-zinc-950/[0.06]',
                    )}
                    role={profileFormMessage.tone === 'error' ? 'alert' : 'status'}
                  >
                    {profileFormMessage.text}
                  </div>
                )}
                <button
                  className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-black text-zinc-950 shadow-[0_14px_30px_rgba(15,15,15,0.10)] ring-1 ring-zinc-950/10 transition active:scale-[0.98] disabled:opacity-50"
                  disabled={profileSaving}
                  onClick={saveProfileDetails}
                  type="button"
                >
                  {profileSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
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
                <p className="text-[22px] font-black sm:text-2xl">{isRussian ? 'Изменить профиль' : 'Edit goals'}</p>
                <p className={cn('mt-2 text-sm font-semibold leading-6', theme.muted)}>
                  {isRussian ? 'Обновите данные, которые DigestSnap использует для сканов' : 'Update the setup data DigestSnap uses for scans'}
                </p>

                <div className="mt-5 grid gap-4">
                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{isRussian ? 'Главная цель' : 'Main goal'}</span>
                    <select
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      onChange={(event) => setGoalDraft((current) => ({ ...current, goal: event.target.value as DigestGoal }))}
                      value={goalDraft.goal}
                    >
                      {goalOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{isRussian ? 'Тип питания' : 'Diet type'}</span>
                    <input
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      onChange={(event) => setGoalDraft((current) => ({ ...current, dietType: event.target.value }))}
                      value={goalDraft.dietType}
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <label className="block">
                      <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{isRussian ? 'Возраст' : 'Age'}</span>
                      <input
                        className={cn('mt-2 h-[52px] w-full rounded-[16px] border px-2.5 text-base font-bold outline-none transition focus:ring-2 sm:h-14 sm:rounded-[18px] sm:px-3', theme.input)}
                        inputMode="numeric"
                        onChange={(event) => setGoalDraft((current) => ({ ...current, age: Number(event.target.value) }))}
                        type="number"
                        value={goalDraft.age}
                      />
                    </label>
                    <label className="block">
                      <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{isRussian ? 'Рост' : 'Height'}</span>
                      <input
                        className={cn('mt-2 h-[52px] w-full rounded-[16px] border px-2.5 text-base font-bold outline-none transition focus:ring-2 sm:h-14 sm:rounded-[18px] sm:px-3', theme.input)}
                        inputMode="numeric"
                        onChange={(event) => setGoalDraft((current) => ({ ...current, heightCm: Number(event.target.value) }))}
                        type="number"
                        value={goalDraft.heightCm}
                      />
                    </label>
                    <label className="block">
                      <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{isRussian ? 'Вес' : 'Weight'}</span>
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
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{isRussian ? 'Симптомы' : 'Symptoms'}</span>
                    <input
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      onChange={(event) => updateGoalDraftList('symptoms', event.target.value)}
                      placeholder="Bloated, nausea"
                      value={goalDraft.symptoms.join(', ')}
                    />
                  </label>

                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{isRussian ? 'Подозрительные продукты' : 'Suspected foods'}</span>
                    <input
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      onChange={(event) => updateGoalDraftList('triggers', event.target.value)}
                      placeholder="Dairy, bread, fried food"
                      value={goalDraft.triggers.join(', ')}
                    />
                  </label>

                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{isRussian ? 'Аллергии / избегать' : 'Allergies / avoids'}</span>
                    <input
                      className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                      onChange={(event) => updateGoalDraftList('allergies', event.target.value)}
                      placeholder="Gluten, lactose"
                      value={goalDraft.allergies.join(', ')}
                    />
                  </label>

                  <label className="block">
                    <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{isRussian ? 'Отметок в день' : 'Daily check-ins'}</span>
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
                  {isRussian ? 'Сохранить профиль' : 'Save goals'}
                </button>
              </motion.div>
            </motion.div>
          )}

          {historySheetOpen && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-end justify-center bg-black/45 px-[clamp(10px,4vw,18px)] pb-[max(14px,env(safe-area-inset-bottom))] sm:pb-[max(18px,env(safe-area-inset-bottom))]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setHistorySheetOpen(false)}
            >
              <motion.div
                animate={{ y: 0 }}
                className={cn('max-h-[88vh] w-full max-w-[430px] overflow-hidden rounded-[30px] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] ring-1 sm:max-w-[640px] sm:rounded-[34px] sm:p-5', theme.card)}
                exit={{ y: 28 }}
                initial={{ y: 28 }}
                onClick={(event) => event.stopPropagation()}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{isRussian ? 'Сканы' : 'Scans'}</p>
                    <h2 className="mt-1 text-[28px] font-black leading-none sm:text-[34px]">{isRussian ? 'История еды' : 'Food history'}</h2>
                  </div>
                  <button
                    aria-label="Close scan history"
                    className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95', theme.soft)}
                    onClick={() => setHistorySheetOpen(false)}
                    type="button"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <label className={cn('mt-5 flex h-[52px] items-center gap-3 rounded-[18px] border px-4 transition focus-within:ring-2', theme.input)}>
                  <Search className="h-5 w-5 shrink-0 opacity-45" />
                  <span className="sr-only">{isRussian ? 'Поиск по истории' : 'Search scan history'}</span>
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-base font-bold outline-none placeholder:text-zinc-400"
                    onChange={(event) => setHistoryQuery(event.target.value)}
                    placeholder={isRussian ? 'Найти продукт, бренд или причину' : 'Search food, brand, or reason'}
                    value={historyQuery}
                  />
                </label>

                <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {historyFilters.map((filter) => (
                    <button
                      className={cn(
                        'h-10 shrink-0 rounded-full px-4 text-sm font-black transition active:scale-95',
                        historyFilter === filter.id
                          ? 'bg-zinc-950 text-white shadow-[0_10px_24px_rgba(15,15,15,0.18)]'
                          : cn('ring-1', theme.soft),
                      )}
                      key={filter.id}
                      onClick={() => setHistoryFilter(filter.id)}
                      type="button"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 max-h-[56vh] space-y-2.5 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {filteredHistoryScans.length > 0 ? (
                    filteredHistoryScans.map((item) => (
                      <button
                        className={cn('flex w-full items-center gap-3 rounded-[22px] p-3 text-left ring-1 transition hover:-translate-y-0.5 active:scale-[0.99]', theme.soft)}
                        key={item.id}
                        onClick={() => openSavedScan(item)}
                        type="button"
                      >
                        <img
                          alt={item.result.productName}
                          className="h-16 w-16 shrink-0 rounded-[18px] object-cover"
                          src={item.imageDataUrl}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-base font-black sm:text-lg">{item.result.productName}</p>
                            <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase', ratingTone(item.result.overallRating).badge)}>
                              {item.result.overallRating}
                            </span>
                          </div>
                          <p className={cn('mt-1 text-xs font-bold leading-4', theme.muted)}>
                            {new Date(item.createdAt).toLocaleDateString(language === 'Russian' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })}
                            {' · '}
                            {typeof item.eaten === 'boolean'
                              ? item.eaten
                                ? isRussian ? 'учтено в калориях' : 'counted in calories'
                                : isRussian ? 'сохранено без калорий' : 'saved only'
                              : isRussian ? 'нужно выбрать статус' : 'needs status'}
                            {item.feeling ? ` · ${item.feeling}` : ''}
                          </p>
                          <p className={cn('mt-1 line-clamp-1 text-xs font-semibold', theme.faint)}>
                            {item.result.flaggedChemicals[0]?.reason ?? `${item.nutrition.calories} cal · ${item.result.score}/100`}
                          </p>
                        </div>
                        <ChevronRight className={cn('h-5 w-5 shrink-0', theme.faint)} />
                      </button>
                    ))
                  ) : (
                    <div className={cn('rounded-[24px] p-6 text-center ring-1', theme.soft)}>
                      <p className="text-lg font-black">
                        {ownedRecentScans.length === 0
                          ? isRussian ? 'Сканов пока нет' : 'No scans yet'
                          : isRussian ? 'По этому фильтру пусто' : 'No matches for this filter'}
                      </p>
                      <p className={cn('mt-2 text-sm font-semibold leading-6', theme.muted)}>
                        {ownedRecentScans.length === 0
                          ? isRussian ? 'Сохраненные продукты появятся здесь' : 'Saved food results will appear here'
                          : isRussian ? 'Очистите поиск или выберите другой фильтр' : 'Clear search or choose another filter'}
                      </p>
                    </div>
                  )}
                </div>
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

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {resultSnapshotItems.map(([label, value]) => (
                    <div className="min-w-0 rounded-[18px] bg-white px-3 py-3 shadow-sm ring-1 ring-zinc-950/[0.06]" key={label}>
                      <p className="truncate text-base font-black leading-none text-zinc-950">{value}</p>
                      <p className="mt-2 truncate text-[10px] font-black uppercase text-zinc-400">{label}</p>
                    </div>
                  ))}
                </div>

                <div className={cn('mt-3 grid gap-2 rounded-[22px] p-3 ring-1 sm:grid-cols-2', theme.soft)}>
                  {[
                    [isRussian ? 'Видно на фото' : 'Seen in photo', aiIdentifiedText, aiObservedDetail],
                    [isRussian ? 'Оценено AI' : 'Estimated by AI', aiEstimatedText, aiEstimatedDetail],
                  ].map(([label, value, detail]) => (
                    <div className="rounded-[18px] bg-white p-3 shadow-sm ring-1 ring-zinc-950/[0.05]" key={label}>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">{label}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-black leading-5 text-zinc-800">{value}</p>
                      <p className="mt-2 line-clamp-2 text-[11px] font-bold leading-4 text-zinc-500">{detail}</p>
                    </div>
                  ))}
                </div>

                <div className={cn('mt-4 rounded-[24px] p-4 ring-1 sm:mt-5 sm:rounded-[28px] sm:p-5', resultTone.block)}>
                  <div className="grid grid-cols-[1fr_auto] items-start gap-4">
                    <div>
                      <span className={cn('inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase', resultTone.badge)}>
                        {isResultAiCoolingDown ? copy.aiCoolingDownTitle : isResultImageCheckError ? copy.needsRetake : ratingLabel(scanResult.result.overallRating)}
                      </span>
                      <p className="mt-3 text-3xl font-black leading-none sm:text-4xl">{isResultAiCoolingDown ? copy.aiCoolingDownTitle : isResultImageCheckError ? copy.imageNotChecked : resultScoreLabel}</p>
                      <p className={cn('mt-3 max-w-[31rem] text-sm font-bold leading-6', resultTone.muted)}>
                        {resultVibe(scanResult.result)}
                      </p>
                      <p className="mt-3 max-w-[31rem] rounded-[18px] bg-white px-3 py-2 text-xs font-black leading-5 text-zinc-800 shadow-sm ring-1 ring-zinc-950/[0.06]">
                        {resultNextAction}
                      </p>
                      {personalScanExplanation && (
                        <p className="mt-2 max-w-[31rem] rounded-full bg-white px-3 py-2 text-xs font-black leading-5 text-zinc-700 shadow-sm ring-1 ring-zinc-950/[0.06]">
                          {personalScanExplanation}
                        </p>
                      )}
                      {scanConfidence && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={cn('rounded-full px-3 py-1 text-[11px] font-black uppercase', resultTone.badge)}>
                            {scanConfidence.label}
                          </span>
                          {!isResultImageCheckError && (
                            <button
                              className="min-h-[36px] rounded-full bg-white px-3 text-[11px] font-black text-zinc-950 shadow-sm ring-1 ring-zinc-950/[0.08] transition active:scale-[0.97]"
                              onClick={openFixResultSheet}
                              type="button"
                            >
                              {isRussian ? 'Исправить' : 'Fix result'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={cn('flex h-20 w-20 flex-col items-center justify-center rounded-full shadow-inner ring-4 sm:h-24 sm:w-24', resultTone.circle)}>
                      <p className="text-xl font-black sm:text-2xl">{resultConfidenceShort}</p>
                      <p className="text-[10px] font-black uppercase opacity-75">{isRussian ? 'доверие' : 'trust'}</p>
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

                {hardAvoidWarnings.length > 0 && (
                  <div className="mt-3 rounded-[24px] bg-red-50 p-4 text-red-950 ring-1 ring-red-200 sm:mt-4 sm:rounded-[26px] sm:p-5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="text-sm font-black">{isRussian ? 'Совпадает с вашим списком избегания' : 'Matches your hard avoid list'}</p>
                        <p className="mt-1 text-xs font-bold leading-5 text-red-900/75">
                          {hardAvoidWarnings.join(', ')} · {isRussian ? 'проверьте состав вручную, если это важно для безопасности' : 'confirm the label manually if this matters for safety'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!isResultImageCheckError && scanNutrition && (
                  <div className={cn('mt-4 rounded-[24px] p-4 ring-1 sm:mt-5 sm:rounded-[26px] sm:p-5', theme.soft)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">
                        {nutritionMeta?.label ?? (isRussian ? 'Оценка питания' : 'Estimated nutrition')}
                      </p>
                      <h3 className="mt-1.5 text-xl font-black leading-tight">{scanNutrition.calories} cal</h3>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-zinc-500 shadow-sm ring-1 ring-zinc-950/[0.06]">
                        {selectedMealStatus === 'eaten' ? (isRussian ? 'Учтено сегодня' : 'Counted today') : selectedMealStatus === 'not_eaten' ? (isRussian ? 'Не в калориях' : 'Saved only') : isRussian ? 'Не учтено' : 'Not counted'}
                      </span>
                      <button
                        className="min-h-[34px] rounded-full bg-white px-3 text-[11px] font-black text-zinc-950 shadow-sm ring-1 ring-zinc-950/[0.08] transition active:scale-[0.97]"
                        onClick={openFixResultSheet}
                        type="button"
                      >
                        {isRussian ? 'Исправить' : 'Fix food or serving'}
                      </button>
                    </div>
                  </div>
                    {scanResult.result.basis && (
                      <div className="mt-3 rounded-[18px] bg-white p-3 shadow-sm ring-1 ring-zinc-950/[0.05]">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-400">{isRussian ? 'Основа расчета' : 'Basis'}</p>
                        {nutritionMeta?.detail && <p className="mt-1 text-xs font-black leading-5 text-zinc-950">{nutritionMeta.detail}</p>}
                        <p className="mt-1 text-xs font-bold leading-5 text-zinc-600">{scanResult.result.basis.portionBasis}</p>
                        <p className="mt-0.5 text-xs font-semibold leading-5 text-zinc-400">{scanResult.result.basis.decisionBasis}</p>
                      </div>
                    )}
                    {portionConfidence && (
                      <div className={cn('mt-3 rounded-[18px] p-3 shadow-sm ring-1', portionConfidence.className)}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-60">{isRussian ? 'Уверенность порции' : 'Portion confidence'}</p>
                            <p className="mt-1 text-sm font-black leading-tight">{portionConfidence.label}</p>
                          </div>
                          <p className="text-lg font-black">{portionConfidence.score}%</p>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-950/[0.06]">
                          <div className={cn('h-full rounded-full transition-all duration-500', portionConfidence.bar)} style={{ width: `${portionConfidence.score}%` }} />
                        </div>
                        <p className="mt-2 text-xs font-bold leading-5 opacity-70">{portionConfidence.detail}</p>
                      </div>
                    )}
                    <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-[18px] bg-white p-1.5 shadow-sm ring-1 ring-zinc-950/[0.05]">
                      {([
                        ['small', isRussian ? 'Мало' : 'Small'],
                        ['medium', isRussian ? 'Сред' : 'Med'],
                        ['large', isRussian ? 'Много' : 'Large'],
                        ['package', isRussian ? 'Упак' : 'Pack'],
                      ] as Array<[PortionOption, string]>).map(([portion, label]) => {
                        const active = selectedPortion === portion;
                        return (
                          <button
                            className={cn(
                              'h-10 rounded-[14px] text-[11px] font-black transition active:scale-[0.97] sm:text-xs',
                              active ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950',
                            )}
                            key={portion}
                            onClick={() => {
                              const baseNutritionForPortion = activeSavedScan?.baseNutrition ?? baseScanNutrition ?? scanNutrition;
                              if (!baseNutritionForPortion) return;
                              const nextNutrition = scaleNutritionFacts(baseNutritionForPortion, portion);
                              setSelectedPortion(portion);
                              updateRecentScan(activeRecentScanId, {
                                baseNutrition: baseNutritionForPortion,
                                nutrition: nextNutrition,
                                portion,
                              });
                            }}
                            type="button"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">
                      {isRussian ? 'Подтвердите порцию перед учетом калорий' : 'Confirm portion before counting calories'}
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        ['Protein', `${scanNutrition.proteinG}g`],
                        ['Carbs', `${scanNutrition.carbsG}g`],
                        ['Fat', `${scanNutrition.fatG}g`],
                      ].map(([label, value]) => (
                        <div className="rounded-[18px] bg-white px-3 py-3 text-center shadow-sm ring-1 ring-zinc-950/[0.05]" key={label}>
                          <p className="text-lg font-black leading-none">{value}</p>
                          <p className="mt-1 text-[10px] font-black uppercase text-zinc-400">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{isRussian ? 'Учет еды' : 'Meal count'}</p>
                      <h3 className="mt-2 text-xl font-black leading-tight sm:text-2xl">{isRussian ? 'Учесть этот скан?' : 'Count this meal?'}</h3>
                    </div>
                    {selectedMealStatus && (
                      <span className={cn('rounded-full px-3 py-1 text-xs font-black', isDarkMode ? 'bg-white text-zinc-950' : 'bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-950/[0.08]')}>
                        {copy.selected}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {([
                      ['eaten', isRussian ? 'Съел' : 'I ate it'],
                      ['not_eaten', isRussian ? 'Просто проверил' : 'Just checking'],
                    ] as Array<['eaten' | 'not_eaten', string]>).map(([status, label]) => {
                      const active = selectedMealStatus === status;
                      return (
                        <button
                          className={cn(
                            'h-12 rounded-[16px] text-sm font-black transition duration-200 active:scale-[0.97]',
                            active
                              ? 'bg-zinc-950 text-white shadow-[0_14px_28px_rgba(15,15,15,0.16)]'
                              : 'bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-950/[0.05] hover:text-zinc-950',
                          )}
                          key={status}
	                          onClick={() => {
	                            setSelectedMealStatus(status);
	                            if (status === 'not_eaten') setSelectedFeeling(null);
                              const baseNutritionForPortion = activeSavedScan?.baseNutrition ?? baseScanNutrition ?? scanNutrition ?? undefined;
	                            updateRecentScan(activeRecentScanId, {
	                              eaten: status === 'eaten',
	                              consumedAt: status === 'eaten' ? new Date().toISOString() : undefined,
	                              feeling: status === 'eaten' ? selectedFeeling ?? undefined : undefined,
                                feelingLoggedAt: status === 'eaten' && selectedFeeling ? new Date().toISOString() : undefined,
                                feelingDelayMinutes: undefined,
                                foodCategory: deriveFoodCategory(scanResult.result),
                                baseNutrition: baseNutritionForPortion,
	                              nutrition: scanNutrition ?? undefined,
                                portion: selectedPortion,
	                            });
	                          }}
                          type="button"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

	                  {selectedMealStatus === 'eaten' ? (
	                    <>
	                      <h4 className="mt-5 text-sm font-black text-zinc-500">{isRussian ? 'Как самочувствие?' : 'How do you feel?'}</h4>
	                      <div className="mt-2 grid grid-cols-3 gap-2">
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
	                              onClick={() => {
                                  const loggedAt = new Date().toISOString();
                                  const consumedAt = activeSavedScan?.consumedAt ?? new Date().toISOString();
	                                setSelectedFeeling(feeling);
	                                updateRecentScan(activeRecentScanId, {
	                                  feeling,
                                    feelingLoggedAt: loggedAt,
                                    feelingDelayMinutes: feelingDelayMinutes(consumedAt, loggedAt),
	                                  consumedAt,
                                    foodCategory: deriveFoodCategory(scanResult.result),
	                                });
	                              }}
	                              type="button"
	                            >
	                              {feelingLabel(feeling)}
	                            </button>
	                          );
	                        })}
	                      </div>
	                    </>
	                  ) : (
	                    <div className="mt-4 rounded-[18px] bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-950/[0.05]">
	                      <p className="text-sm font-black text-zinc-700">
	                        {selectedMealStatus === 'not_eaten'
	                          ? isRussian ? 'Скан сохранен без самочувствия' : 'Saved without a feeling check'
	                          : isRussian ? 'Сначала выберите статус еды' : 'Choose meal status first'}
	                      </p>
	                      <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
	                        {selectedMealStatus === 'not_eaten'
	                          ? isRussian ? 'Паттерны строятся только из еды, которую вы реально съели' : 'Patterns only use food you actually ate'
	                          : isRussian ? 'Если вы это съели, DigestSnap сможет связать реакцию позже' : 'If you ate it, DigestSnap can connect your reaction later'}
	                      </p>
	                    </div>
	                  )}
	                  <p className={cn('mt-3 text-xs font-semibold leading-5', theme.muted)}>
	                    {selectedMealStatus === 'eaten'
	                      ? selectedFeeling
	                        ? isRussian
	                          ? `${feelingLabel(selectedFeeling)} будет связано с ${scanResult.result.productName}`
	                          : `${selectedFeeling} will be connected to ${scanResult.result.productName}`
	                        : isRussian
	                          ? 'Питание учтено. Самочувствие можно отметить сейчас или позже'
	                          : 'Nutrition is counted. Add a feeling now or later'
	                      : selectedMealStatus === 'not_eaten'
	                        ? isRussian
	                          ? 'Скан сохранен, но не считается в калориях или паттернах'
	                          : 'Scan saved, but not counted in calories or patterns'
	                        : copy.feelingConnectEmpty}
	                  </p>
                </div>
                )}

                {!isResultImageCheckError && (
                  <label className={cn('mt-4 block rounded-[24px] p-4 ring-1 sm:mt-5 sm:rounded-[26px]', theme.soft)}>
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{isRussian ? 'Заметка' : 'Private note'}</span>
                    <textarea
                      className="mt-3 min-h-[82px] w-full resize-none rounded-[18px] bg-white px-4 py-3 text-sm font-bold leading-6 outline-none ring-1 ring-zinc-950/[0.05] transition focus:ring-2 focus:ring-zinc-950/15"
                      onChange={(event) => updateRecentScan(activeRecentScanId, { note: event.target.value })}
                      placeholder={isRussian ? 'Например: съел вечером, было тяжело' : 'Example: late dinner, felt heavy'}
                      value={activeScanNote}
                    />
                  </label>
                )}

                {!isResultImageCheckError && (
                <div className="mt-5 grid gap-3">
                  <button
	                    className="h-14 rounded-full bg-white text-sm font-black text-zinc-950 shadow-[0_14px_30px_rgba(15,15,15,0.10)] ring-1 ring-zinc-950/10 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!selectedMealStatus}
                    onClick={async () => {
                      if (!selectedMealStatus) return;
                      if (selectedFeeling) {
                        await saveEntry(`${selectedFeeling} check-in saved: ${scanResult.result.productName}`);
                        touchUserStreak();
                      }
                      setResultSheetOpen(false);
                    }}
                    type="button"
                  >
                    {selectedMealStatus === 'eaten'
                      ? isRussian ? 'Сохранить и учесть' : 'Save and count'
                      : selectedMealStatus === 'not_eaten'
                        ? isRussian ? 'Сохранить без калорий' : 'Save without calories'
                        : isRussian ? 'Выберите статус' : 'Choose eaten or not'}
                  </button>
                </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {fixResultSheetOpen && scanResult && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-[60] flex items-end justify-center bg-black/45 px-[clamp(12px,4vw,20px)] pb-[max(18px,env(safe-area-inset-bottom))]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setFixResultSheetOpen(false)}
            >
              <motion.div
                animate={{ y: 0 }}
                className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-[28px] bg-white p-4 text-zinc-950 shadow-[0_24px_70px_rgba(0,0,0,0.30)] ring-1 ring-black/[0.06] [scrollbar-width:none] sm:rounded-[32px] sm:p-5 [&::-webkit-scrollbar]:hidden"
                exit={{ y: 24 }}
                initial={{ y: 24 }}
                onClick={(event) => event.stopPropagation()}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200" />
                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{isRussian ? 'Исправить скан' : 'Fix result'}</p>
                    <h2 className="mt-2 text-2xl font-black leading-tight">{isRussian ? 'Сделайте результат точнее' : 'Make the result accurate'}</h2>
                    <p className="mt-2 max-w-[21rem] text-sm font-bold leading-6 text-zinc-500">
                      {isRussian
                        ? 'Исправьте название, вердикт, порцию или питание. DigestSnap сохранит это как реальную правку'
                        : 'Correct the food name, verdict, serving, or nutrition. DigestSnap saves it as real data'}
                    </p>
                  </div>
                  <button
                    aria-label="Close fix result"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 transition active:scale-95"
                    onClick={() => setFixResultSheetOpen(false)}
                    type="button"
                  >
                    <ChevronRight className="h-5 w-5 rotate-90" />
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{isRussian ? 'Название' : 'Food name'}</span>
                    <input
                      className="mt-2 h-12 w-full rounded-[18px] bg-zinc-50 px-4 text-base font-black outline-none ring-1 ring-zinc-950/[0.06] transition focus:ring-2 focus:ring-zinc-950/20"
                      onChange={(event) => setFixDraft((current) => ({ ...current, productName: event.target.value }))}
                      value={fixDraft.productName}
                    />
                  </label>

                  <div>
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{isRussian ? 'Вердикт' : 'Verdict'}</span>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(['Safe', 'Caution', 'Avoid'] as ImageScanPayload['result']['overallRating'][]).map((rating) => (
                        <button
                          className={cn(
                            'h-11 rounded-[16px] text-sm font-black transition active:scale-[0.97]',
                            fixDraft.rating === rating ? ratingTone(rating).badge : 'bg-zinc-50 text-zinc-500 ring-1 ring-zinc-950/[0.06]',
                          )}
                          key={rating}
                          onClick={() => setFixDraft((current) => ({ ...current, rating }))}
                          type="button"
                        >
                          {ratingLabel(rating)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{isRussian ? 'Причина' : 'Reason'}</span>
                    <textarea
                      className="mt-2 min-h-[92px] w-full resize-none rounded-[18px] bg-zinc-50 px-4 py-3 text-sm font-bold leading-6 outline-none ring-1 ring-zinc-950/[0.06] transition focus:ring-2 focus:ring-zinc-950/20"
                      onChange={(event) => setFixDraft((current) => ({ ...current, reason: event.target.value }))}
                      placeholder={isRussian ? 'Почему вы исправляете результат' : 'What should the result say'}
                      value={fixDraft.reason}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{isRussian ? 'Порция' : 'Serving basis'}</span>
                    <input
                      className="mt-2 h-12 w-full rounded-[18px] bg-zinc-50 px-4 text-base font-black outline-none ring-1 ring-zinc-950/[0.06] transition focus:ring-2 focus:ring-zinc-950/20"
                      onChange={(event) => setFixDraft((current) => ({ ...current, portionBasis: event.target.value }))}
                      placeholder={isRussian ? 'Например: один батончик 28 г' : 'Example: one 28g bar'}
                      value={fixDraft.portionBasis}
                    />
                  </label>

                  <div>
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{isRussian ? 'Размер порции' : 'Serving size'}</span>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {([
                        [0.5, '1/2x'],
                        [1, '1x'],
                        [1.5, '1.5x'],
                        [2, '2x'],
                      ] as const).map(([multiplier, label]) => {
                        const active = fixDraft.servingMultiplier === String(multiplier);
                        return (
                          <button
                            className={cn(
                              'h-11 rounded-[16px] text-sm font-black transition active:scale-[0.97]',
                              active ? 'bg-zinc-950 text-white shadow-sm' : 'bg-zinc-50 text-zinc-500 ring-1 ring-zinc-950/[0.06]',
                            )}
                            key={label}
                            onClick={() => setCorrectionServingMultiplier(multiplier)}
                            type="button"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">
                      {isRussian ? 'Калории и макросы пересчитаются перед сохранением' : 'Calories and macros update before saving'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{isRussian ? 'Оценка' : 'Score'}</span>
                      <input
                        className="mt-2 h-12 w-full rounded-[18px] bg-zinc-50 px-4 text-base font-black outline-none ring-1 ring-zinc-950/[0.06] transition focus:ring-2 focus:ring-zinc-950/20"
                        inputMode="numeric"
                        max={100}
                        min={0}
                        onChange={(event) => {
                          const value = event.target.value;
                          const score = nutritionNumber(value, 50);
                          setFixDraft((current) => ({
                            ...current,
                            score: value,
                            rating: score >= 75 ? 'Safe' : score <= 45 ? 'Avoid' : 'Caution',
                          }));
                        }}
                        type="number"
                        value={fixDraft.score}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{isRussian ? 'Калории' : 'Calories'}</span>
                      <input
                        className="mt-2 h-12 w-full rounded-[18px] bg-zinc-50 px-4 text-base font-black outline-none ring-1 ring-zinc-950/[0.06] transition focus:ring-2 focus:ring-zinc-950/20"
                        inputMode="numeric"
                        min={0}
                        onChange={(event) => setFixDraft((current) => ({ ...current, calories: event.target.value }))}
                        type="number"
                        value={fixDraft.calories}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['proteinG', 'Protein'],
                      ['carbsG', 'Carbs'],
                      ['fatG', 'Fat'],
                      ['fiberG', 'Fiber'],
                      ['sugarG', 'Sugar'],
                      ['sodiumMg', 'Sodium'],
                    ] as const).map(([key, label]) => (
                      <label className="block" key={key}>
                        <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{label}</span>
                        <input
                          className="mt-2 h-12 w-full rounded-[18px] bg-zinc-50 px-3 text-base font-black outline-none ring-1 ring-zinc-950/[0.06] transition focus:ring-2 focus:ring-zinc-950/20"
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => setFixDraft((current) => ({ ...current, [key]: event.target.value }))}
                          type="number"
                          value={fixDraft[key]}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  className="mt-5 h-14 w-full rounded-full bg-zinc-950 text-base font-black text-white shadow-[0_16px_34px_rgba(15,15,15,0.20)] transition active:scale-[0.98]"
                  onClick={saveFixedScanResult}
                  type="button"
                >
                  {isRussian ? 'Сохранить исправление' : 'Save correction'}
                </button>
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
                <h2 className="mt-6 text-center text-[22px] font-black">{isRussian ? 'Добавить воду' : 'Log Water'}</h2>

                <div className="mt-6 rounded-[24px] bg-zinc-50 p-4 text-center ring-1 ring-zinc-950/[0.06]">
                  <p className="text-sm font-black text-zinc-500">{isRussian ? 'Воды добавлено' : 'Water logged'}</p>
                  <p className="mt-2 text-[38px] font-black leading-none">{waterCardLabel}</p>
                </div>

                <div className="mt-4 rounded-[22px] bg-zinc-50 p-3.5 ring-1 ring-zinc-950/[0.06] sm:rounded-[24px] sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-black text-zinc-500" htmlFor="manual-water-amount">
                      {isRussian ? 'Количество' : 'Amount'}
                    </label>
                    <div className="grid grid-cols-2 rounded-full bg-white p-1 shadow-sm ring-1 ring-zinc-950/[0.06]">
                      {([
                        ['ml', 'mL'],
                        ['oz', 'fl oz'],
                      ] as Array<[WaterUnit, string]>).map(([unit, label]) => (
                        <button
                          aria-label={`Set water unit to ${label}`}
                          className={cn(
                            'h-9 rounded-full px-4 text-xs font-black transition active:scale-[0.98]',
                            waterUnit === unit ? 'bg-zinc-950 text-white' : 'text-zinc-500',
                          )}
                          key={unit}
                          onClick={() => {
                            setWaterUnit(unit);
                            void persistDailyState({ waterUnit: unit });
                          }}
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

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
                    <span className="w-16 text-center text-lg font-black">{waterUnit === 'ml' ? 'mL' : 'fl oz'}</span>
                  </div>
                </div>

                <button
                  className={cn(
                    'mt-5 h-14 w-full rounded-full text-[17px] font-black transition active:scale-[0.98] sm:h-16 sm:text-[18px]',
                    manualWaterMl > 0 ? 'bg-zinc-950 text-white shadow-[0_14px_32px_rgba(15,15,15,0.20)]' : 'bg-zinc-300 text-white',
                  )}
                  disabled={manualWaterMl <= 0}
                  onClick={() => {
                    if (manualWaterMl > 0) {
                      const nextWaterMl = Math.round(clampNumber(waterMl + manualWaterMl, waterMl, 0, 20000));
                      const nextStreak = touchStoredStreak(streak, session.user.id);
                      setWaterMl(nextWaterMl);
                      setStreak(nextStreak);
                      setManualWaterAmount('');
                      void persistDailyState({ waterMl: nextWaterMl, streak: nextStreak });
                    }
                    setWaterSheetOpen(false);
                  }}
                  type="button"
                >
                  {isRussian ? 'Сохранить' : 'Log'}
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
                {deleteError && (
                  <div className="mt-4 rounded-[18px] bg-red-50 px-4 py-3 text-sm font-bold leading-5 text-red-700 ring-1 ring-red-100" role="alert">
                    {deleteError}
                  </div>
                )}
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
                    className="flex h-14 items-center justify-center gap-2 rounded-full bg-red-500 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
                    disabled={deleteLoading}
                    onClick={deleteAccount}
                    type="button"
                  >
                    {deleteLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
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
    goal: 'Maintain weight',
    dietType: 'No specific diet',
    checkInsPerDay: 2,
    triggers: [],
    symptoms: [],
    allergies: [],
    timelineWeeks: 6,
    answers: {},
    multiAnswers: {},
  });

  useEffect(() => {
    if (startAtLogin) clearPendingStoredProfile();
  }, [startAtLogin]);

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
      window.localStorage.setItem(DIGESTSNAP_PENDING_PROFILE_KEY, '1');
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
      if (field === 'goal') return { ...current, goal: value as DigestGoal, answers: { ...current.answers, [field]: value } };
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
      const isExclusiveChoice = value === 'None' || /^Not sure/i.test(value);
      const next = isExclusiveChoice
        ? [value]
        : existing.includes(value)
          ? existing.filter((item) => item !== value)
          : [...existing.filter((item) => item !== 'None' && !/^Not sure/i.test(item)), value];
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
    } catch {
      setAuthError('Could not open Google sign-in. Please try again.');
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
        [Camera, 'Scan first', 'Save the food and time before you forget.'],
        [Activity, 'Check later', 'Log the symptom when it actually happens.'],
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
                Sign in to keep scans, check-ins, and food patterns tied to your account.
              </p>

              <div className="mt-7 grid gap-2 text-left">
                {['Food score and confidence', 'Personal trigger context', 'Later check-ins'].map((item) => (
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
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-zinc-950">
                  {authLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'G'}
                </span>
                {authLoading ? 'Opening Google' : 'Continue with Google'}
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
