// SensiBite AI helper function.
//
// Required secrets before deployment:
//   npm run ai:secret -- GEMINI_API_KEY=your_key
//   npm run ai:secret -- AI_ALLOWED_ORIGINS=https://your-domain.com,http://localhost:5173
//
// Optional:
//   npm run ai:secret -- GEMINI_MODEL=gemini-2.5-flash-lite
//   npm run ai:secret -- GEMINI_TIMEOUT_MS=10000
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
const GEMINI_TIMEOUT_MS = getBoundedEnvNumber('GEMINI_TIMEOUT_MS', 10_000, 5_000, 15_000);
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
    return 'SensiBite AI cannot help with harmful, illegal, hateful, or unsafe requests.';
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

  return { payload: { data: base64, mimeType } };
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
  const triggers = Array.isArray(body.userTriggers)
    ? body.userTriggers
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, MAX_TRIGGER_COUNT)
        .map((value) => value.slice(0, MAX_TRIGGER_LENGTH))
    : [];

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

function makeLabelPrompt(targetLang: string) {
  return `You are a careful product-label analysis engine.

Analyze only the product label visible in the image. Extract the product name or best product classification, then evaluate ingredient safety for a general consumer.

Rules:
- Return JSON only.
- Use ${targetLang} for human-facing strings: productName, chemicalName, and reason.
- Keep enum values exactly as English strings: "Safe", "Caution", or "Avoid".
- Do not invent ingredients that are not visible or strongly inferable from the label.
- If the image is unreadable, return productName as "Unreadable Label" and overallRating as "Caution".
- For flaggedChemicals, return exactly 2 ingredients/additives or label concerns.
- If a concern is regulatory, state the jurisdiction briefly and factually.
- Keep each reason under 12 words.
- This is consumer information, not medical advice.

Return this exact shape:
{
  "result": {
    "productName": "Name or classification",
    "overallRating": "Safe",
    "score": 85,
    "flaggedChemicals": [
      {
        "chemicalName": "Ingredient name",
        "severity": "Caution",
        "reason": "Brief factual reason."
      }
    ]
  }
}`;
}

function makeFoodTextPrompt(payload: FoodTextPayload, targetLang: string) {
  const triggerLine = payload.triggers.length > 0 ? payload.triggers.join(', ') : 'none provided';

  return `You are SensiBite AI. Return one minified JSON object only. Do not include markdown, prose, code fences, or commentary.

Task: rate likely food-trigger risk from ${payload.inputType === 'label' ? 'ingredient label text' : 'a restaurant dish name'}.
Input: ${payload.text}
User triggers: ${triggerLine}

Rules:
- Use ${targetLang} for productName, chemicalName, and reason.
- Keep enum values exactly: "Safe", "Caution", "Avoid".
- "Safe" means low likely trigger risk, "Caution" means medium, "Avoid" means high.
- Do not diagnose, guarantee safety, or give medical advice.
- Return exactly 2 flaggedChemicals.
- Each reason must be under 12 words.
- Prefer common trigger groups: dairy, wheat/flour, fried food, soda, caffeine, onion, garlic, spicy food.

Required JSON shape:
{"result":{"productName":"Food name","overallRating":"Caution","score":60,"flaggedChemicals":[{"chemicalName":"Trigger","severity":"Caution","reason":"Short reason."},{"chemicalName":"Trigger","severity":"Caution","reason":"Short reason."}]}}`;
}

async function handleFoodTextScanRequest(req: Request, body: RequestBody) {
  const foodText = parseFoodTextPayload(body);

  if (foodText.error || !foodText.payload) {
    return jsonResponse(req, { error: foodText.error ?? 'Invalid food text.' }, 400);
  }

  const targetLang = normalizeLanguage(body.userLang);
  const cacheHash = await sha256Hex(
    `food-text:${targetLang}:${foodText.payload.inputType}:${foodText.payload.productKey}:${foodText.payload.text}:${foodText.payload.triggers.join('|')}`,
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
  const cachedScan = await readCachedScan(imageHash, targetLang);

  if (cachedScan) {
    return jsonResponse(req, cachedScan);
  }

  const geminiResult = await callGemini({
    contents: [
      {
        parts: [
          { text: makeLabelPrompt(targetLang) },
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
    return jsonResponse(req, fallbackScanPayload(targetLang), 200);
  }

  const parsed = parseModelJson(geminiResult.text);
  const scan = normalizeScanPayload(parsed, targetLang);

  runAfterResponse(cacheScan(imageHash, targetLang, scan));

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

  return {
    result: {
      productName: asBoundedString(value.result.productName, targetLang === 'Russian' ? 'Нечитаемая этикетка' : 'Unreadable Label', 120),
      overallRating: asRating(value.result.overallRating, flaggedChemicals.length > 0 ? 'Caution' : 'Safe'),
      score: asScore(value.result.score),
      flaggedChemicals,
    },
  };
}

function fallbackScanPayload(targetLang: string): ScanPayload {
  if (targetLang === 'Russian') {
    return {
      result: {
        productName: 'Нечитаемая этикетка',
        overallRating: 'Caution',
        score: 50,
        flaggedChemicals: [
          {
            chemicalName: 'Размытый текст',
            severity: 'Caution',
            reason: 'Сделайте фото при хорошем освещении и держите упаковку ровно.',
          },
        ],
      },
    };
  }

  return {
    result: {
      productName: 'Unreadable Label',
      overallRating: 'Caution',
      score: 50,
      flaggedChemicals: [
        {
          chemicalName: 'Blurry label text',
          severity: 'Caution',
          reason: 'Use brighter light and hold the package flat.',
        },
      ],
    },
  };
}

function fallbackFoodTextPayload(payload: FoodTextPayload, targetLang: string): ScanPayload {
  const productName = payload.productKey || payload.text;
  const firstTrigger = localizeTriggerName(payload.triggers[0] ?? '', targetLang) || (targetLang === 'Russian' ? 'Возможный триггер' : 'Possible trigger');
  const secondTrigger =
    targetLang === 'Russian'
      ? payload.inputType === 'dish'
        ? 'Типичный способ приготовления'
        : 'Проверка состава'
      : payload.inputType === 'dish'
        ? 'Common preparation'
        : 'Label review';

  if (targetLang === 'Russian') {
    return {
      result: {
        productName,
        overallRating: 'Caution',
        score: 55,
        flaggedChemicals: [
          {
            chemicalName: firstTrigger,
            severity: 'Caution',
            reason: 'Проверьте состав или уточните у ресторана.',
          },
          {
            chemicalName: secondTrigger,
            severity: 'Caution',
            reason: 'Быстрая оценка без гарантии безопасности.',
          },
        ],
      },
    };
  }

  return {
    result: {
      productName,
      overallRating: 'Caution',
      score: 55,
      flaggedChemicals: [
        {
          chemicalName: firstTrigger,
          severity: 'Caution',
          reason: 'Check ingredients or ask the restaurant.',
        },
        {
          chemicalName: secondTrigger,
          severity: 'Caution',
          reason: 'Quick estimate, not a safety guarantee.',
        },
      ],
    },
  };
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
      console.error('SensiBite cache write failed.', response.status, errorText.slice(0, 300));
    }
  } catch (error) {
    console.error('SensiBite cache write failed.', error);
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
