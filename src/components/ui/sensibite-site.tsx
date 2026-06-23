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
  ClipboardList,
  FileText,
  Flag,
  Flame,
  Home,
  Languages,
  LogOut,
  Mail,
  Moon,
  Plus,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  User,
  UserPlus,
} from 'lucide-react';
import { scanImageWithClientTimeout, type ImageScanPayload } from '../../lib/imageScanClient';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

type Navigate = (path: string, options?: { replace?: boolean }) => void;
type DashboardTab = 'home' | 'progress' | 'profile';
type IncludePreview = 'scan' | 'symptoms' | 'timeline' | 'speed';
type LegalPageKind = 'privacy' | 'terms' | 'subscription' | 'contact' | 'support';
type DashboardEntry = {
  id: string;
  title: string;
  created_at: string;
};
type GenderOption = 'Male' | 'Female' | 'Other';
type SensiGoal = 'Find triggers' | 'Reduce bloating' | 'Build consistency';
type UnitSystem = 'metric' | 'imperial';
type OnboardingStepKind = 'intro' | 'single' | 'multi' | 'basics' | 'timeline' | 'insight' | 'processing';

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
const triggerOptions = ['Fried food', 'Bread', 'Dairy', 'Soda', 'Late meals', 'Spicy food'];
const processingInsights = ['Calculating digestive thresholds...', 'Mapping symptom timing...', 'Building your trigger baseline...', 'Preparing your SensiBite profile...'];
const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    kind: 'intro',
    title: 'Eat. Feel. Remember.',
    subtitle: 'SensiBite helps you remember which meals may make you feel bad later.',
  },
  {
    id: 'goal',
    kind: 'single',
    field: 'goal',
    title: 'What do you want SensiBite to solve first?',
    subtitle: 'Pick the outcome you would actually come back for.',
    options: goalOptions,
  },
  {
    id: 'symptoms',
    kind: 'multi',
    field: 'symptoms',
    title: 'What keeps showing up after food?',
    subtitle: 'Choose every one that feels familiar.',
    options: ['Bloating', 'Pain', 'Nausea', 'Gas', 'Acid reflux', 'Low energy', 'Constipation', 'Urgency'],
  },
  {
    id: 'symptom-time',
    kind: 'single',
    field: 'symptomTime',
    title: 'When do you usually notice it?',
    options: ['Right after eating', '1-2 hours later', 'At night', 'The next morning'],
  },
  {
    id: 'tracking-style',
    kind: 'single',
    field: 'trackingStyle',
    title: 'What happens when you try tracking?',
    options: ['I do not track', 'Notes app sometimes', 'I ask AI then forget', 'A tracker app'],
  },
  {
    id: 'suspected-foods',
    kind: 'multi',
    field: 'triggers',
    title: 'Which foods already feel suspicious?',
    subtitle: 'These become your first watchlist.',
    options: triggerOptions,
  },
  {
    id: 'allergies',
    kind: 'multi',
    field: 'allergies',
    title: 'Any allergies or hard avoids?',
    options: ['Dairy', 'Gluten', 'Peanuts', 'Tree nuts', 'Eggs', 'Soy', 'Fish', 'None'],
  },
  {
    id: 'diet-type',
    kind: 'single',
    field: 'dietType',
    title: 'What diet fits you best?',
    options: ['No specific diet', 'High protein', 'Vegetarian', 'Vegan', 'Low carb', 'Halal', 'Low FODMAP'],
  },
  {
    id: 'meal-rhythm',
    kind: 'single',
    field: 'mealRhythm',
    title: 'What does your eating rhythm look like?',
    options: ['Regular meals', 'I snack a lot', 'I skip meals', 'Late meals often'],
  },
  {
    id: 'restaurant-frequency',
    kind: 'single',
    field: 'restaurantFrequency',
    title: 'How often do you eat out?',
    options: ['Rarely', '1-2 times weekly', '3-5 times weekly', 'Almost daily'],
  },
  {
    id: 'late-food',
    kind: 'single',
    field: 'lateFood',
    title: 'How often do you eat after 8 PM?',
    options: ['Rarely', 'Sometimes', 'Often', 'Almost every night'],
  },
  {
    id: 'stress',
    kind: 'single',
    field: 'stressImpact',
    title: 'Does stress affect your stomach?',
    options: ['Not really', 'Sometimes', 'Clearly yes', 'I am not sure'],
  },
  {
    id: 'sleep',
    kind: 'single',
    field: 'sleepImpact',
    title: 'Does poor sleep change your digestion?',
    options: ['No', 'A little', 'A lot', 'I never noticed'],
  },
  {
    id: 'water',
    kind: 'single',
    field: 'hydration',
    title: 'How is your water intake?',
    options: ['Low', 'Average', 'Good', 'Very high'],
  },
  {
    id: 'caffeine',
    kind: 'single',
    field: 'caffeine',
    title: 'How much caffeine do you drink?',
    options: ['None', '1 cup', '2-3 cups', 'Energy drinks'],
  },
  {
    id: 'soda',
    kind: 'single',
    field: 'carbonation',
    title: 'How often do you drink soda or sparkling drinks?',
    options: ['Rarely', 'Sometimes', 'Often', 'Daily'],
  },
  {
    id: 'spice',
    kind: 'single',
    field: 'spiceTolerance',
    title: 'How do spicy foods treat you?',
    options: ['Fine', 'Sometimes bad', 'Usually bad', 'I avoid them'],
  },
  {
    id: 'dairy',
    kind: 'single',
    field: 'dairyPattern',
    title: 'What happens after dairy?',
    options: ['Usually fine', 'Sometimes bloated', 'Often bloated', 'I avoid dairy'],
  },
  {
    id: 'bread',
    kind: 'single',
    field: 'breadPattern',
    title: 'What happens after bread or floury food?',
    options: ['Usually fine', 'Heavy stomach', 'Bloating', 'I avoid it'],
  },
  {
    id: 'fried',
    kind: 'single',
    field: 'friedPattern',
    title: 'What happens after fried food?',
    options: ['Usually fine', 'Sometimes bad', 'Often bad', 'Guaranteed regret'],
  },
  {
    id: 'consistency',
    kind: 'single',
    field: 'consistency',
    title: 'Why do food diaries fail for you?',
    options: ['I forget', 'Too much typing', 'No useful result', 'I never tried'],
  },
  {
    id: 'motivation',
    kind: 'single',
    field: 'motivation',
    title: 'What would keep you coming back?',
    options: ['Fast check-ins', 'Pattern callouts', 'Streaks', 'Clear food ratings'],
  },
  {
    id: 'timeline',
    kind: 'timeline',
    title: 'How fast do you want clarity?',
    subtitle: 'SensiBite estimates when your first repeat patterns should become visible.',
  },
  {
    id: 'basics',
    kind: 'basics',
    title: 'Profile basics',
    subtitle: 'One screen. Fast inputs. This calibrates your starting baseline.',
  },
  {
    id: 'checkins',
    kind: 'single',
    field: 'checkInsPerDay',
    title: 'How often should SensiBite check in?',
    options: ['1x daily', '2x daily', '3x daily', 'Only after meals'],
  },
  {
    id: 'data-priority',
    kind: 'single',
    field: 'dataPriority',
    title: 'What should the dashboard focus on first?',
    options: ['Symptoms', 'Likely triggers', 'Gut score', 'Consistency streaks'],
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
    subtitle: 'SensiBite is building your initial digestive profile.',
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
  'late-food',
  'basics',
  'checkins',
  'processing',
]);
const setupSteps = onboardingSteps.filter((step) => personalizationStepIds.has(step.id));
const SETUP_TOTAL_STEPS = setupSteps.length;
const SENSIBITE_PROFILE_STORAGE_KEY = 'sensibite-profile-v1';

type StoredSensiProfile = Pick<
  SetupProfile,
  'age' | 'allergies' | 'checkInsPerDay' | 'dietType' | 'gender' | 'goal' | 'heightCm' | 'symptoms' | 'timelineWeeks' | 'triggers' | 'unitSystem' | 'weightKg'
>;

function toStoredProfile(profile: SetupProfile): StoredSensiProfile {
  return {
    age: profile.age,
    allergies: profile.allergies,
    checkInsPerDay: profile.checkInsPerDay,
    dietType: profile.dietType,
    gender: profile.gender,
    goal: profile.goal,
    heightCm: profile.heightCm,
    symptoms: profile.symptoms,
    timelineWeeks: profile.timelineWeeks,
    triggers: profile.triggers,
    unitSystem: profile.unitSystem,
    weightKg: profile.weightKg,
  };
}

function saveStoredProfile(profile: SetupProfile) {
  try {
    window.localStorage.setItem(SENSIBITE_PROFILE_STORAGE_KEY, JSON.stringify(toStoredProfile(profile)));
  } catch {
    // Local storage can be disabled; the app still works without profile context.
  }
}

