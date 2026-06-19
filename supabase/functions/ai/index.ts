// Pace AI helper function.
//
// Required secrets before deployment:
//   npm run ai:secret -- GEMINI_API_KEY=your_key
//   npm run ai:secret -- AI_ALLOWED_ORIGINS=https://your-domain.com,http://localhost:5173
//
// The allowlist keeps this function from becoming a public AI proxy. If
// AI_ALLOWED_ORIGINS is missing, only localhost and 127.0.0.1 are allowed.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODEL = 'gemini-2.0-flash';
const MAX_PROMPT_LENGTH = 4000;
const MAX_SYSTEM_LENGTH = 1200;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const CHAT_MAX_LENGTH = 500;
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

const rateLimitBuckets = new Map<string, RateLimitBucket>();

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

function getClientKey(req: Request) {
  const origin = req.headers.get('origin') ?? 'unknown-origin';
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown-ip';
  return `${origin}:${forwardedFor}`;
}

function isRateLimited(req: Request) {
  const now = Date.now();
  const key = getClientKey(req);
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
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function getSafetyBlockReason(text: string, mode: string) {
  if (mode === 'chat' && text.length > CHAT_MAX_LENGTH + 2500) {
    return 'Chat request is too long.';
  }

  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'Pace cannot help with harmful, illegal, hateful, or unsafe requests.';
  }

  return '';
}

async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
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

  if (isRateLimited(req)) {
    return jsonResponse(req, { error: 'Too many requests. Try again soon.' }, 429);
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse(req, { error: 'AI is not configured.' }, 503);
  }

  const body = await readJsonBody(req);
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const system = typeof body?.system === 'string' ? body.system.trim() : '';
  const mode = body?.mode === 'chat' ? 'chat' : 'plan';

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!response.ok) {
      return jsonResponse(req, { error: 'AI request failed.' }, 502);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return jsonResponse(req, { text });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return jsonResponse(req, { error: isTimeout ? 'AI request timed out.' : 'AI request failed.' }, isTimeout ? 504 : 502);
  } finally {
    clearTimeout(timeoutId);
  }
});
