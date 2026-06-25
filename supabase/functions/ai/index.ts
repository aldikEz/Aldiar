// DigestSnap AI helper function.
//
// Required secrets before deployment:
//   npm run ai:secret -- GEMINI_API_KEY=your_key
//   npm run ai:secret -- AI_ALLOWED_ORIGINS=https://your-domain.com,http://localhost:5173
//
// Optional:
//   npm run ai:secret -- GEMINI_MODEL=gemini-2.5-flash-lite
//   npm run ai:secret -- GEMINI_TIMEOUT_MS=18000
//
// The allowlist keeps this function from becoming a public AI proxy. If
// AI_ALLOWED_ORIGINS is missing, only localhost and 127.0.0.1 are allowed.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const MAX_PROMPT_LENGTH = 4000;
const MAX_SYSTEM_LENGTH = 1200;
const MAX_IMAGE_BASE64_LENGTH = 7_000_000;
const MAX_JSON_BODY_BYTES = 7_600_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const IMAGE_RATE_LIMIT_MAX_REQUESTS = 8;
const CHAT_MAX_LENGTH = 500;
const GEMINI_TIMEOUT_MS = getBoundedEnvNumber('GEMINI_TIMEOUT_MS', 18_000, 8_000, 25_000);
const SCAN_CACHE_VERSION = 'label-v5-image-first-visual-estimate-20260625';
const CACHE_READ_TIMEOUT_MS = 900;
const CACHE_WRITE_TIMEOUT_MS = 1_200;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BLOCKED_PATTERNS = [
  /\b(kill|suicide|self[-\s]?harm|cut myself|end my life)\b/i,
  /\b(steroid|anabolic|tren|dianabol|illegal drug|cocaine|meth)\b/i,
  /\b(dehydrate|water cut|starve|purge|laxative|vomit to lose)\b/i,
  /\b(hate|slur|nazi|terrorist|bomb|weapon|harass|doxx)\b/i,
  /\b(cheat on|fake a test|forge|steal|hack)\b/i,
];

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RequestBody = {
  prompt?: unknown;
  system?: unknown;
  mode?: unknown;
  imageBase64?: unknown;
  labelText?: unknown;
  dishName?: unknown;
  productKey?: unknown;
  userTriggers?: unknown;
  userLang?: unknown;
  mimeType?: unknown;
};

type Rating = 'Safe' | 'Caution' | 'Avoid';

type ChemicalReport = {
  chemicalName: string;
  severity: Rating;
  reason: string;
};

type ScanPayload = {
  result: {
    productName: string;
    overallRating: Rating;
    score: number;
    flaggedChemicals: ChemicalReport[];
  };
};

type ImagePayload = {
  data: string;
  mimeType: string;
  triggers: string[];
};

type FoodTextPayload = {
  inputType: 'label' | 'dish';
  text: string;
  productKey: string;
  triggers: string[];
};

type GeminiTextPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiTextPart[];
    };
  }>;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

const MAX_FOOD_TEXT_LENGTH = 1800;
const MAX_PRODUCT_KEY_LENGTH = 160;
const MAX_TRIGGER_COUNT = 12;
const MAX_TRIGGER_LENGTH = 40;

type FoodRiskRule = {
  id: string;
  patterns: RegExp[];
  rating: Rating;
  maxScore: number;
  concern: {
    en: string;
    ru: string;
  };
  reason: {
    en: string;
    ru: string;
  };
};