function readStoredProfile(): StoredSensiProfile | null {
  try {
    const raw = window.localStorage.getItem(SENSIBITE_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSensiProfile>;
    return {
      age: typeof parsed.age === 'number' ? parsed.age : 24,
      allergies: Array.isArray(parsed.allergies) ? parsed.allergies.filter((value): value is string => typeof value === 'string') : [],
      checkInsPerDay: typeof parsed.checkInsPerDay === 'number' ? parsed.checkInsPerDay : 2,
      dietType: typeof parsed.dietType === 'string' ? parsed.dietType : 'No specific diet',
      gender: parsed.gender === 'Male' || parsed.gender === 'Other' ? parsed.gender : 'Female',
      goal: parsed.goal === 'Reduce bloating' || parsed.goal === 'Build consistency' ? parsed.goal : 'Find triggers',
      heightCm: typeof parsed.heightCm === 'number' ? parsed.heightCm : 170,
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

function getProfileScanTriggers(profile: StoredSensiProfile | null) {
  const values = [
    ...(profile?.triggers ?? []),
    ...(profile?.allergies ?? []),
    ...(profile?.symptoms ?? []),
    profile?.dietType,
    profile?.goal,
  ];

  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value !== 'None')))).slice(0, 12);
}

function PhoneStatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={cn('relative h-12 text-[10px] font-black md:text-[11px]', dark ? 'text-white' : 'text-zinc-950')}>
      <span className="absolute left-5 top-4 z-10 tabular-nums">11:24</span>
      <span className="absolute left-1/2 top-3 h-[24px] w-[78px] -translate-x-1/2 rounded-full bg-black md:h-[27px] md:w-[92px]" />
      <div className="absolute right-4 top-4 z-10 flex items-center">
        <span className={cn('relative h-3.5 w-6 rounded-[5px] border', dark ? 'border-white/80' : 'border-zinc-950')}>
          <span className={cn('absolute -right-[3px] top-1/2 h-1.5 w-[2px] -translate-y-1/2 rounded-r-sm', dark ? 'bg-white/80' : 'bg-zinc-950')} />
          <span className={cn('absolute bottom-[2px] left-[2px] top-[2px] w-[15px] rounded-[3px]', dark ? 'bg-white' : 'bg-zinc-950')} />
        </span>
      </div>
    </div>
  );
}

