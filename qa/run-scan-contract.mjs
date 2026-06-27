import fs from 'node:fs';

function readEnv() {
  if (!fs.existsSync('.env.local')) {
    throw new Error('.env.local is required for scan contract tests.');
  }

  const raw = fs.readFileSync('.env.local', 'utf8');
  return Object.fromEntries(
    raw
      .split(/\n/)
      .map((line) => line.match(/^\s*([^#=]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, '')]),
  );
}

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

function includesAny(value, terms = []) {
  const text = normalize(value);
  return terms.some((term) => text.includes(normalize(term)));
}

const casePath = process.argv[2] ?? 'qa/scan-qa-cases.json';
const suite = JSON.parse(fs.readFileSync(casePath, 'utf8'));
const env = readEnv();

if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
}

const url = `${env.VITE_SUPABASE_URL}/functions/v1/ai`;
const headers = {
  'content-type': 'application/json',
  apikey: env.VITE_SUPABASE_ANON_KEY,
  authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
  origin: 'http://localhost:5173',
};

let failed = 0;
const startedAt = Date.now();

for (const testCase of suite.cases) {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(testCase.body),
  });

  let json;
  try {
    json = await response.json();
  } catch {
    json = {};
  }

  const result = json.result ?? {};
  const expected = testCase.expected ?? {};
  const checks = {
    statusOk: response.ok,
    rating: expected.rating ? result.overallRating === expected.rating : true,
    score: typeof result.score === 'number' && result.score >= expected.scoreMin && result.score <= expected.scoreMax,
    name: expected.nameIncludes?.length ? includesAny(result.productName, expected.nameIncludes) : true,
    confidence: expected.confidenceSources?.length ? expected.confidenceSources.includes(result.confidence?.source) : Boolean(result.confidence?.source),
    basis: Boolean(result.basis?.portionBasis && result.basis?.decisionBasis),
  };

  const pass = Object.values(checks).every(Boolean);
  if (!pass) failed += 1;

  console.log(JSON.stringify({
    id: testCase.id,
    pass,
    checks,
    status: response.status,
    name: result.productName,
    rating: result.overallRating,
    score: result.score,
    confidence: result.confidence?.source,
    basis: result.basis?.portionBasis,
  }));
}

const summary = {
  suite: suite.version,
  total: suite.cases.length,
  failed,
  passed: suite.cases.length - failed,
  durationMs: Date.now() - startedAt,
};

console.log(JSON.stringify({ summary }));

if (failed > 0) {
  process.exitCode = 1;
}