const STRICT_FOOD_RISK_RULES: FoodRiskRule[] = [
  {
    id: 'sugary-drink',
    patterns: [
      /\bfuse\s*tea\b/i,
      /\biced?\s*tea\b/i,
      /\bsweet(?:ened)?\s*tea\b/i,
      /\bsoda\b/i,
      /\bcola\b/i,
      /\bfanta\b/i,
      /\bsprite\b/i,
      /\bpepsi\b/i,
      /\bcoca[-\s]?cola\b/i,
      /\bsoft\s*drink\b/i,
      /\bcarbonated\b/i,
      /\bsweetened\s*juice\b/i,
    ],
    rating: 'Avoid',
    maxScore: 38,
    concern: { en: 'Sugary drink', ru: 'Сладкий напиток' },
    reason: { en: 'High sugar and acidity signal.', ru: 'Сигнал сахара и кислотности.' },
  },
  {
    id: 'energy-drink',
    patterns: [/\benergy\s*drink\b/i, /\bred\s*bull\b/i, /\bmonster\b/i, /\badrenaline\b/i, /\btaurine\b/i],
    rating: 'Avoid',
    maxScore: 35,
    concern: { en: 'Energy drink', ru: 'Энергетик' },
    reason: { en: 'Caffeine and acidity often irritate.', ru: 'Кофеин и кислоты часто раздражают.' },
  },
  {
    id: 'candy-dessert',
    patterns: [/\bcandy\b/i, /\bsweets?\b/i, /\bchocolate\s*bar\b/i, /\bgummy\b/i, /\bcaramel\b/i, /\btoffee\b/i, /\blollipop\b/i],
    rating: 'Avoid',
    maxScore: 42,
    concern: { en: 'Candy or sweets', ru: 'Конфеты или сладости' },
    reason: { en: 'Mostly sugar with low satiety.', ru: 'В основном сахар, мало сытости.' },
  },
  {
    id: 'fried-snack',
    patterns: [/\bchips?\b/i, /\bcrisps?\b/i, /\bcheetos\b/i, /\bdoritos\b/i, /\bpringles\b/i, /\bcrackers?\b/i, /\bdeep[-\s]?fried\b/i, /\bfried\b/i, /\bfries\b/i, /\bfrench\s*fries\b/i, /\bfried\s*chicken\b/i, /\bnuggets?\b/i, /\bcrispy\s*chicken\b/i],
    rating: 'Avoid',
    maxScore: 42,
    concern: { en: 'Fried snack', ru: 'Жареный снек' },
    reason: { en: 'Fat, salt, and additives stack.', ru: 'Жир, соль и добавки вместе.' },
  },
  {
    id: 'instant-noodles',
    patterns: [/\binstant\s*noodles?\b/i, /\bramen\b/i, /\bnoodle\s*soup\b/i, /\bseasoning\s*packet\b/i],
    rating: 'Avoid',
    maxScore: 40,
    concern: { en: 'Instant noodles', ru: 'Лапша быстрого приготовления' },
    reason: { en: 'Usually sodium-heavy and additive-heavy.', ru: 'Обычно много соли и добавок.' },
  },
  {
    id: 'processed-meat',
    patterns: [/\bsausage\b/i, /\bsalami\b/i, /\bhot\s*dog\b/i, /\bbologna\b/i, /\bham\b/i, /\bpepperoni\b/i, /\bprocessed\s*meat\b/i, /\bnitrite\b/i, /\bnitrate\b/i],
    rating: 'Caution',
    maxScore: 50,
    concern: { en: 'Processed meat', ru: 'Переработанное мясо' },
    reason: { en: 'Salt and preservatives are common.', ru: 'Часто есть соль и консерванты.' },
  },
  {
    id: 'bakery-pastry',
    patterns: [/\bdonut\b/i, /\bdoughnut\b/i, /\bcroissant\b/i, /\bpastry\b/i, /\bcake\b/i, /\bcookie\b/i, /\bmuffin\b/i, /\bwafer\b/i],
    rating: 'Caution',
    maxScore: 48,
    concern: { en: 'Sweet pastry', ru: 'Сладкая выпечка' },
    reason: { en: 'Sugar, flour, and fat combine.', ru: 'Сахар, мука и жир вместе.' },
  },
  {
    id: 'sugary-cereal',
    patterns: [/\bcereal\b/i, /\bcorn\s*flakes\b/i, /\bchoco\b/i, /\bfrosted\b/i, /\bgranola\b/i, /\bmuesli\b/i],
    rating: 'Caution',
    maxScore: 52,
    concern: { en: 'Sweet cereal', ru: 'Сладкий завтрак' },
    reason: { en: 'Often marketed healthy despite sugar.', ru: 'Часто выглядит полезнее, чем есть.' },
  },
  {
    id: 'heavy-sauce',
    patterns: [/\bmayonnaise\b/i, /\bketchup\b/i, /\bsauce\b/i, /\bdressing\b/i, /\bglucose[-\s]?fructose\b/i, /\bcorn\s*syrup\b/i],
    rating: 'Caution',
    maxScore: 55,
    concern: { en: 'Sauce additives', ru: 'Добавки в соусе' },
    reason: { en: 'Hidden sugar, oils, or acids.', ru: 'Скрытый сахар, масла или кислоты.' },
  },
  {
    id: 'ultra-processed',
    patterns: [/\bultra[-\s]?processed\b/i, /\bflavourings?\b/i, /\bartificial\b/i, /\bpreservatives?\b/i, /\bemulsifiers?\b/i, /\bstabilizers?\b/i, /\bcolour(?:ing)?s?\b/i],
    rating: 'Caution',
    maxScore: 58,
    concern: { en: 'Ultra-processed signals', ru: 'Сигналы ультра-обработки' },
    reason: { en: 'Multiple additives reduce confidence.', ru: 'Много добавок снижает доверие.' },
  },
  {
    id: 'fast-food-meal',
    patterns: [/\bburger\b/i, /\bcheeseburger\b/i, /\bfast\s*food\b/i, /\bshawarma\b/i, /\bkebab\b/i, /\bfried\s*meal\b/i, /\btakeout\b/i, /\btakeaway\b/i],
    rating: 'Avoid',
    maxScore: 44,
    concern: { en: 'Fast-food profile', ru: 'Профиль фастфуда' },
    reason: { en: 'Fat, sodium, and sauces stack.', ru: 'Жир, соль и соусы вместе.' },
  },
];

declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

function runAfterResponse(promise: Promise<unknown>) {
  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
    EdgeRuntime.waitUntil(promise);
    return;
  }

  promise.catch((error) => console.error('Background task failed.', error));
}

