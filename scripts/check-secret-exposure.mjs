import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const frontendRoots = ['src'];
const frontendFiles = ['index.html', 'package.json', 'vercel.json', '.env.example'];
const envLocal = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return walk(fullPath);
    if (!/\.(ts|tsx|js|jsx|css|html|json)$/.test(entry)) return [];
    return [fullPath];
  });
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

const sourceFiles = [
  ...frontendRoots.flatMap(walk),
  ...frontendFiles.filter((file) => existsSync(file)),
];

const frontendSource = sourceFiles.map((file) => readText(file)).join('\n');

const forbiddenFrontendEnvNames = [
  'VITE_GEMINI_API_KEY',
  'VITE_GOOGLE_API_KEY',
  'VITE_OPENAI_API_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_ACCESS_TOKEN',
];

const suspiciousTokenPatterns = [
  { name: 'Supabase personal access token', pattern: /\bsbp_[a-zA-Z0-9]{20,}\b/ },
  { name: 'OpenAI style API key', pattern: /\bsk-[a-zA-Z0-9_-]{20,}\b/ },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/ },
  { name: 'JWT literal', pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/ },
];

const exposedEnvNames = forbiddenFrontendEnvNames.filter((name) => frontendSource.includes(name) || new RegExp(`^${name}=`, 'm').test(envLocal));
const frontendTokenHits = suspiciousTokenPatterns
  .filter(({ pattern }) => pattern.test(frontendSource))
  .map(({ name }) => name);

const checks = [
  {
    name: 'frontend source does not reference private VITE secret names',
    ok: exposedEnvNames.length === 0,
  },
  {
    name: 'frontend source does not contain token-shaped secrets',
    ok: frontendTokenHits.length === 0,
  },
  {
    name: 'local Gemini key is not VITE-prefixed',
    ok: !/^VITE_GEMINI_API_KEY=/m.test(envLocal) && !/^VITE_GOOGLE_API_KEY=/m.test(envLocal),
  },
  {
    name: 'local service role is not VITE-prefixed',
    ok: !/^VITE_SUPABASE_SERVICE_ROLE_KEY=/m.test(envLocal),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  findings: {
    exposedEnvNames,
    frontendTokenHitTypes: frontendTokenHits,
    scannedFrontendFileCount: sourceFiles.length,
  },
  nextAction: failed.length
    ? 'Remove private keys from frontend source and VITE-prefixed environment variables.'
    : 'No frontend secret exposure detected in source or local public env names.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
