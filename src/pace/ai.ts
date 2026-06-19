import { buildAiPrompt, buildChatPrompt, makeFallbackAiPlan, normalizeAiText, normalizeChatText } from './planning';
import type { AiChatResult, AiPlanResult, FoodEntry, PlanItem, Profile } from './types';

const AI_SYSTEM =
  'You are Pace AI, a calm and detailed planning assistant for training, food, school, recovery, and coach check-ins. Make plans feel specific to one person. Return JSON only. No medical advice, no unsafe weight-cutting, no body judgment, no shaming language.';

type GenerateWeekInput = {
  profile: Profile | null;
  foodEntries: FoodEntry[];
};

type AskPaceInput = {
  profile: Profile | null;
  plan: PlanItem[];
  question: string;
};

export async function generateWeekWithAi(input: GenerateWeekInput): Promise<AiPlanResult> {
  const fallback = makeFallbackAiPlan(input.profile, input.foodEntries);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !anonKey) {
    return fallback;
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/ai`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system: AI_SYSTEM,
        mode: 'plan',
        prompt: buildAiPrompt(input.profile, input.foodEntries),
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const data = (await response.json()) as { text?: unknown };
    return typeof data.text === 'string' && data.text.trim() ? normalizeAiText(data.text, fallback) : fallback;
  } catch {
    return fallback;
  }
}

export async function askPaceWithAi(input: AskPaceInput): Promise<AiChatResult> {
  const fallbackReply =
    'Keep the tweak small: change one training block, one food habit, or one school block first. Pace can update the plan after that.';
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !anonKey) {
    return { source: 'fallback', reply: fallbackReply };
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/ai`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system: AI_SYSTEM,
        mode: 'chat',
        prompt: buildChatPrompt(input.profile, input.plan, input.question),
      }),
    });

    if (!response.ok) {
      return { source: 'fallback', reply: fallbackReply };
    }

    const data = (await response.json()) as { text?: unknown };
    return typeof data.text === 'string' && data.text.trim() ? normalizeChatText(data.text, fallbackReply) : { source: 'fallback', reply: fallbackReply };
  } catch {
    return { source: 'fallback', reply: fallbackReply };
  }
}