function getBoundedEnvNumber(name: string, fallback: number, min: number, max: number) {
  const rawValue = Deno.env.get(name);
  const numberValue = rawValue ? Number(rawValue) : fallback;

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function getAllowedOrigins() {
  return (Deno.env.get('AI_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLocalOrigin(origin: string) {
  return /^http:\/\/localhost(?::\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin);
}

function isOriginAllowed(origin: string | null) {
  if (!origin) {
    return false;
  }

  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.length === 0) {
    return isLocalOrigin(origin);
  }

  return allowedOrigins.includes(origin);
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  const allowedOrigin = isOriginAllowed(origin) ? origin : 'null';

  return {
    'Access-Control-Allow-Origin': allowedOrigin ?? 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: getCorsHeaders(req),
  });
}

function isRequestBodyTooLarge(req: Request) {
  const contentLength = req.headers.get('content-length');

  if (!contentLength) {
    return false;
  }

  const bytes = Number(contentLength);

  return Number.isFinite(bytes) && bytes > MAX_JSON_BODY_BYTES;
}

function getClientKey(req: Request, scope: string) {
  const origin = req.headers.get('origin') ?? 'unknown-origin';
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown-ip';
  return `${scope}:${origin}:${forwardedFor}`;
}

function isRateLimited(req: Request, scope: string, maxRequests: number) {
  const now = Date.now();
  const key = getClientKey(req, scope);
  const bucket = rateLimitBuckets.get(key);

  for (const [bucketKey, value] of rateLimitBuckets.entries()) {
    if (value.resetAt <= now) {
      rateLimitBuckets.delete(bucketKey);
    }
  }

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  bucket.count += 1;
  return bucket.count > maxRequests;
}

function getSafetyBlockReason(text: string, mode: string) {
  if (mode === 'chat' && text.length > CHAT_MAX_LENGTH + 2500) {
    return 'Chat request is too long.';
  }

  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'DigestSnap AI cannot help with harmful, illegal, hateful, or unsafe requests.';
  }

  return '';
}

async function readJsonBody(req: Request): Promise<RequestBody | null> {
  try {
    const value: unknown = await req.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLanguage(value: unknown) {
  if (typeof value !== 'string') {
    return 'English';
  }

  const cleaned = value.trim();

  if (/^(ru|rus|russian|русский)$/i.test(cleaned)) {
    return 'Russian';
  }

  if (/^(en|eng|english)$/i.test(cleaned)) {
    return 'English';
  }

  return /^[\p{L}\s-]{2,40}$/u.test(cleaned) ? cleaned : 'English';
}

function parseImagePayload(body: RequestBody): { payload?: ImagePayload; error?: string } {
  if (typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) {
    return { error: 'Image data is required.' };
  }

  const rawImage = body.imageBase64.trim();
  const dataUrlMatch = rawImage.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is);
  const requestedMimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
  const mimeType = (dataUrlMatch?.[1] ?? (requestedMimeType || 'image/jpeg')).toLowerCase();
  const base64 = (dataUrlMatch?.[2] ?? rawImage).replace(/\s/g, '');

  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    return { error: 'Only JPEG, PNG, and WebP images are supported.' };
  }

  if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
    return { error: 'Image is too large. Please upload a smaller or more compressed image.' };
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    return { error: 'Image data must be valid base64.' };
  }

  return { payload: { data: base64, mimeType, triggers: parseUserTriggers(body.userTriggers) } };
}

function parseUserTriggers(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, MAX_TRIGGER_COUNT)
        .map((value) => value.slice(0, MAX_TRIGGER_LENGTH))
    : [];
}

function parseFoodTextPayload(body: RequestBody): { payload?: FoodTextPayload; error?: string } {
  const rawLabelText = typeof body.labelText === 'string' ? body.labelText.trim() : '';
  const rawDishName = typeof body.dishName === 'string' ? body.dishName.trim() : '';
  const inputType = rawLabelText ? 'label' : 'dish';
  const text = (rawLabelText || rawDishName).replace(/\s+/g, ' ').slice(0, MAX_FOOD_TEXT_LENGTH);

  if (!text) {
    return { error: 'Label text or dish name is required.' };
  }

  const rawProductKey = typeof body.productKey === 'string' ? body.productKey.trim() : text;
  const productKey = rawProductKey.replace(/\s+/g, ' ').slice(0, MAX_PRODUCT_KEY_LENGTH);
  const triggers = parseUserTriggers(body.userTriggers);

  return {
    payload: {
      inputType,
      text,
      productKey,
      triggers,
    },
  };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makeGeminiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY ?? '',
  )}`;
}

async function callGemini(body: unknown) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(makeGeminiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Gemini request failed.', response.status, errorText.slice(0, 500));
      return { error: 'AI request failed.', status: 502 };
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';

    if (!text) {
      return { error: 'AI returned an empty response.', status: 502 };
    }

    return { text };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return { error: isTimeout ? 'AI request timed out.' : 'AI request failed.', status: isTimeout ? 504 : 502 };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleTextRequest(req: Request, body: RequestBody) {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const system = typeof body.system === 'string' ? body.system.trim() : '';
  const mode = body.mode === 'chat' ? 'chat' : 'plan';

  if (!prompt) {
    return jsonResponse(req, { error: 'Prompt is required.' }, 400);
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return jsonResponse(req, { error: 'Prompt is too long.' }, 400);
  }

  if (system.length > MAX_SYSTEM_LENGTH) {
    return jsonResponse(req, { error: 'System message is too long.' }, 400);
  }

  const safetyBlockReason = getSafetyBlockReason(prompt, mode);

  if (safetyBlockReason) {
    return jsonResponse(req, { error: safetyBlockReason, blocked: true }, 400);
  }

  const geminiResult = await callGemini({
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: [{ parts: [{ text: prompt }] }],
  });

  if ('error' in geminiResult) {
    return jsonResponse(req, { error: geminiResult.error }, geminiResult.status);
  }

  return jsonResponse(req, { text: geminiResult.text });
}

function makeLabelPrompt(targetLang: string, triggers: string[] = []) {
  const triggerLine = triggers.length > 0 ? triggers.join(', ') : 'none provided';

  return `You are DigestSnap's strict food vision scanner.

