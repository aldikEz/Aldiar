import fs from 'node:fs';

function readEnv() {
  const raw = fs.readFileSync('.env.local', 'utf8');
  return Object.fromEntries(
    raw
      .split(/\n/)
      .map((line) => line.match(/^\s*([^#=]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, '')]),
  );
}

const env = readEnv();
const url = `${env.VITE_SUPABASE_URL}/functions/v1/ai`;
const headers = {
  'content-type': 'application/json',
  apikey: env.VITE_SUPABASE_ANON_KEY,
  authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
  origin: 'http://localhost:5173',
};

const cases = [
  { id: 'apple', body: { productKey: 'apple', labelText: 'apple', userLang: 'English', userTriggers: [] }, rating: 'Safe', min: 85, max: 100 },
  { id: 'borjomi', body: { productKey: 'Borjomi mineral water', labelText: 'Borjomi Georgian natural mineral water', userLang: 'English', userTriggers: [] }, rating: 'Safe', min: 80, max: 95 },
  { id: 'coca-cola', body: { productKey: 'Coca-Cola 330ml', labelText: 'Coca-Cola sugar carbonated soft drink', userLang: 'English', userTriggers: ['soda'] }, rating: 'Avoid', min: 0, max: 45 },
  { id: 'fuse-tea', body: { productKey: 'Fuse Tea', labelText: 'Fuse Tea sweetened iced tea sugar black tea extract citric acid', userLang: 'English', userTriggers: ['soda'] }, rating: 'Avoid', min: 0, max: 55 },
  { id: 'kinder-ru', body: { productKey: 'Kinder Молочный ломтик', labelText: 'Kinder Молочный ломтик сахар молоко шоколад', userLang: 'Russian', userTriggers: ['dairy'] }, rating: 'Avoid', min: 0, max: 50 },
];

let failed = false;

for (const testCase of cases) {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(testCase.body),
  });
  const json = await response.json();
  const result = json.result ?? {};
  const pass = Boolean(
    response.ok &&
    result.overallRating === testCase.rating &&
    typeof result.score === 'number' &&
    result.score >= testCase.min &&
    result.score <= testCase.max &&
    result.confidence?.source &&
    result.basis?.portionBasis &&
    result.basis?.decisionBasis,
  );

  if (!pass) failed = true;

  console.log(JSON.stringify({
    id: testCase.id,
    pass,
    status: response.status,
    name: result.productName,
    rating: result.overallRating,
    score: result.score,
    confidence: result.confidence?.source,
    basis: result.basis?.portionBasis,
  }));
}

if (failed) {
  process.exitCode = 1;
}
