import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const frontendRoots = ['src'];
const frontendFiles = ['index.html', 'package.json', 'vercel.json', '.env.example'];
const repoRoots = ['src', 'supabase', 'qa', 'scripts'];
const repoFiles = ['index.html', 'package.json', 'vercel.json', '.env.example', 'AGENTS.md', 'CODEX_SETUP.md', 'README.md'];
const envLocal = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';

function walk(dir, extensions = /\.(ts|tsx|js|jsx|css|html|json)$/) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return walk(fullPath, extensions);
    if (!extensions.test(entry)) return [];
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
  ...frontendRoots.flatMap((root) => walk(root)),
  ...frontendFiles.filter((file) => existsSync(file)),
];

const repoSourceFiles = [
  ...repoRoots.flatMap((root) => walk(root, /\.(ts|tsx|js|jsx|css|html|json|mjs|md|toml)$/)),
  ...repoFiles.filter((file) => existsSync(file)),
]
  .filter((file) => !file.includes('check-secret-exposure.mjs'))
  .filter((file, index, files) => files.indexOf(file) === index);

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

const repoTokenHits = repoSourceFiles.flatMap((file) => {
  const text = readText(file);
  return suspiciousTokenPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => ({ file, type: name }));
});

const frontendViteNames = Array.from(frontendSource.matchAll(/\bVITE_[A-Z0-9_]+\b/g), (match) => match[0]);
const allowedFrontendViteNames = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
const unexpectedFrontendViteNames = [...new Set(frontendViteNames.filter((name) => !allowedFrontendViteNames.has(name)))];

const checks = [
  {
    name: 'frontend source does not reference private VITE secret names',
    ok: exposedEnvNames.length === 0,
  },
  {
    name: 'frontend source only references approved public VITE names',
    ok: unexpectedFrontendViteNames.length === 0,
  },
  {
    name: 'frontend source does not contain token-shaped secrets',
    ok: frontendTokenHits.length === 0,
  },
  {
    name: 'repository source does not contain committed token-shaped secrets',
    ok: repoTokenHits.length === 0,
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
    unexpectedFrontendViteNames,
    frontendTokenHitTypes: frontendTokenHits,
    repoTokenHits,
    scannedFrontendFileCount: sourceFiles.length,
    scannedRepoFileCount: repoSourceFiles.length,
  },
  nextAction: failed.length
    ? 'Remove private keys from committed source and VITE-prefixed environment variables.'
    : 'No frontend secret exposure detected in source or local public env names.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