First identify what is in the image visually. Then read/OCR every visible label word you can.
If the label text is blurry, blocked, tiny, or unreadable, do NOT return "Unreadable Label", "Image unclear", or "Could not verify image" unless the image contains no recognizable food/product at all.
Instead, use visual food/product recognition from the image itself: packaging shape, brand colors, visible food, drink type, category, container, serving style, restaurant/takeout cues, and common similar products. Return a cautious visual estimate with a productName like "Likely iced tea drink", "Likely fried snack", "Likely chocolate bar", "Likely burger meal", "Likely fried chicken plate", "Likely soda bottle", or "Likely packaged sauce".

Analyze visible text, branding, nutrition facts, ingredients, and visual product category. Extract the product name when readable; otherwise extract the best visual classification. Then rate possible gut-trigger quality for a normal consumer and for the user's trigger profile.
User possible triggers and profile context: ${triggerLine}

Rules:
- Return JSON only.
- Use ${targetLang} for human-facing strings: productName, chemicalName, and reason.
- Keep enum values exactly as English strings: "Safe", "Caution", or "Avoid".
- Do not invent ingredients that are not visible, but use strong product-category inference when ingredients are hidden.
- If OCR is unreadable but the food/product category is visually recognizable, return the likely category and mark concerns as "visual estimate", "label not verified", or "category-based risk".
- If both label text and visual category are impossible to identify, return productName as "Visual estimate unavailable" and overallRating as "Caution".
- Never leave productName generic if any food/drink/package category is visible.
- For flaggedChemicals, return 2 to 4 ingredients/additives/category concerns.
- If a visible or strongly inferable ingredient overlaps with user possible triggers, prioritize it as a concern.
- Sugary tea, iced tea, soda, cola, energy drink, sweetened juice, and carbonated soft drinks are never "Safe"; they are at least "Caution".
- If visible sugar is high, or the product is a sweetened beverage, score must be 0-45.
- Major "Avoid" categories: sugary soda/iced tea, energy drinks, candy, fried chips/crisps, instant noodles, deep-fried snacks.
- Major visible "Avoid" foods even without OCR: burger meals, fries, fried chicken, deep-fried snacks, soda/iced tea bottles, candy bars, chips/crisps.
- Major "Caution" categories: processed meats, sweet pastries, sugary cereals/granola, heavy sauces, additive-heavy ultra-processed foods.
- If the product is soda/energy drink/sweetened tea with sugar, caffeine, acid, sweeteners, or preservatives, use "Avoid".
- Only use "Safe" above 75 when the label clearly shows a simple, low-trigger product with no meaningful additives/sugar concerns.
- Use "Avoid" for obvious strong trigger products: sugary soda/energy drinks, very high sugar, fried snacks, or user-trigger overlap.
- For unclear images, do not pretend certainty. Use "likely", "visual estimate", or "label not verified" in reasons.
- Keep each reason under 12 words.
- This is consumer information, not medical advice.

Return this exact shape:
{
  "result": {
    "productName": "Name or classification",
    "overallRating": "Caution",
    "score": 45,
    "flaggedChemicals": [
      {
        "chemicalName": "Visible or inferred concern",
        "severity": "Caution",
        "reason": "Brief factual reason."
      }
    ]
  }
}`;
}

function makeFoodTextPrompt(payload: FoodTextPayload, targetLang: string) {
  const triggerLine = payload.triggers.length > 0 ? payload.triggers.join(', ') : 'none provided';

  return `You are DigestSnap AI. Return one minified JSON object only. Do not include markdown, prose, code fences, or commentary.

Task: rate likely food-trigger risk from ${payload.inputType === 'label' ? 'ingredient label text' : 'a restaurant dish name'}.
Input: ${payload.text}
User triggers: ${triggerLine}