function MarketingPhone({
  dark = false,
  tilt = 'rotate-0',
  result = false,
  preview = 'scan',
}: {
  dark?: boolean;
  tilt?: string;
  result?: boolean;
  preview?: IncludePreview;
}) {
  const previewContent: Record<IncludePreview, { label: string; title: string; metric: string; accent: string; body: string }> = {
    scan: {
      label: 'Result ready',
      title: 'Fried chicken meal',
      metric: 'High',
      accent: 'Possible trigger',
      body: 'Fried food is a possible repeat signal in evening meals.',
    },
    symptoms: {
      label: 'Check-in saved',
      title: 'Bloated after dinner',
      metric: '3x',
      accent: 'Repeat symptom',
      body: 'Bloating was logged after similar fried meals this week.',
    },
    timeline: {
      label: 'Pattern found',
      title: 'Late fried meals',
      metric: 'Late',
      accent: 'Risk window',
      body: 'Discomfort check-ins can be compared against meal timing.',
    },
    speed: {
      label: 'Quick log',
      title: 'One-tap memory',
      metric: '3s',
      accent: 'Logged',
      body: 'A food event is saved before the detail disappears.',
    },
  };
  const activePreview = previewContent[preview];

  return (
    <div
      className={cn(
        'relative w-[218px] shrink-0 rounded-[48px] bg-[linear-gradient(145deg,#d6d3cc,#8a8379_38%,#f8f7f2_54%,#5d5a55)] p-[6px] shadow-[0_38px_80px_rgba(15,23,42,0.26)] ring-1 ring-zinc-400/60 md:w-[244px]',
        tilt,
      )}
    >
      <div className="absolute -left-[4px] top-[104px] h-9 w-[3px] rounded-l bg-zinc-700" />
      <div className="absolute -left-[4px] top-[151px] h-11 w-[3px] rounded-l bg-zinc-700" />
      <div className="absolute -right-[4px] top-[136px] h-14 w-[3px] rounded-r bg-zinc-700" />
      <div className={cn('h-[492px] overflow-hidden rounded-[42px] border-[8px] border-black md:h-[548px]', dark ? 'bg-[#14121a] text-white' : 'bg-[#fbfaf7] text-zinc-950')}>
        <PhoneStatusBar dark={dark} />
        {!result ? (
          <>
            <div className="relative mx-3 h-[238px] overflow-hidden rounded-[28px] md:h-[268px]">
              <img
                alt="Fried meal scan preview"
                className="h-full w-full object-cover"
                src="https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?q=80&w=900&auto=format&fit=crop"
              />
              <div className="absolute inset-7 rounded-[24px] border-2 border-white/[0.85] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
              <div className="absolute inset-x-10 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-zinc-200 shadow-[0_0_24px_rgba(228,228,231,0.75)]" />
              <div className="absolute bottom-5 left-1/2 h-14 w-14 -translate-x-1/2 rounded-full border-4 border-white bg-white/25 backdrop-blur" />
              <div className="absolute left-4 top-4 rounded-full bg-black/35 p-3 text-white backdrop-blur">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <div className="absolute bottom-5 left-4 rounded-full bg-black/55 px-3 py-2 text-[10px] font-black text-white backdrop-blur">
                Scanning fried meal
              </div>
            </div>
            <div className={cn('m-3 rounded-[22px] p-3.5', dark ? 'bg-white/[0.08]' : 'bg-white shadow-[0_12px_28px_rgba(15,23,42,0.08)]')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-zinc-400">Photo check</p>
                  <p className="mt-1 text-base font-black md:text-lg">Late fried meal</p>
                </div>
                <div className="rounded-full bg-zinc-200 px-3 py-1 text-[11px] font-black text-zinc-950">Live</div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full w-[68%] rounded-full bg-zinc-950" />
              </div>
              <p className="mt-2 text-[10px] font-black text-zinc-400 md:text-[11px]">Analyzing ingredients and your recent logs</p>
            </div>
          </>
        ) : (
          <div className="px-5 pt-4">
            <div className="relative h-40 overflow-hidden rounded-[24px] md:h-44">
              <img
                alt={`${activePreview.title} preview`}
                className="h-full w-full object-cover"
                src="https://images.unsplash.com/photo-1562967914-608f82629710?q=80&w=900&auto=format&fit=crop"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2 text-white">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">{activePreview.label}</p>
                  <p className="mt-1 text-sm font-black leading-tight md:text-lg">{activePreview.title}</p>
                </div>
                <div className="hidden shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-zinc-950 md:block">11:25 PM</div>
              </div>
            </div>
            <div className="mt-5 rounded-[24px] bg-zinc-950 p-4 text-white shadow-[0_16px_32px_rgba(15,23,42,0.16)]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-white/[0.55]">SensiBite memory</p>
                <p className="text-[11px] font-black text-zinc-300">{activePreview.accent}</p>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-5xl font-black">{activePreview.metric}</p>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-zinc-100 ring-1 ring-white/[0.15]">
                  <ScanLine className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-[12px] font-semibold leading-5 text-white/[0.68]">{activePreview.body}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LandingPage({ navigate }: { navigate: Navigate }) {
  const [activeIncludeIndex, setActiveIncludeIndex] = useState(0);
  const loveReviews = [
    ['Young adult, 24', 'I forget what I ate once I feel fine. This makes the follow-up simple.'],
    ['Parent, 51', 'The questions made me realize I never keep notes long enough to see a pattern.'],
    ['Student tester', 'It feels faster than writing a food diary, so I would actually use it.'],
    ['Wellness user', 'The value is the timeline. Photos and check-ins finally stay together.'],
    ['Early tester', 'It turns small moments into something I can look back at later.'],
  ];
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
      body: 'Take one photo when you eat. SensiBite saves the meal, time, and context before the detail disappears.',
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
      title: 'See the pattern',
      body: 'SensiBite looks across your meals and check-ins, then highlights possible repeat triggers so the same pattern does not disappear from memory.',
    },
    {
      icon: Bell,
      preview: 'speed',
      title: 'Keep it effortless',
      body: 'The loop stays light enough to use in real life: photo first, check-in later, pattern when enough signals repeat.',
    },
  ];

  return (
    <main className="min-h-screen bg-[#fffef7] text-zinc-950 antialiased">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#fffef7]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] w-full max-w-[1680px] items-center justify-between px-5 md:h-[86px] md:px-10 xl:px-12">
          <button className="flex items-center gap-2.5 text-2xl font-black tracking-tight md:text-4xl" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} type="button">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-zinc-950 text-white md:h-12 md:w-12 md:rounded-[14px]">
              <Sparkles className="h-5 w-5 md:h-7 md:w-7" />
            </span>
            SensiBite
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
          <button className="h-11 rounded-full bg-zinc-950 px-5 text-sm font-black text-white lg:hidden" onClick={() => navigate('/login')} type="button">
            Login
          </button>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-[1680px] items-center gap-8 overflow-hidden px-5 pb-14 pt-8 md:min-h-[calc(100vh-86px)] md:px-10 md:py-12 xl:grid-cols-[0.88fr_1.12fr] xl:px-12">
        <div className="relative z-10 max-w-[720px]">
          <h1 className="max-w-[820px] text-[42px] font-black leading-[1.01] sm:text-[58px] md:text-[76px] md: xl:text-[82px]">
            Meet SensiBite
            <br />
            Spot triggers from food photos
          </h1>
          <p className="mt-6 max-w-[690px] text-[18px] font-semibold leading-8 text-[#5f574d] md:mt-7 md:text-[25px] md:leading-[1.42]">
            Scan a meal, check in later, and see possible patterns without keeping a food diary.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row md:mt-9 md:gap-4">
            <button
              className="flex h-14 items-center justify-center rounded-[12px] bg-zinc-950 px-7 text-base font-black text-white transition active:scale-[0.98] md:h-16 md:px-8 md:text-lg"
              onClick={() => navigate('/auth')}
              type="button"
            >
              Get Started
            </button>
          </div>
        </div>

        <div className="relative min-h-[530px] sm:min-h-[630px] xl:min-h-[650px]">
          <div className="absolute left-1/2 top-10 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(113,113,122,0.16),transparent_68%)] blur-2xl sm:h-[390px] sm:w-[390px] md:h-[430px] md:w-[430px]" />
          <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 sm:top-14 sm:-translate-x-[74%] xl:left-[7%] xl:top-16 xl:translate-x-0">
            <MarketingPhone tilt="-rotate-6" />
          </div>
          <div className="absolute right-1/2 top-0 z-10 hidden translate-x-[78%] sm:block xl:right-[5%] xl:translate-x-0">
            <MarketingPhone result tilt="rotate-6" />
          </div>
        </div>
      </section>

      <section className="scroll-mt-28 bg-[#fffff4] px-5 py-24 md:px-10 md:py-28" id="includes">
        <div className="mx-auto max-w-[1480px]">
          <div className="mx-auto max-w-[960px] text-center">
              <h2 className="mx-auto max-w-[850px] text-5xl font-black leading-[1.02] md:text-7xl">
                One photo now. Clearer patterns later.
              </h2>
              <p className="mx-auto mt-6 max-w-[820px] text-lg font-semibold leading-8 text-[#5f574d] md:text-2xl md:leading-10">
                SensiBite removes the heavy part of food tracking. Scan what you ate, check in when your body reacts, and let the timeline build itself.
              </p>
          </div>

          <div className="mt-14 grid items-start gap-12 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="flex justify-center lg:sticky lg:top-28">
              <MarketingPhone preview={includeCards[activeIncludeIndex].preview} result />
            </div>
            <div className="grid gap-4">
              {includeCards.map(({ icon: Icon, title, body }, index) => {
                const selected = activeIncludeIndex === index;
                return (
                <button
                  className={cn(
                    'grid min-h-[178px] gap-5 rounded-[28px] border bg-white p-6 text-left text-zinc-950 transition duration-300 active:scale-[0.99] md:grid-cols-[76px_1fr] md:items-center md:p-7',
                    selected
                      ? 'z-10 -translate-y-1 border-zinc-950 shadow-[0_26px_70px_rgba(15,23,42,0.16)] ring-2 ring-zinc-950/5'
                      : 'border-zinc-200 shadow-sm hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]',
                  )}
                  onClick={() => setActiveIncludeIndex(index)}
                  key={title}
                  type="button"
                >
                  <div className={cn('flex h-16 w-16 items-center justify-center rounded-[22px]', selected ? 'bg-zinc-950 text-white' : 'bg-[#f1f0ea] text-zinc-950')}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black leading-tight md:text-3xl">{title}</h3>
                    <p className="mt-3 max-w-[650px] text-base font-semibold leading-7 text-[#5f574d] md:text-lg md:leading-8">{body}</p>
                  </div>
                </button>
              )})}
            </div>
          </div>
        </div>
      </section>

      <section className="scroll-mt-28 overflow-hidden bg-white px-5 py-24 md:px-12 md:py-28" id="product">
        <div className="mx-auto max-w-[1500px]">
          <div className="mx-auto max-w-[1120px] text-center">
            <h2 className="text-[48px] font-black leading-[0.98] md:text-[86px]">
              More than tracking meals.
              <br />
              See what keeps showing up.
            </h2>
            <p className="mx-auto mt-7 max-w-[850px] text-lg font-semibold leading-8 text-[#5f574d] md:text-2xl md:leading-10">
              SensiBite turns photos, check-ins, and timing into one clear picture, so repeated meals stop disappearing from memory.
            </p>
            <div className="mx-auto mt-10 grid max-w-[1040px] gap-3 text-left md:grid-cols-3">
              {[
                ['Snap the meal', 'Save what you ate in seconds with a photo.'],
                ['Check in later', 'Tap how you feel when the reaction actually happens.'],
                ['See the pattern', 'Spot the meals that keep showing up.'],
              ].map(([title, body], index) => (
                <div className="rounded-[24px] bg-[#fbfaf7] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.06)] ring-1 ring-zinc-950/[0.05]" key={title}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-white">{index + 1}</div>
                    <div>
                      <h3 className="text-xl font-black">{title}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">{body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-14 grid gap-6 lg:grid-cols-[1.45fr_0.85fr]">
            <div className="rounded-[34px] bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.10)] ring-1 ring-zinc-950/[0.06] md:p-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Pattern timeline</p>
                  <p className="mt-4 text-5xl font-black md:text-7xl">3 repeats</p>
                </div>
                <span className="rounded-full bg-[#f7f3ea] px-4 py-2 text-sm font-black text-[#5f574d]">This week</span>
              </div>

              <div className="relative mt-12 h-[300px] overflow-hidden rounded-[26px] bg-[#fbfaf7] p-5">
                <div className="absolute inset-x-8 bottom-16 top-10 grid grid-rows-4">
                  {[0, 1, 2, 3].map((line) => (
                    <span className="border-t border-zinc-200" key={line} />
                  ))}
                </div>
                <svg aria-hidden className="absolute inset-x-8 bottom-16 top-10 h-[220px] w-[calc(100%-4rem)] overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 220">
                  <path d="M0 156 C110 124 168 142 244 104 C331 60 414 76 498 54 C579 33 645 45 700 22" fill="none" stroke="#18181b" strokeLinecap="round" strokeWidth="8" />
                  <path d="M0 156 C110 124 168 142 244 104 C331 60 414 76 498 54 C579 33 645 45 700 22 L700 220 L0 220 Z" fill="url(#patternFade)" opacity="0.16" />
                  <circle cx="700" cy="22" fill="#fff" r="10" stroke="#18181b" strokeWidth="6" />
                  <defs>
                    <linearGradient id="patternFade" x1="0" x2="0" y1="0" y2="1">
                      <stop stopColor="#18181b" />
                      <stop offset="1" stopColor="#18181b" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute bottom-8 left-8 right-8 flex justify-between">
                  {[0, 1, 2, 3, 4].map((dot) => (
                    <span className="h-2 w-2 rounded-full bg-zinc-300" key={dot} />
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[34px] bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.10)] ring-1 ring-zinc-950/[0.06] md:p-9">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Feeling check-ins</p>
                <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-black text-zinc-500">4 entries</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {['Fine', 'Bloated', 'Pain', 'Nausea'].map((status) => (
                  <div className="rounded-[20px] bg-[#fbfaf7] px-4 py-5 text-center ring-1 ring-zinc-950/[0.04]" key={status}>
                    <p className="text-[20px] font-black text-zinc-950">{status}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 rounded-[26px] bg-[#fbfaf7] p-5 text-zinc-950 ring-1 ring-zinc-950/[0.04]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Pattern score</p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-6xl font-black leading-none">6/10</p>
                  </div>
                  <div className="relative h-16 w-16 shrink-0 rounded-full bg-zinc-100 p-1.5">
                    <div className="absolute inset-1.5 rounded-full bg-[conic-gradient(#18181b_0_60%,#e7e5e4_60%_100%)]" />
                    <div className="absolute inset-4 rounded-full bg-[#fbfaf7]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="overflow-hidden bg-[#fffef7] px-5 py-20 md:px-12">
        <div className="mx-auto max-w-[1500px] text-center">
          <h2 className="text-5xl font-black leading-[1.02] md:text-7xl">Early users get it fast</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {loveReviews.map(([name, quote]) => (
                <article
                  className="rounded-[26px] bg-white p-6 text-left shadow-[0_18px_45px_rgba(15,23,42,0.07)] ring-1 ring-zinc-950/[0.05]"
                  key={name}
                >
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((star) => (
                      <Star className="h-4 w-4 fill-zinc-950 text-zinc-950" key={star} />
                    ))}
                  </div>
                  <p className="mt-5 text-lg font-bold leading-7 text-zinc-950">"{quote}"</p>
                  <p className="mt-5 text-sm font-black text-zinc-500">{name}</p>
                </article>
              ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#fffef7] px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-[1500px] gap-8 border-t border-zinc-200 pt-10 md:grid-cols-[1fr_auto_auto]">
          <div>
            <p className="text-2xl font-black">SensiBite</p>
            <p className="mt-4 max-w-[360px] text-sm font-semibold leading-6 text-zinc-500">Private food memory for meals, check-ins, and possible repeat patterns.</p>
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
    lede: 'SensiBite is built around private food and symptom memory. This page explains what we collect, why we collect it, and the controls users should have before trusting the product.',
    sections: [
      {
        title: 'Information we collect',
        body: 'We collect only the information needed to operate SensiBite and improve the experience.',
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
          'We only share data with service providers needed to operate SensiBite, such as hosting, authentication, AI analysis, analytics, and payment infrastructure, under appropriate processing restrictions.',
        ],
      },
      {
        title: 'AI processing',
        body: 'SensiBite may use AI providers to analyze photos, labels, text, and patterns. AI output can be incomplete or wrong. The product is designed for wellness tracking and personal pattern memory, not medical diagnosis, treatment, emergency care, or guaranteed allergy safety.',
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
        body: 'SensiBite is not directed to children under 13. Users under the age of majority should use SensiBite only with involvement from a parent or guardian, especially when entering allergy, symptom, or body-profile information.',
      },
      {
        title: 'Contact',
        body: 'For privacy requests, account deletion, or data questions, contact SensiBite support at support@sensibite.ai or use the Support page.',
      },
    ],
  },
  terms: {
    eyebrow: 'Legal',
    title: 'Terms of Use',
    lede: 'These terms explain the rules for using SensiBite. They are written to keep the product honest: useful wellness tracking, no fake medical promises.',
    sections: [
      {
        title: 'What SensiBite does',
        body: 'SensiBite helps users log meals, symptoms, feelings, and timing so they can notice possible repeat patterns. It is a wellness and personal tracking product.',
      },
      {
        title: 'Not medical advice',
        body: 'SensiBite does not provide medical advice, diagnosis, treatment, emergency support, or professional dietary care. Do not ignore professional medical advice because of anything shown in SensiBite. If you have severe pain, allergic reactions, breathing trouble, blood in stool, persistent vomiting, or another urgent symptom, seek medical help immediately.',
      },
      {
        title: 'Food and allergy limitations',
        body: 'SensiBite may miss ingredients, hidden allergens, cross-contamination, preparation methods, or label details. A scan or pattern result must never be treated as a guarantee that a food is safe. Users with allergies, medical conditions, pregnancy, eating disorders, chronic illness, or prescribed diets should confirm decisions with a qualified professional.',
      },
      {
        title: 'User responsibilities',
        body: 'You are responsible for the information you enter, the decisions you make, and how you use results. You agree not to misuse the product, upload illegal content, attempt to access another account, reverse engineer the service, or use SensiBite to harm yourself or others.',
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
        body: 'We may suspend or terminate access if an account violates these terms, creates security risk, abuses infrastructure, or uses the product in a way that could harm users, SensiBite, or third parties.',
      },
      {
        title: 'Disclaimers and liability',
        body: 'To the maximum extent permitted by applicable law, SensiBite is provided as is and as available. We do not promise uninterrupted service, perfect accuracy, medical outcomes, or that every food trigger will be detected. Liability is limited to the extent allowed by applicable law.',
      },
      {
        title: 'Contact',
        body: 'For questions about these terms, contact SensiBite at support@sensibite.ai or use the Contact page.',
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
        body: 'SensiBite should show the plan price, renewal period, trial length, billing date, cancellation method, and refund rules before a user starts a paid plan.',
        items: [
          'Show the exact monthly or yearly price in the user-facing checkout.',
          'Show whether the trial is free, when it ends, and when billing starts.',
          'Make cancellation reachable from account settings and this page.',
          'Send account-status or billing reminders where required by the payment provider or local law.',
        ],
      },
      {
        title: 'How to cancel',
        body: 'If you subscribed through an app store or payment provider, cancel through that same provider. If SensiBite bills you directly, cancellation should be available from your account dashboard after payment integration is enabled.',
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
    lede: 'Reach SensiBite for product questions, partnerships, privacy requests, or account help.',
    sections: [
      {
        title: 'General contact',
        body: 'Use this page for product questions, demo requests, feedback, and non-urgent account questions. You can also contact support@sensibite.ai.',
      },
      {
        title: 'Privacy requests',
        body: 'For account deletion, data export, or privacy questions, include the email used for your SensiBite account so the request can be verified.',
      },
      {
        title: 'Medical concerns',
        body: 'SensiBite cannot answer urgent medical questions. If symptoms are severe, sudden, recurring, or dangerous, contact a doctor or emergency service.',
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
          <button className="text-lg font-black tracking-tight" onClick={() => navigate('/')} type="button">
            SensiBite
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
                  SensiBite is a wellness tracker for personal pattern memory. It is not emergency care, diagnosis, or guaranteed allergy safety.
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
    [Activity, 'Check in later', 'Symptoms often arrive after the meal. SensiBite keeps the second signal simple enough to actually log.'],
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
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">About SensiBite</p>
            <h1 className="mt-5 max-w-[760px] text-[48px] font-black leading-[1.02] md:text-[78px]">
              Food memory for people who need proof, not guesses.
            </h1>
            <p className="mt-7 max-w-[680px] text-lg font-semibold leading-8 text-[#5f574d] md:text-2xl md:leading-10">
              SensiBite exists because the hard part is not knowing that your stomach feels off. The hard part is remembering exactly what happened before it became obvious.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[34px] bg-zinc-950 p-7 text-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] sm:col-span-2">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-white/45">Product thesis</p>
              <h2 className="mt-5 text-4xl font-black leading-tight">
                The loop has to be faster than forgetting.
              </h2>
              <p className="mt-5 max-w-[760px] text-base font-semibold leading-7 text-white/62">
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
                SensiBite shows possible patterns. It avoids guaranteed safety claims and keeps health decisions in the user’s control.
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
  const initialName = session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0] ?? 'SensiBite user';
  const [storedProfile] = useState(() => readStoredProfile());
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [scanResult, setScanResult] = useState<ImageScanPayload | null>(null);
  const [logs, setLogs] = useState<DashboardEntry[]>([]);
  const [dashboardError, setDashboardError] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [selectedDay, setSelectedDay] = useState(5);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [profileName, setProfileName] = useState(initialName);
  const [profileUsername, setProfileUsername] = useState('sensibite');
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [profileDraftName, setProfileDraftName] = useState(initialName);
  const [profileDraftUsername, setProfileDraftUsername] = useState('sensibite');
  const [resultSheetOpen, setResultSheetOpen] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState('');
  const [language, setLanguage] = useState<'English' | 'Russian'>('English');
  const [trackingReminderOn, setTrackingReminderOn] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncErrorMessage = 'Unable to sync entries. Please check your connection.';
  const scanErrorMessage = 'Unable to analyze this right now. Please try again.';

  useEffect(() => {
    let active = true;

    async function loadEntries() {
      const { data, error } = await supabase
        .from('entries')
        .select('id,title,created_at')
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
    return () => {
      if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    };
  }, [scanPreviewUrl]);

  const saveEntry = async (title: string) => {
    const optimisticEntry: DashboardEntry = {
      id: crypto.randomUUID(),
      title,
      created_at: new Date().toISOString(),
    };

    setLogs((items) => [optimisticEntry, ...items.slice(0, 5)]);

    const { data, error } = await supabase
      .from('entries')
      .insert({ title })
      .select('id,title,created_at')
      .single();

    if (error) {
      setDashboardError(syncErrorMessage);
      return;
    }

    if (data) {
      setLogs((items) => items.map((item) => (item.id === optimisticEntry.id ? data : item)));
    }
  };

  const runImageScan = async (file: File | undefined) => {
    if (!file) return;
    setActiveTab('home');
    setScanState('scanning');
    setDashboardError('');
    setResultSheetOpen(false);
    setScanPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });

    try {
      const result = await scanImageWithClientTimeout(file, {
        userLang: language,
        userTriggers: getProfileScanTriggers(storedProfile),
        slowAfterMs: 1_800,
        hardTimeoutMs: 9_000,
      });

      setScanResult(result.scan);
      setScanState('done');
      setResultSheetOpen(true);
      await saveEntry(`${result.scan.result.overallRating}: ${result.scan.result.productName} scored ${result.scan.result.score}/100`);
    } catch (error) {
      setScanState('error');
      setDashboardError(scanErrorMessage);
    }
  };

  const openCamera = () => {
    setResultSheetOpen(false);
    fileInputRef.current?.click();
  };

  const saveProfileDetails = () => {
    const nextName = profileDraftName.trim();
    const nextUsername = profileDraftUsername.trim().replace(/^@/, '');

    if (!nextName) {
      setDashboardError('Name cannot be empty.');
      return;
    }

    setProfileName(nextName);
    setProfileUsername(nextUsername || 'sensibite');
    setProfileSheetOpen(false);
    setDashboardError('Profile updated.');
  };

  const toggleLanguage = () => {
    setLanguage((current) => {
      const next = current === 'English' ? 'Russian' : 'English';
      setDashboardError(next === 'Russian' ? 'Язык изменен на русский.' : 'Language changed to English.');
      return next;
    });
  };

  const toggleTrackingReminder = () => {
    setTrackingReminderOn((current) => {
      const next = !current;
      setDashboardError(next ? 'Daily check-in reminder enabled.' : 'Daily check-in reminder disabled.');
      return next;
    });
  };

  const copyReferralCode = async () => {
    try {
      await navigator.clipboard?.writeText('SENSIBITE10');
      setDashboardError('Referral code copied.');
    } catch {
      setDashboardError('Referral code: SENSIBITE10');
    }
  };

  const exportSummaryReport = () => {
    const report = [
      'SensiBite Summary Report',
      `Name: ${profileName}`,
      `Gut score: ${gutScoreOutOfTen ?? 'N/A'}`,
      `Latest scan: ${scanResult?.result.productName ?? 'No scan yet'}`,
      `Recent logs: ${logs.map((item) => item.title).join(' | ') || 'No logs yet'}`,
    ].join('\n');
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sensibite-summary.txt';
    link.click();
    URL.revokeObjectURL(url);
    setDashboardError('Summary report downloaded.');
  };

  const openSocial = (label: string) => {
    const urls: Record<string, string> = {
      Instagram: 'https://instagram.com/',
      TikTok: 'https://tiktok.com/',
      X: 'https://x.com/',
    };
    window.open(urls[label] ?? 'https://sensibite.ai/', '_blank', 'noopener,noreferrer');
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

  const hasActivity = logs.length > 0 || Boolean(scanResult);
  const isRussian = language === 'Russian';
  const scanCount = logs.length;
  const gutScoreOutOfTen = scanResult ? Math.max(1, Math.round(scanResult.result.score / 10)) : null;
  const gutScorePercent = gutScoreOutOfTen ? gutScoreOutOfTen * 10 : 0;
  const latestTitle = scanResult?.result.productName ?? logs[0]?.title ?? '';
  const latestReason = scanResult?.result.flaggedChemicals[0]?.reason ?? '';
  const dashboardDays = [
    { day: 'W', date: '27', progress: scanCount > 5 ? 100 : 0, state: scanCount > 5 ? 'done' : 'empty' },
    { day: 'T', date: '28', progress: scanCount > 4 ? 100 : 0, state: scanCount > 4 ? 'done' : 'empty' },
    { day: 'F', date: '29', progress: scanCount > 3 ? 100 : 0, state: scanCount > 3 ? 'done' : 'empty' },
    { day: 'S', date: '30', progress: scanCount > 2 ? 100 : 0, state: scanCount > 2 ? 'done' : 'empty' },
    { day: 'S', date: '31', progress: scanCount > 1 ? 100 : 0, state: scanCount > 1 ? 'done' : 'empty' },
    { day: 'M', date: '1', progress: scanCount > 0 ? 100 : 0, state: 'today' },
    { day: 'T', date: '2', progress: 0, state: 'ahead' },
  ];
  const topDashboardCards = [
    {
      value: hasActivity ? String(scanCount) : 'N/A',
      title: 'Scans',
      subtitle: hasActivity ? 'Saved' : 'No data',
      color: '#18181b',
      progress: hasActivity ? Math.min(100, scanCount * 18) : 0,
      action: 'Scan',
      detail: hasActivity ? 'Open camera' : 'Scan first meal',
      interactive: false,
    },
    {
      value: hasActivity ? '1+' : 'N/A',
      title: 'Patterns',
      subtitle: hasActivity ? 'Review' : 'Needs logs',
      color: '#71717a',
      progress: hasActivity ? 42 : 0,
      action: 'Progress',
      detail: 'View details',
      interactive: true,
    },
    {
      value: gutScoreOutOfTen ? `${gutScoreOutOfTen}/10` : 'N/A',
      title: 'Score',
      subtitle: gutScoreOutOfTen ? 'Latest scan' : 'No score',
      color: '#18181b',
      progress: gutScorePercent,
      action: 'Progress',
      detail: gutScoreOutOfTen ? `${gutScoreOutOfTen} out of 10` : 'Scan to unlock',
      interactive: false,
    },
  ];
  const navItems: Array<{ id: DashboardTab; label: string; icon: typeof Home }> = [
    { id: 'home', label: isRussian ? 'Главная' : 'Home', icon: Home },
    { id: 'progress', label: isRussian ? 'Паттерны' : 'Patterns', icon: BarChart3 },
    { id: 'profile', label: isRussian ? 'Профиль' : 'Profile', icon: User },
  ];
  const theme = {
    app: isDarkMode ? 'bg-[#050505] text-white' : 'bg-[#f8f8f8] text-zinc-950',
    card: isDarkMode ? 'bg-[#1b1b1d] text-white ring-white/[0.05]' : 'bg-white text-zinc-950 ring-zinc-950/[0.04]',
    soft: isDarkMode ? 'bg-white/[0.06] text-white ring-white/[0.05]' : 'bg-[#f2f1f8] text-zinc-950 ring-zinc-950/[0.04]',
    input: isDarkMode
      ? 'border-white/[0.12] bg-[#101012] text-white placeholder:text-white/30 focus:border-white/30 focus:ring-white/20'
      : 'border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-zinc-950/15',
    muted: isDarkMode ? 'text-white/[0.52]' : 'text-zinc-500',
    faint: isDarkMode ? 'text-white/[0.35]' : 'text-zinc-400',
    line: isDarkMode ? 'border-white/10' : 'border-zinc-200',
  };
  const copy = {
    aiResult: isRussian ? 'Результат AI' : 'AI result',
    verdict: isRussian ? 'Вердикт' : 'Verdict',
    score: isRussian ? 'балл' : 'score',
    noMajorFlags: isRussian ? 'Сильных сигналов нет' : 'No major flags',
    noMajorFlagsReason: isRussian
      ? 'SensiBite не нашел сильный сигнал в этом скане.'
      : 'SensiBite did not find a strong issue in this scan.',
    scanAgain: isRussian ? 'Сканировать еще' : 'Scan again',
    saveToTimeline: isRussian ? 'Сохранить' : 'Save to timeline',
    profileDetails: isRussian ? 'Профиль' : 'Profile details',
    name: isRussian ? 'Имя' : 'Name',
    username: isRussian ? 'Username' : 'Username',
    saveProfile: isRussian ? 'Сохранить профиль' : 'Save profile',
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
      ? 'Это удалит ваш аккаунт и выйдет из SensiBite на этом устройстве.'
      : 'This permanently deletes your account and signs you out of SensiBite on this device.',
    cancel: isRussian ? 'Отмена' : 'Cancel',
    deleteConfirm: isRussian ? 'Удалить навсегда' : 'Delete permanently',
    deleteError: isRussian ? 'Не удалось удалить аккаунт. Попробуйте позже.' : 'Unable to delete account. Please try again.',
  };
  const ratingLabel = (rating: ImageScanPayload['result']['overallRating']) => {
    if (!isRussian) return rating;
    if (rating === 'Safe') return 'Можно';
    if (rating === 'Avoid') return 'Избегать';
    return 'Осторожно';
  };
  const cardClass = cn('rounded-[30px] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.12)] ring-1 transition-colors duration-700', theme.card);
  const openProfileEditor = () => {
    setProfileDraftName(profileName);
    setProfileDraftUsername(profileUsername);
    setProfileSheetOpen(true);
  };
  const dashboardNoticeIsSuccess =
    dashboardError === 'Sync complete.' ||
    dashboardError.includes('updated') ||
    dashboardError.includes('changed') ||
    dashboardError.includes('enabled') ||
    dashboardError.includes('disabled') ||
    dashboardError.includes('copied') ||
    dashboardError.includes('downloaded') ||
    dashboardError.includes('created');
  const dashboardNoticeTitle = dashboardNoticeIsSuccess ? dashboardError.replace('.', '') : dashboardError === scanErrorMessage ? 'Scan issue' : 'Notice';

  const progressPage = (
    <div className="space-y-5">
      <h1 className="text-[44px] font-black leading-none">{isRussian ? 'Паттерны' : 'Patterns'}</h1>

      <div className={cn(cardClass, 'overflow-hidden')}>
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <p className={cn('text-xs font-black uppercase tracking-[0.16em]', theme.faint)}>
              {hasActivity ? (isRussian ? 'Последний результат' : 'Latest result') : (isRussian ? 'Пока пусто' : 'Nothing tracked yet')}
            </p>
            <h2 className="mt-3 text-3xl font-black leading-none">
              {hasActivity ? (latestTitle || (isRussian ? 'Скан сохранен' : 'Scan saved')) : (isRussian ? 'Сделайте первый скан' : 'Start with one scan')}
            </h2>
            <p className={cn('mt-3 text-sm font-semibold leading-6', theme.muted)}>
              {hasActivity
                ? latestReason || (isRussian ? 'Новые сканы будут сравниваться с этим результатом.' : 'Future scans will compare against this first food event.')
                : (isRussian ? 'После фото здесь появятся оценка, история и возможные повторяющиеся сигналы.' : 'After a photo, this page will show score, history, and possible repeat signals.')}
            </p>
          </div>
          <div className={cn('flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full ring-1', isDarkMode ? 'bg-white/[0.06] ring-white/10' : 'bg-zinc-50 ring-zinc-200')}>
            <span className="text-3xl font-black">{gutScoreOutOfTen ? `${gutScoreOutOfTen}` : 'N/A'}</span>
            <span className={cn('text-[10px] font-black uppercase tracking-[0.12em]', theme.faint)}>{isRussian ? 'балл' : 'score'}</span>
          </div>
        </div>

        <button
          className={cn('mt-6 h-14 w-full rounded-full text-base font-black transition active:scale-[0.98]', isDarkMode ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white')}
          onClick={openCamera}
          type="button"
        >
          {hasActivity ? (isRussian ? 'Сканировать еще' : 'Scan another meal') : (isRussian ? 'Сделать первый скан' : 'Scan first meal')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          [isRussian ? 'Сканы' : 'Scans', hasActivity ? String(scanCount) : 'N/A', isRussian ? 'сохранено' : 'saved', ScanLine],
          [isRussian ? 'Серия' : 'Streak', hasActivity ? '1' : 'N/A', isRussian ? 'день' : 'day', Flame],
          [isRussian ? 'Сигналы' : 'Signals', hasActivity ? 'Learning' : 'N/A', isRussian ? 'после сканов' : 'after scans', Activity],
          [isRussian ? 'Отчет' : 'Report', hasActivity ? 'Ready' : 'N/A', isRussian ? 'экспорт' : 'export', FileText],
        ].map(([label, value, helper, Icon]) => (
          <button
            className={cn(cardClass, 'min-h-[138px] text-left transition active:scale-[0.98]')}
            key={String(label)}
            onClick={label === 'Report' || label === 'Отчет' ? exportSummaryReport : openCamera}
            type="button"
          >
            <Icon className={cn('h-6 w-6', theme.muted)} />
            <p className="mt-5 text-3xl font-black">{value as string}</p>
            <p className={cn('mt-1 text-sm font-black', theme.muted)}>{label as string}</p>
            <p className={cn('mt-1 text-xs font-semibold', theme.faint)}>{helper as string}</p>
          </button>
        ))}
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black tracking-tight">{isRussian ? 'История еды' : 'Food history'}</h2>
          <span className={cn('rounded-full px-3 py-1.5 text-xs font-black', theme.soft)}>{hasActivity ? `${scanCount}` : 'N/A'}</span>
        </div>

        <div className="mt-5 space-y-3">
          {logs.length > 0 ? logs.slice(0, 5).map((item) => (
            <button
              className={cn('flex min-h-[64px] w-full items-center gap-4 rounded-[20px] px-4 text-left transition active:scale-[0.99]', theme.soft)}
              key={item.id}
              onClick={() => setResultSheetOpen(Boolean(scanResult))}
              type="button"
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', isDarkMode ? 'bg-white text-zinc-950' : 'bg-white text-zinc-950')}>
                <Camera className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">{item.title}</span>
                <span className={cn('mt-1 block text-xs font-semibold', theme.muted)}>{new Date(item.created_at).toLocaleDateString()}</span>
              </span>
              <ChevronRight className={cn('h-5 w-5', theme.muted)} />
            </button>
          )) : (
            <div className={cn('rounded-[24px] p-5 text-center', theme.soft)}>
              <ScanLine className={cn('mx-auto h-8 w-8', theme.muted)} />
              <p className="mt-3 text-base font-black">{isRussian ? 'Истории пока нет' : 'No history yet'}</p>
              <p className={cn('mt-2 text-sm font-semibold leading-6', theme.muted)}>
                {isRussian ? 'Первый AI-скан создаст вашу временную ленту.' : 'Your first AI scan creates the timeline.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const profileRows = [
    { label: 'Personal Details', icon: ClipboardList, action: openProfileEditor },
    { label: 'Preferences', icon: Target, action: () => setIsDarkMode((value) => !value) },
    { label: `Language: ${language}`, icon: Languages, action: toggleLanguage },
    { label: 'Manage Subscription', icon: ShieldCheck, action: () => navigate('/manage-subscription') },
  ];
  const trackingRows = [
    { label: 'Open camera scan', icon: Camera, action: openCamera },
    { label: 'Pattern timeline', icon: Activity, action: () => setActiveTab('progress') },
    { label: 'Current baseline', icon: Flag, action: () => setActiveTab('home') },
    { label: trackingReminderOn ? 'Tracking reminders: On' : 'Tracking reminders: Off', icon: Bell, action: toggleTrackingReminder },
    { label: 'Refresh history', icon: RefreshCcw, action: () => setDashboardError('Sync complete.') },
  ];
  const supportRows = [
    { label: 'Request a Feature', icon: Mail, action: () => navigate('/contact') },
    { label: 'Support Email', icon: Mail, action: () => navigate('/support') },
    { label: 'Export Summary Report', icon: FileText, action: exportSummaryReport },
    { label: 'Sync Data', icon: RefreshCcw, action: () => setDashboardError('Sync complete.') },
    { label: 'Terms and Conditions', icon: FileText, action: () => navigate('/terms') },
    { label: 'Privacy Policy', icon: ShieldCheck, action: () => navigate('/privacy') },
  ];
  const renderRow = ({ label, icon: Icon, action }: { label: string; icon: typeof Home; action: () => void }) => (
    <button className={cn('flex min-h-[66px] w-full items-center gap-4 border-b px-5 text-left last:border-b-0 transition active:scale-[0.99]', theme.line)} key={label} onClick={action} type="button">
      <Icon className="h-6 w-6 shrink-0" />
      <span className="min-w-0 flex-1 text-xl font-black">{label}</span>
      <ChevronRight className={cn('h-6 w-6 shrink-0', theme.muted)} />
    </button>
  );

  const profilePage = (
    <div className="space-y-7">
      <h1 className="text-[46px] font-black leading-none">Profile</h1>
      <button className={cn(cardClass, 'flex w-full items-center gap-5 text-left transition active:scale-[0.99]')} onClick={openProfileEditor} type="button">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-black text-white">
          <User className="h-9 w-9" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-black', theme.muted)}>Premium</p>
          <p className="truncate text-2xl font-black">{profileName}</p>
          <p className={cn('truncate text-lg font-bold', theme.muted)}>@{profileUsername}</p>
        </div>
        <ChevronRight className={cn('h-7 w-7', theme.muted)} />
      </button>

      <div>
        <p className={cn('mb-4 text-2xl font-black', theme.muted)}>Invite Friends</p>
        <button className={cn(cardClass, 'flex w-full items-center gap-4 text-left transition active:scale-[0.99]')} onClick={copyReferralCode} type="button">
          <UserPlus className="h-7 w-7" />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black">Refer a friend and earn $10</p>
            <p className={cn('mt-1 text-base font-bold leading-5', theme.muted)}>Earn $10 per friend that signs up with your promo code.</p>
          </div>
          <ChevronRight className={cn('h-7 w-7', theme.muted)} />
        </button>
      </div>

      <div>
        <p className={cn('mb-4 text-2xl font-black', theme.muted)}>Account</p>
        <div className={cn('overflow-hidden rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] ring-1 transition-colors duration-700', theme.card)}>
          {profileRows.map(renderRow)}
        </div>
      </div>

      <div>
        <p className={cn('mb-4 text-2xl font-black', theme.muted)}>Goals & Tracking</p>
        <div className={cn('overflow-hidden rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] ring-1 transition-colors duration-700', theme.card)}>
          {trackingRows.map(renderRow)}
        </div>
      </div>

      <div>
        <p className={cn('mb-4 text-2xl font-black', theme.muted)}>Widgets</p>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[
            [hasActivity ? '1' : 'N/A', 'Day streak', Flame],
            [hasActivity ? String(scanCount) : 'N/A', 'Food scans', Camera],
            [gutScoreOutOfTen ? `${gutScoreOutOfTen}` : 'N/A', 'Gut score', Activity],
          ].map(([value, label, Icon]) => (
            <button className={cn('h-36 min-w-[170px] rounded-[26px] p-4 text-left transition active:scale-[0.98]', theme.card)} key={String(label)} onClick={() => setActiveTab(label === 'Food scans' ? 'home' : 'progress')} type="button">
              <Icon className="h-8 w-8" />
              <p className="mt-4 text-3xl font-black">{value as string}</p>
              <p className={cn('text-sm font-bold', theme.muted)}>{label as string}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={cn('mb-4 text-2xl font-black', theme.muted)}>Support & Legal</p>
        <div className={cn('overflow-hidden rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] ring-1 transition-colors duration-700', theme.card)}>
          {supportRows.map(renderRow)}
        </div>
      </div>

      <div>
        <p className={cn('mb-4 text-2xl font-black', theme.muted)}>Follow Us</p>
        <div className={cn('overflow-hidden rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] ring-1 transition-colors duration-700', theme.card)}>
          {['Instagram', 'TikTok', 'X'].map((label) => (
            <button className={cn('flex min-h-[66px] w-full items-center gap-4 border-b px-5 text-left last:border-b-0 transition active:scale-[0.99]', theme.line)} key={label} onClick={() => openSocial(label)} type="button">
              <span className="flex h-7 w-7 items-center justify-center text-2xl font-black">{label[0]}</span>
              <span className="flex-1 text-xl font-black">{label}</span>
              <ChevronRight className={cn('h-6 w-6', theme.muted)} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={cn('mb-4 text-2xl font-black', theme.muted)}>Account Actions</p>
        <div className={cn('overflow-hidden rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] ring-1 transition-colors duration-700', theme.card)}>
          <button className={cn('flex min-h-[66px] w-full items-center gap-4 border-b px-5 text-left transition active:scale-[0.99]', theme.line)} onClick={signOut} type="button">
            <LogOut className="h-6 w-6" />
            <span className="flex-1 text-xl font-black">Logout</span>
            <ChevronRight className={cn('h-6 w-6', theme.muted)} />
          </button>
          <button className="flex min-h-[66px] w-full items-center gap-4 px-5 text-left text-red-400 transition active:scale-[0.99]" onClick={() => setDeleteSheetOpen(true)} type="button">
            <AlertCircle className="h-6 w-6" />
            <span className="flex-1 text-xl font-black">{copy.deleteAccount}</span>
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AppFrame darkMode={isDarkMode}>
      <div className={cn('relative flex h-full w-full flex-col overflow-hidden px-5 pb-0 pt-6 transition-colors duration-700 md:px-7', theme.app)}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-12%,rgba(255,255,255,0.08),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_34%)]" />
        <div className="relative z-10 flex items-center justify-between">
          {activeTab === 'home' ? <div className="h-11 w-11" /> : (
            <button className={cn('flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95', theme.soft)} onClick={() => setActiveTab('home')} type="button" aria-label="Back to home">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <button
            aria-label="Toggle dark mode"
            className={cn('flex h-11 w-11 items-center justify-center rounded-full shadow-sm ring-1 transition-all duration-700 active:scale-[0.96]', theme.card)}
            onClick={() => setIsDarkMode((value) => !value)}
            type="button"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        {activeTab === 'home' && (
          <div className="relative z-10 mt-6 grid grid-cols-7 gap-2">
            {dashboardDays.map((item, index) => (
              <button
                className={cn(
                  'relative flex h-[54px] flex-col items-center justify-center rounded-full border text-[12px] font-black leading-none transition-all duration-300 active:scale-[0.98]',
                  selectedDay === index
                    ? isDarkMode
                      ? 'border-white/20 bg-white/[0.12] text-white shadow-[0_10px_24px_rgba(0,0,0,0.3)]'
                      : 'border-zinc-950 bg-white text-zinc-950 shadow-[0_10px_24px_rgba(15,23,42,0.08)]'
                    : item.state === 'ahead'
                      ? cn('border-dashed bg-transparent', isDarkMode ? 'border-white/10 text-white/25' : 'border-zinc-200 text-zinc-300')
                      : cn(isDarkMode ? 'border-white/10 bg-white/[0.06] text-white/70' : 'border-zinc-200 bg-white/70 text-zinc-700'),
                )}
                key={`${item.day}-${item.date}`}
                onClick={() => {
                  setSelectedDay(index);
                  setActiveTab('home');
                }}
                type="button"
              >
                <span>{item.day}</span>
                <span className="mt-2 text-[11px] font-medium">{item.date}</span>
                {item.progress > 0 && (
                  <span
                    className={cn('absolute -bottom-1 h-3 w-3 rounded-full border-2', isDarkMode ? 'border-[#050505]' : 'border-[#f8f8f8]')}
                    style={{
                      background: `conic-gradient(#71717a ${item.progress}%, ${isDarkMode ? '#303033' : '#e5e7eb'} ${item.progress}% 100%)`,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto pb-32 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              <>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {topDashboardCards.map((card) => (
                    <button
                      className={cn(
                        'group flex min-h-[132px] flex-col justify-between rounded-[24px] p-3 text-left shadow-[0_16px_36px_rgba(0,0,0,0.10)] ring-1 transition-all duration-500 hover:-translate-y-0.5 active:scale-[0.98] sm:p-4',
                        theme.card,
                        card.interactive && (isDarkMode ? 'ring-white/20 hover:ring-white/[0.45]' : 'ring-zinc-200 hover:ring-zinc-400'),
                      )}
                      key={card.title}
                      onClick={() => {
                        if (card.action === 'Scan') openCamera();
                        if (card.action === 'Progress') setActiveTab('progress');
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[18px] font-black leading-none tracking-tight sm:text-[20px]">{card.value}</p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-zinc-400">{card.subtitle}</p>
                        </div>
                        {card.interactive && (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition group-hover:bg-zinc-950 group-hover:text-white">
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[12px] font-black leading-tight">{card.title}</p>
                          <p className={cn('mt-1 text-[10px] font-bold leading-tight', theme.muted)}>{card.detail}</p>
                        </div>
                        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1', isDarkMode ? 'bg-white/[0.08] ring-white/10' : 'bg-zinc-50 ring-zinc-200')}>
                          {card.interactive ? (
                            <BarChart3 className="h-4 w-4 text-zinc-700" />
                          ) : (
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  className={cn('mt-4 w-full rounded-[26px] p-4 text-left shadow-[0_16px_36px_rgba(0,0,0,0.10)] ring-1 transition-all duration-700 active:scale-[0.99]', theme.card)}
                  onClick={() => setActiveTab('progress')}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[14px] font-black">Gut Score</p>
                        <p className="text-[14px] font-black">{gutScoreOutOfTen ? `${gutScoreOutOfTen}/10` : 'N/A'}</p>
                      </div>
                      <div className={cn('mt-3 h-2 rounded-full', isDarkMode ? 'bg-white/[0.08]' : 'bg-zinc-100')}>
                        <div className="h-full rounded-full bg-zinc-950" style={{ width: `${gutScorePercent}%` }} />
                      </div>
                      <p className="mt-4 line-clamp-3 text-[12px] font-medium leading-[1.25] text-zinc-500">
                        {scanResult
                          ? `${scanResult.result.productName}: ${scanResult.result.flaggedChemicals[0]?.reason ?? 'SensiBite saved this result to your pattern memory.'}`
                          : 'No score yet. Scan one meal to create your first baseline.'}
                      </p>
                    </div>
                    <div className={cn('relative h-[70px] w-[70px] shrink-0 rounded-full', isDarkMode ? 'bg-white/[0.08]' : 'bg-zinc-100')}>
                      <div
                        className="absolute inset-1 rounded-full"
                        style={{ background: `conic-gradient(#18181b ${gutScorePercent}%, ${isDarkMode ? '#303033' : '#eef0f2'} ${gutScorePercent}% 100%)` }}
                      />
                      <div className={cn('absolute inset-[10px] flex items-center justify-center rounded-full text-sm font-black', isDarkMode ? 'bg-[#1b1b1d]' : 'bg-white')}>{gutScoreOutOfTen ?? 'N/A'}</div>
                    </div>
                  </div>
                </button>

                <div className="mt-5">
                  <p className="text-[20px] font-black tracking-tight">{isRussian ? 'Скан еды' : 'Food scan'}</p>
                  {scanState === 'scanning' && (
                    <div className="mt-4 rounded-[22px] bg-zinc-950 p-4 text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)]">
                      <div className="flex items-center gap-4">
                        <div className="relative h-14 w-14 overflow-hidden rounded-[18px] bg-white/10">
                          <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.25),transparent)] animate-pulse" />
                          <div className="absolute inset-3 rounded-full border-4 border-white/[0.15] border-t-zinc-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-black">Analyzing food...</p>
                          <div className="mt-3 space-y-2">
                            <div className="h-2 w-full rounded-full bg-white/[0.18]" />
                            <div className="h-2 w-2/3 rounded-full bg-white/[0.18]" />
                          </div>
                        </div>
                        <p className="text-[12px] font-black text-zinc-300">27%</p>
                      </div>
                      <p className="mt-4 text-[11px] font-semibold text-white/[0.55]">SensiBite is reading the image and preparing a result.</p>
                    </div>
                  )}
                  <button
                    className={cn('mt-4 w-full rounded-[26px] p-4 text-left shadow-[0_16px_36px_rgba(0,0,0,0.10)] ring-1 transition-all duration-700 active:scale-[0.99]', theme.soft)}
                    onClick={openCamera}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className={cn('flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_18px_rgba(15,23,42,0.07)]', isDarkMode ? 'bg-white text-zinc-950' : 'bg-white text-zinc-950')}>
                          <Camera className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-black">{scanResult?.result.productName ?? logs[0]?.title ?? (isRussian ? 'Добавьте первый прием еды' : 'Add your first meal')}</p>
                          <p className="mt-2 flex items-center gap-1 text-[15px] font-black">
                            <Activity className="h-4 w-4 fill-zinc-950" />
                            {scanResult ? `${scanResult.result.score}/100 score` : (isRussian ? 'Сканировать фото' : 'Scan a food photo')}
                          </p>
                          <div className={cn('mt-3 flex items-center gap-3 text-[10px] font-medium', theme.muted)}>
                            <span className="inline-flex items-center gap-1">
                              <ScanLine className="h-3 w-3" />
                              {scanState === 'scanning' ? (isRussian ? 'Сканируем' : 'Scanning') : hasActivity ? 'AI checked' : (isRussian ? 'Начать' : 'Ready to scan')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="shrink-0 text-[10px] font-bold text-zinc-500">{hasActivity ? (isRussian ? 'Сохранено' : 'Saved') : (isRussian ? 'Новое' : 'New')}</p>
                    </div>
                    <div className={cn('mt-4 rounded-[18px] p-3', isDarkMode ? 'bg-white/[0.06]' : 'bg-white/80')}>
                      <p className={cn('text-[12px] font-semibold leading-5', theme.muted)}>
                        {scanResult
                          ? 'This scan is now part of your trigger timeline.'
                          : 'Take a food photo and SensiBite will save the result here.'}
                      </p>
                    </div>
                  </button>
                </div>
              </>
              )}
              {activeTab === 'progress' && progressPage}
              {activeTab === 'profile' && profilePage}

              {dashboardError && (
                <div
                  className={cn(
                    'mt-4 flex items-start gap-3 rounded-[18px] border px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.08)]',
                    dashboardNoticeIsSuccess ? 'border-zinc-200 bg-white text-zinc-950' : 'border-red-100 bg-red-50',
                  )}
                  role="alert"
                >
                  <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white', dashboardNoticeIsSuccess ? 'text-zinc-950 ring-1 ring-zinc-200' : 'text-red-600')}>
                    {dashboardNoticeIsSuccess ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className={cn('text-sm font-black', dashboardNoticeIsSuccess ? 'text-zinc-950' : 'text-red-950')}>{dashboardNoticeTitle}</p>
                    <p className={cn('mt-0.5 text-xs font-semibold leading-5', dashboardNoticeIsSuccess ? 'text-zinc-500' : 'text-red-700')}>{dashboardError}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 px-5 pb-[max(18px,env(safe-area-inset-bottom))] md:px-8">
          <div className="mx-auto flex max-w-[520px] items-center gap-3">
            <div className={cn('grid h-[82px] flex-1 grid-cols-3 items-center rounded-full border px-3 shadow-[0_18px_44px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-colors duration-700', isDarkMode ? 'border-white/[0.12] bg-black/70' : 'border-zinc-200 bg-white/85')}>
              {navItems.map(({ id, label, icon: Icon }) => {
                const selected = activeTab === id;
                return (
                  <button
                    className={cn(
                      'flex h-[62px] min-w-0 flex-col items-center justify-center gap-1 rounded-full text-[11px] font-black transition-all duration-300 active:scale-[0.96]',
                      selected
                        ? isDarkMode
                          ? 'bg-white/10 text-white'
                          : 'bg-zinc-950 text-white'
                        : isDarkMode
                          ? 'text-white/[0.45] hover:text-white'
                          : 'text-zinc-500 hover:text-zinc-950',
                    )}
                    key={id}
                    onClick={() => setActiveTab(id)}
                    type="button"
                  >
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <button
              aria-label={copy.logFood}
              className={cn('flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-full shadow-[0_18px_44px_rgba(0,0,0,0.25)] ring-4 transition-all duration-300 active:scale-[0.94]', isDarkMode ? 'bg-white text-black ring-black' : 'bg-zinc-950 text-white ring-white')}
              onClick={openCamera}
              type="button"
            >
              <Plus className="h-9 w-9 stroke-[3]" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {profileSheetOpen && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-end bg-black/55 px-5 pb-[max(22px,env(safe-area-inset-bottom))]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setProfileSheetOpen(false)}
            >
              <motion.div
                animate={{ y: 0 }}
                className={cn('w-full rounded-[32px] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ring-1', theme.card)}
                exit={{ y: 24 }}
                initial={{ y: 24 }}
                onClick={(event) => event.stopPropagation()}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-2xl font-black">{copy.profileDetails}</p>
                <label className="mt-5 block">
                  <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{copy.name}</span>
                  <input
                    className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                    placeholder={copy.name}
                    onChange={(event) => setProfileDraftName(event.target.value)}
                    value={profileDraftName}
                  />
                </label>
                <label className="mt-4 block">
                  <span className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{copy.username}</span>
                  <input
                    className={cn('mt-2 h-14 w-full rounded-[18px] border px-4 text-base font-bold outline-none transition focus:ring-2', theme.input)}
                    placeholder="username"
                    onChange={(event) => setProfileDraftUsername(event.target.value)}
                    value={profileDraftUsername}
                  />
                </label>
                <button
                  className={cn('mt-5 h-14 w-full rounded-full text-base font-black transition active:scale-[0.98]', isDarkMode ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white')}
                  onClick={saveProfileDetails}
                  type="button"
                >
                  {copy.saveProfile}
                </button>
              </motion.div>
            </motion.div>
          )}

          {resultSheetOpen && scanResult && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-end bg-black/55 px-5 pb-[max(22px,env(safe-area-inset-bottom))]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setResultSheetOpen(false)}
            >
              <motion.div
                animate={{ y: 0 }}
                className={cn('max-h-[86vh] w-full overflow-y-auto rounded-[32px] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ring-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', theme.card)}
                exit={{ y: 24 }}
                initial={{ y: 24 }}
                onClick={(event) => event.stopPropagation()}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={cn('text-xs font-black uppercase tracking-[0.14em]', theme.faint)}>{copy.aiResult}</p>
                    <h2 className="mt-2 text-3xl font-black leading-none">{scanResult.result.productName}</h2>
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
                    className="mt-5 h-44 w-full rounded-[24px] object-cover"
                    src={scanPreviewUrl}
                  />
                )}

                <div className={cn('mt-5 grid grid-cols-[1fr_auto] items-center gap-4 rounded-[26px] p-5 ring-1', isDarkMode ? 'bg-[#101012] text-white ring-white/10' : 'bg-[#fbfaf7] text-zinc-950 ring-zinc-950/[0.04]')}>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{copy.verdict}</p>
                    <p className="mt-2 text-4xl font-black">{ratingLabel(scanResult.result.overallRating)}</p>
                  </div>
                  <div className={cn('flex h-24 w-24 flex-col items-center justify-center rounded-full shadow-inner ring-1', isDarkMode ? 'bg-white/[0.08] ring-white/10' : 'bg-white ring-zinc-200')}>
                    <p className="text-3xl font-black">{scanResult.result.score}</p>
                    <p className="text-[10px] font-black uppercase text-zinc-400">{copy.score}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {(scanResult.result.flaggedChemicals.length ? scanResult.result.flaggedChemicals : [
                    {
                      chemicalName: copy.noMajorFlags,
                      severity: scanResult.result.overallRating,
                      reason: copy.noMajorFlagsReason,
                    },
                  ]).slice(0, 3).map((item) => (
                    <div className={cn('rounded-[22px] p-4 ring-1', theme.soft)} key={`${item.chemicalName}-${item.reason}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base font-black">{item.chemicalName}</p>
                        <span className={cn('rounded-full px-3 py-1 text-[10px] font-black uppercase', isDarkMode ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white')}>{ratingLabel(item.severity)}</span>
                      </div>
                      <p className={cn('mt-2 text-sm font-semibold leading-6', theme.muted)}>{item.reason}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    className={cn('h-14 rounded-full text-sm font-black transition active:scale-[0.98]', theme.soft)}
                    onClick={openCamera}
                    type="button"
                  >
                    {copy.scanAgain}
                  </button>
                  <button
                    className={cn('h-14 rounded-full text-sm font-black transition active:scale-[0.98]', isDarkMode ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white')}
                    onClick={() => setResultSheetOpen(false)}
                    type="button"
                  >
                    {copy.saveToTimeline}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {deleteSheetOpen && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-end bg-black/60 px-5 pb-[max(22px,env(safe-area-inset-bottom))]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => !deleteLoading && setDeleteSheetOpen(false)}
            >
              <motion.div
                animate={{ y: 0 }}
                className={cn('w-full rounded-[32px] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ring-1', theme.card)}
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
                    {deleteLoading ? 'Deleting...' : copy.deleteConfirm}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            runImageScan(event.target.files?.[0]);
            event.currentTarget.value = '';
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>
    </AppFrame>
  );
}

function AppFrame({ children, darkMode = false }: { children: ReactNode; darkMode?: boolean }) {
  return (
    <main className={cn('min-h-dvh transition-colors duration-700', darkMode ? 'bg-[#050505] text-white' : 'bg-[#f6f6f4] text-zinc-950')}>
      <section className={cn('relative mx-auto h-dvh w-full max-w-[560px] overflow-hidden shadow-none transition-colors duration-700', darkMode ? 'bg-[#050505]' : 'bg-white')}>
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
        <div className="flex min-h-[520px] flex-col">
          <div className="pt-4">
            <h1 className="text-[38px] font-black leading-[0.96] text-zinc-950">{currentStep.title}</h1>
            <p className="mt-3 text-[15px] font-semibold leading-6 text-zinc-500">{currentStep.subtitle}</p>
          </div>

          <div className="mt-8 rounded-[34px] bg-white p-5 shadow-[0_22px_60px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/[0.05]">
            <div className="rounded-[26px] bg-[#f7f6f2] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Private memory</p>
              <h2 className="mt-3 text-[28px] font-black leading-[1.02] text-zinc-950">
                Build a profile that helps the scan understand you.
              </h2>
              <p className="mt-4 text-[14px] font-semibold leading-6 text-zinc-500">
                SensiBite uses your answers to read food photos with better context, then connects later check-ins back to the meals that came before.
              </p>
            </div>

            <div className="mt-4 grid gap-2.5">
              {introRows.map(([Icon, title, body]) => (
                <div className="flex items-center gap-3 rounded-[22px] bg-[#fbfaf7] p-3 ring-1 ring-zinc-950/[0.04]" key={String(title)}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-black text-zinc-950">{title}</span>
                    <span className="mt-0.5 block text-[12px] font-semibold leading-5 text-zinc-500">{body}</span>
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
              <div className="mt-7 rounded-[18px] bg-zinc-950 p-4 text-white">
                <p className="text-sm font-black">Your starting profile</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-white/70">
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
          {currentStep.subtitle && <p className="mt-4 text-base font-semibold leading-7 text-zinc-500">{currentStep.subtitle}</p>}
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
      <AppFrame>
        <div className="relative flex h-full flex-col overflow-hidden bg-[#fbfaf7] px-6 pb-8 pt-7 text-zinc-950">
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
                SensiBite
              </h1>
              <p className="mx-auto mt-4 text-base font-semibold leading-7 text-zinc-500">
                Save your profile, scan meals, and keep your private pattern timeline synced.
              </p>

              <div className="mt-7 grid gap-2 text-left">
                {['Private food memory', 'AI scan history', 'Pattern dashboard'].map((item) => (
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
    <AppFrame>
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
    </AppFrame>
  );
}
