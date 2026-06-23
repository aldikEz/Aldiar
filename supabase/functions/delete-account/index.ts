const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.length === 0 ? isLocalOrigin(origin) : allowedOrigins.includes(origin);
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': isOriginAllowed(origin) ? origin ?? 'null' : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json(req, { ok: true });
  }

  if (!isOriginAllowed(req.headers.get('origin'))) {
    return json(req, { error: 'Origin is not allowed.' }, 403);
  }

  if (req.method !== 'POST') {
    return json(req, { error: 'Use POST.' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(req, { error: 'Account deletion is not configured.' }, 503);
  }

  const userJwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!userJwt) {
    return json(req, { error: 'Authentication is required.' }, 401);
  }

  const baseUrl = SUPABASE_URL.replace(/\/$/, '');
  const userResponse = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${userJwt}`,
    },
  });

  if (!userResponse.ok) {
    return json(req, { error: 'Invalid session.' }, 401);
  }

  const user = await userResponse.json().catch(() => null);
  const userId = typeof user?.id === 'string' ? user.id : '';
  if (!userId) {
    return json(req, { error: 'Invalid user.' }, 401);
  }

  const deleteResponse = await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!deleteResponse.ok) {
    return json(req, { error: 'Could not delete account.' }, 502);
  }

  return json(req, { ok: true });
});