Rules:
- Use ${targetLang} for productName, chemicalName, and reason.
- Keep enum values exactly: "Safe", "Caution", "Avoid".
- "Safe" means low likely trigger risk, "Caution" means medium, "Avoid" means high.
- Sugary tea, iced tea, soda, cola, energy drink, sweetened juice, and carbonated soft drinks are never "Safe"; score them 0-55 unless clearly unsweetened.
- Major "Avoid" categories: sugary soda/iced tea, energy drinks, candy, fried chips/crisps, instant noodles, deep-fried snacks.
- Major "Caution" categories: processed meats, sweet pastries, sugary cereals/granola, heavy sauces, additive-heavy ultra-processed foods.
- For soda/energy drink/sweetened tea, flag sugar/caffeine/acidity/sweeteners/preservatives when relevant.
- Do not diagnose, guarantee safety, or give medical advice.
- Return 2 to 4 flaggedChemicals.
- Each reason must be under 12 words.
- Prefer common trigger groups: dairy, wheat/flour, fried food, soda, caffeine, onion, garlic, spicy food.

Required JSON shape:
{"result":{"productName":"Food name","overallRating":"Caution","score":45,"flaggedChemicals":[{"chemicalName":"Trigger","severity":"Caution","reason":"Short reason."},{"chemicalName":"Trigger","severity":"Caution","reason":"Short reason."}]}}`;
}

async function handleFoodTextScanRequest(req: Request, body: RequestBody) {
  const foodText = parseFoodTextPayload(body);

  if (foodText.error || !foodText.payload) {
    return jsonResponse(req, { error: foodText.error ?? 'Invalid food text.' }, 400);
  }

  const targetLang = normalizeLanguage(body.userLang);
  const cacheHash = await sha256Hex(
    `${SCAN_CACHE_VERSION}:food-text:${targetLang}:${foodText.payload.inputType}:${foodText.payload.productKey}:${foodText.payload.text}:${foodText.payload.triggers.join('|')}`,
  );
  const cachedScan = await readCachedScan(cacheHash, targetLang);

  if (cachedScan) {
    return jsonResponse(req, cachedScan);
  }

  const geminiResult = await callGemini({
    contents: [{ parts: [{ text: makeFoodTextPrompt(foodText.payload, targetLang) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 360,
    },
  });

  if ('error' in geminiResult) {
    return jsonResponse(req, fallbackFoodTextPayload(foodText.payload, targetLang), 200);
  }

  const parsed = parseModelJson(geminiResult.text);
  const foodFallback = fallbackFoodTextPayload(foodText.payload, targetLang);
  const scan = normalizeScanPayload(parsed, targetLang, foodFallback);
  const finalScan = isUnreadableProductName(scan.result.productName) ? foodFallback : scan;

  runAfterResponse(cacheScan(cacheHash, targetLang, finalScan));

  return jsonResponse(req, finalScan);
}

async function handleImageRequest(req: Request, body: RequestBody) {
  const image = parseImagePayload(body);

  if (image.error || !image.payload) {
    return jsonResponse(req, { error: image.error ?? 'Invalid image.' }, 400);
  }

  const targetLang = normalizeLanguage(body.userLang);
  const imageHash = await sha256Hex(`${image.payload.mimeType}:${image.payload.data}`);
  const profileHash = image.payload.triggers.join('|');
  const cacheKey = await sha256Hex(`${SCAN_CACHE_VERSION}:image:${imageHash}:${targetLang}:${profileHash || 'no-profile'}`);
  const cachedScan = await readCachedScan(cacheKey, targetLang);

  if (cachedScan) {
    return jsonResponse(req, cachedScan);
  }

  const geminiResult = await callGemini({
    contents: [
      {
        parts: [
          { text: makeLabelPrompt(targetLang, image.payload.triggers) },
          {
            inlineData: {
              mimeType: image.payload.mimeType,
              data: image.payload.data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 360,
    },
  });

  if ('error' in geminiResult) {
    return jsonResponse(req, { error: geminiResult.error }, geminiResult.status);
  }

  const parsed = parseModelJson(geminiResult.text);
  const scan = normalizeScanPayload(parsed, targetLang);

  runAfterResponse(cacheScan(cacheKey, targetLang, scan));

  return jsonResponse(req, scan);
}

function parseModelJson(text: string): unknown {
  const withoutFence = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function asRating(value: unknown, fallback: Rating): Rating {
  return value === 'Safe' || value === 'Caution' || value === 'Avoid' ? value : fallback;
}

function asBoundedString(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function asScore(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function normalizeChemical(value: unknown): ChemicalReport | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    chemicalName: asBoundedString(value.chemicalName, 'Unspecified ingredient', 90),
    severity: asRating(value.severity, 'Caution'),
    reason: asBoundedString(value.reason, 'Needs a clearer label photo for a reliable review.', 180),
  };
}

function normalizeScanPayload(value: unknown, targetLang: string, fallback: ScanPayload = fallbackScanPayload(targetLang)): ScanPayload {
  if (!isRecord(value) || !isRecord(value.result)) {
    return fallback;
  }

  const flaggedChemicals = Array.isArray(value.result.flaggedChemicals)
    ? value.result.flaggedChemicals.map(normalizeChemical).filter((item): item is ChemicalReport => item !== null).slice(0, 12)
    : [];

  return enforceFoodRiskRules({
    result: {
      productName: asBoundedString(value.result.productName, targetLang === 'Russian' ? 'Визуальная оценка продукта' : 'Visual product estimate', 120),
      overallRating: asRating(value.result.overallRating, flaggedChemicals.length > 0 ? 'Caution' : 'Safe'),
      score: asScore(value.result.score),
      flaggedChemicals,
    },
  }, targetLang);
}

function getScanText(scan: ScanPayload) {
  return [
    scan.result.productName,
    scan.result.overallRating,
    ...scan.result.flaggedChemicals.flatMap((item) => [item.chemicalName, item.reason, item.severity]),
  ]
    .join(' ')
    .toLowerCase();
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function makeConcern(chemicalName: string, reason: string, severity: Rating): ChemicalReport {
  return {
    chemicalName,
    reason,
    severity,
  };
}

function dedupeConcerns(items: ChemicalReport[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.chemicalName.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function enforceFoodRiskRules(scan: ScanPayload, targetLang: string): ScanPayload {
  const text = getScanText(scan);
  const concerns = [...scan.result.flaggedChemicals];
  let rating = scan.result.overallRating;
  let score = scan.result.score;
  const matchedStrictRules = STRICT_FOOD_RISK_RULES.filter((rule) => hasAny(text, rule.patterns));

  for (const rule of matchedStrictRules) {
    if (rule.rating === 'Avoid') {
      rating = 'Avoid';
    } else if (rating === 'Safe') {
      rating = 'Caution';
    }

    score = Math.min(score, rule.maxScore);
    concerns.unshift(
      makeConcern(
        targetLang === 'Russian' ? rule.concern.ru : rule.concern.en,
        targetLang === 'Russian' ? rule.reason.ru : rule.reason.en,
        rule.rating,
      ),
    );
  }

  const isSweetDrink = hasAny(text, [
    /\bfuse\s*tea\b/i,
    /\biced?\s*tea\b/i,
    /\bsweet(?:ened)?\s*tea\b/i,
    /\bsoda\b/i,
    /\bcola\b/i,
    /\bfanta\b/i,
    /\bsprite\b/i,
    /\bpepsi\b/i,
    /\bcoca[-\s]?cola\b/i,
    /\benergy\s*drink\b/i,
    /\bsoft\s*drink\b/i,
    /\bcarbonated\b/i,
  ]);
  const hasSugarSignal = hasAny(text, [
    /\bsugar\b/i,
    /\bglucose\b/i,
    /\bfructose\b/i,
    /\bsyrup\b/i,
    /\bsucrose\b/i,
    /\b\d{1,2}\s*g\s*(?:sugar|sugars)\b/i,
  ]);
  const hasCaffeineSignal = hasAny(text, [/\bcaffeine\b/i, /\btea\s*extract\b/i, /\bblack\s*tea\b/i, /\bgreen\s*tea\b/i]);
  const hasAcidSignal = hasAny(text, [/\bcitric\s*acid\b/i, /\bphosphoric\s*acid\b/i, /\bacidity\s*regulator\b/i, /\bacid\b/i]);

  if (isSweetDrink) {
    rating = 'Avoid';
    score = Math.min(score, hasSugarSignal ? 38 : 50);
    concerns.unshift(
      makeConcern(
        targetLang === 'Russian' ? 'Сладкий напиток' : 'Sweetened drink',
        targetLang === 'Russian' ? 'Частый триггер сахара и кислотности.' : 'Common sugar and acidity trigger.',
        'Avoid',
      ),
    );
  }

  if (hasSugarSignal) {
    score = Math.min(score, 55);
    if (rating === 'Safe') rating = 'Caution';
    concerns.unshift(
      makeConcern(
        targetLang === 'Russian' ? 'Сахар' : 'Sugar',
        targetLang === 'Russian' ? 'Может усиливать вздутие у некоторых.' : 'Can worsen bloating for some.',
        isSweetDrink ? 'Avoid' : 'Caution',
      ),
    );
  }

  if (hasCaffeineSignal) {
    concerns.push(
      makeConcern(
        targetLang === 'Russian' ? 'Кофеин или чайный экстракт' : 'Caffeine or tea extract',
        targetLang === 'Russian' ? 'Может раздражать чувствительный желудок.' : 'May irritate sensitive stomachs.',
        'Caution',
      ),
    );
  }

  if (hasAcidSignal) {
    concerns.push(
      makeConcern(
        targetLang === 'Russian' ? 'Кислотность' : 'Acidity',
        targetLang === 'Russian' ? 'Кислоты могут усиливать дискомфорт.' : 'Acids may worsen discomfort.',
        'Caution',
      ),
    );
  }

  if (score >= 75 && rating === 'Safe' && concerns.length > 0) {
    const concernText = concerns.map((item) => `${item.chemicalName} ${item.reason}`).join(' ').toLowerCase();
    if (hasAny(concernText, [/\bsugar\b/i, /\bcaffeine\b/i, /\bacid\b/i, /\bsweet/i, /\bpreservative/i])) {
      rating = 'Caution';
      score = Math.min(score, 60);
    }
  }

  return {
    result: {
      ...scan.result,
      overallRating: rating,
      score,
      flaggedChemicals: dedupeConcerns(concerns).slice(0, 4),
    },
  };
}

function fallbackScanPayload(targetLang: string): ScanPayload {
  if (targetLang === 'Russian') {
    return {
      result: {
        productName: 'Визуальная оценка продукта',
        overallRating: 'Caution',
        score: 50,
        flaggedChemicals: [
          {
            chemicalName: 'Оценка по фото',
            severity: 'Caution',
            reason: 'Состав не подтвержден, оценка осторожная.',
          },
        ],
      },
    };
  }

  return {
    result: {
      productName: 'Visual product estimate',
      overallRating: 'Caution',
      score: 50,
      flaggedChemicals: [
        {
          chemicalName: 'Image-based estimate',
          severity: 'Caution',
          reason: 'Label not verified, rating stays cautious.',
        },
      ],
    },
  };
}

function fallbackFoodTextPayload(payload: FoodTextPayload, targetLang: string): ScanPayload {
  const productName = payload.productKey || payload.text;
  const normalizedInput = `${payload.text} ${payload.productKey}`.toLowerCase();
  const triggerSynonyms: Record<string, string[]> = {
    'fried food': ['fried', 'fries', 'burger', 'nugget', 'crispy', 'deep fried'],
    soda: ['soda', 'cola', 'sprite', 'fanta', 'carbonated', 'soft drink'],
    dairy: ['milk', 'cream', 'cheese', 'yogurt', 'butter', 'dairy'],
    bread: ['bread', 'bun', 'toast', 'flour', 'wheat', 'wrap'],
    gluten: ['bread', 'bun', 'toast', 'flour', 'wheat', 'pasta'],
    caffeine: ['coffee', 'espresso', 'energy drink', 'caffeine'],
    'spicy food': ['spicy', 'chili', 'hot sauce', 'jalapeno'],
    onion: ['onion'],
    garlic: ['garlic'],
  };
  const matchedTriggers = payload.triggers.filter((trigger) => {
    const normalizedTrigger = trigger.toLowerCase();
    const synonyms = triggerSynonyms[normalizedTrigger] ?? [normalizedTrigger];
    return synonyms.some((synonym) => normalizedInput.includes(synonym));
  });
  const firstRawTrigger = matchedTriggers[0] ?? payload.triggers[0] ?? '';
  const firstTrigger = localizeTriggerName(firstRawTrigger, targetLang) || (targetLang === 'Russian' ? 'Возможный триггер' : 'Possible trigger');
  const secondTrigger =
    targetLang === 'Russian'
      ? payload.inputType === 'dish'
        ? 'Типичный способ приготовления'
        : 'Проверка состава'
      : payload.inputType === 'dish'
        ? 'Common preparation'
        : 'Label review';
  const hasStrongMatch = matchedTriggers.length > 0;
  const fallbackStrictRules = STRICT_FOOD_RISK_RULES.filter((rule) => hasAny(normalizedInput, rule.patterns));
  const strictAvoid = fallbackStrictRules.some((rule) => rule.rating === 'Avoid');
  const strictMaxScore = fallbackStrictRules.length > 0 ? Math.min(...fallbackStrictRules.map((rule) => rule.maxScore)) : 55;
  const likelyFriedOrSoda = /\b(fried|fries|burger|nugget|crispy|soda|cola|fanta|sprite|soft drink|iced tea|ice tea|sweetened tea|fuse tea|energy drink|carbonated)\b/i.test(normalizedInput);
  const likelySugarDrink = /\b(sugar|glucose|fructose|syrup|sweetened|iced tea|ice tea|fuse tea|soda|cola|soft drink|energy drink)\b/i.test(normalizedInput);
  const rating: Rating = strictAvoid || (hasStrongMatch && likelyFriedOrSoda) ? 'Avoid' : hasStrongMatch || fallbackStrictRules.length > 0 ? 'Caution' : 'Caution';
  const score = Math.min(rating === 'Avoid' ? 38 : likelySugarDrink ? 45 : hasStrongMatch ? 58 : 55, strictMaxScore);
  const firstReason =
    targetLang === 'Russian'
      ? hasStrongMatch
        ? 'Совпадает с вашим сохраненным триггером.'
        : 'Проверьте состав или уточните у ресторана.'
      : hasStrongMatch
        ? 'Matches a saved possible trigger.'
        : 'Check ingredients or ask the restaurant.';
  const secondReason =
    targetLang === 'Russian'
      ? rating === 'Avoid'
        ? 'Похожий профиль часто вызывает реакцию.'
        : 'Быстрая оценка без гарантии безопасности.'
      : rating === 'Avoid'
        ? 'Similar profile often causes reactions.'
        : 'Quick estimate, not a safety guarantee.';

  if (targetLang === 'Russian') {
    return enforceFoodRiskRules({
      result: {
        productName,
        overallRating: rating,
        score,
        flaggedChemicals: [
          {
            chemicalName: firstTrigger,
            severity: rating,
            reason: firstReason,
          },
          {
            chemicalName: secondTrigger,
            severity: rating === 'Avoid' ? 'Caution' : rating,
            reason: secondReason,
          },
        ],
      },
    }, targetLang);
  }

  return enforceFoodRiskRules({
    result: {
      productName,
      overallRating: rating,
      score,
      flaggedChemicals: [
        {
          chemicalName: firstTrigger,
          severity: rating,
          reason: firstReason,
        },
        {
          chemicalName: secondTrigger,
          severity: rating === 'Avoid' ? 'Caution' : rating,
          reason: secondReason,
        },
      ],
    },
  }, targetLang);
}

function localizeTriggerName(value: string, targetLang: string) {
  if (targetLang !== 'Russian') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  const translations: Record<string, string> = {
    dairy: 'Молочные продукты',
    bread: 'Хлеб',
    gluten: 'Глютен',
    soda: 'Газировка',
    caffeine: 'Кофеин',
    'fried food': 'Жареная еда',
    'late meals': 'Поздняя еда',
    'spicy food': 'Острая еда',
    onion: 'Лук',
    garlic: 'Чеснок',
  };

  return translations[normalized] ?? value;
}

function getRestUrl(path: string) {
  if (!SUPABASE_URL) {
    return '';
  }

  return `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`;
}

function getServiceHeaders(extraHeaders: Record<string, string> = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

async function readCachedScan(imageHash: string, targetLang: string): Promise<ScanPayload | null> {
  const headers = getServiceHeaders();
  const url = getRestUrl(
    `cached_labels?image_hash=eq.${encodeURIComponent(imageHash)}&target_language=eq.${encodeURIComponent(targetLang)}&select=scan_result&limit=1`,
  );

  if (!headers || !url) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(url, { headers }, CACHE_READ_TIMEOUT_MS);

    if (!response.ok) {
      return null;
    }

    const rows: unknown = await response.json();

    if (!Array.isArray(rows) || !isRecord(rows[0])) {
      return null;
    }

    return normalizeScanPayload(rows[0].scan_result, targetLang);
  } catch {
    return null;
  }
}

function isUnreadableProductName(productName: string) {
  const normalizedName = productName.toLowerCase();
  return normalizedName.includes('unreadable') || normalizedName.includes('нечита');
}

async function cacheScan(imageHash: string, targetLang: string, scan: ScanPayload) {
  const headers = getServiceHeaders({
    Prefer: 'resolution=merge-duplicates',
  });
  const url = getRestUrl('cached_labels?on_conflict=image_hash,target_language');

  if (!headers || !url || isUnreadableProductName(scan.result.productName)) {
    return;
  }

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image_hash: imageHash,
          target_language: targetLang,
          product_name: scan.result.productName,
          scan_result: scan,
          updated_at: new Date().toISOString(),
        }),
      },
      CACHE_WRITE_TIMEOUT_MS,
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('DigestSnap cache write failed.', response.status, errorText.slice(0, 300));
    }
  } catch (error) {
    console.error('DigestSnap cache write failed.', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: getCorsHeaders(req),
    });
  }

  if (!isOriginAllowed(req.headers.get('origin'))) {
    return jsonResponse(req, { error: 'Origin is not allowed.' }, 403);
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Use POST.' }, 405);
  }

  if (!req.headers.get('content-type')?.includes('application/json')) {
    return jsonResponse(req, { error: 'Use application/json.' }, 415);
  }

  if (isRequestBodyTooLarge(req)) {
    return jsonResponse(req, { error: 'Upload is too large. Please use a smaller or compressed image.' }, 413);
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse(req, { error: 'AI is not configured.' }, 503);
  }

  const body = await readJsonBody(req);

  if (!body) {
    return jsonResponse(req, { error: 'Invalid JSON body.' }, 400);
  }

  const isImageRequest = typeof body.imageBase64 === 'string' && body.imageBase64.trim().length > 0;
  const isFoodTextRequest =
    typeof body.labelText === 'string' && body.labelText.trim().length > 0
      ? true
      : typeof body.dishName === 'string' && body.dishName.trim().length > 0;
  const scope = isImageRequest ? 'image' : isFoodTextRequest ? 'food-text' : 'text';
  const maxRequests = isImageRequest ? IMAGE_RATE_LIMIT_MAX_REQUESTS : RATE_LIMIT_MAX_REQUESTS;

  if (isRateLimited(req, scope, maxRequests)) {
    return jsonResponse(req, { error: 'Too many requests. Try again soon.' }, 429);
  }

  if (isImageRequest) {
    return await handleImageRequest(req, body);
  }

  if (isFoodTextRequest) {
    return await handleFoodTextScanRequest(req, body);
  }

  return await handleTextRequest(req, body);
});
