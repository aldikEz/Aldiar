import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
  });
}

const functionSource = readText('supabase/functions/ai/index.ts');
const envLocal = readText('.env.local');

const modelMatch = functionSource.match(/const GEMINI_MODEL = Deno\.env\.get\('GEMINI_MODEL'\) \?\? '([^']+)'/);
const fallbackMatch = functionSource.match(/const GEMINI_FALLBACK_MODELS = parseModelList\(Deno\.env\.get\('GEMINI_FALLBACK_MODELS'\) \?\? '([^']+)'\)/);
const timeoutMatch = functionSource.match(/const GEMINI_TIMEOUT_MS = getBoundedEnvNumber\('GEMINI_TIMEOUT_MS', ([\d_]+), ([\d_]+), ([\d_]+)\)/);

const frontendLeakChecks = [
  { name: 'VITE_GEMINI_API_KEY', present: /^VITE_GEMINI_API_KEY=/m.test(envLocal) },
  { name: 'VITE_GOOGLE_API_KEY', present: /^VITE_GOOGLE_API_KEY=/m.test(envLocal) },
  { name: 'VITE_SUPABASE_SERVICE_ROLE_KEY', present: /^VITE_SUPABASE_SERVICE_ROLE_KEY=/m.test(envLocal) },
];

const report = {
  sourceConfig: {
    hasGeminiKeyRead: /Deno\.env\.get\('GEMINI_API_KEY'\)/.test(functionSource),
    defaultModel: modelMatch?.[1] ?? null,
    fallbackModels: fallbackMatch?.[1]?.split(',').map((item) => item.trim()).filter(Boolean) ?? [],
    timeoutMs: timeoutMatch
      ? {
          default: Number(timeoutMatch[1].replaceAll('_', '')),
          min: Number(timeoutMatch[2].replaceAll('_', '')),
          max: Number(timeoutMatch[3].replaceAll('_', '')),
        }
      : null,
    hasAllowedOrigins: /DIGESTSNAP_ALLOWED_ORIGINS/.test(functionSource),
  },
  frontendSecretExposure: frontendLeakChecks,
  remoteSecrets: {
    checked: false,
    status: 'skipped_missing_SUPABASE_ACCESS_TOKEN',
    requiredNames: ['GEMINI_API_KEY'],
    optionalNames: ['GEMINI_MODEL', 'GEMINI_FALLBACK_MODELS', 'GEMINI_TIMEOUT_MS', 'DIGESTSNAP_ALLOWED_ORIGINS'],
    presentRequired: [],
    presentOptional: [],
  },
};

if (process.env.SUPABASE_ACCESS_TOKEN) {
  const secrets = run('npx', ['supabase', 'secrets', 'list']);
  const output = `${secrets.stdout}\n${secrets.stderr}`;
  report.remoteSecrets.checked = true;
  report.remoteSecrets.status = secrets.status === 0 ? 'ok' : 'failed';
  report.remoteSecrets.presentRequired = report.remoteSecrets.requiredNames.filter((name) => output.includes(name));
  report.remoteSecrets.presentOptional = report.remoteSecrets.optionalNames.filter((name) => output.includes(name));
  if (secrets.status !== 0) {
    report.remoteSecrets.error = output.replace(process.env.SUPABASE_ACCESS_TOKEN, '<redacted>').trim();
  }
}

const missingSourceConfig = [
  report.sourceConfig.hasGeminiKeyRead ? null : 'GEMINI_API_KEY read missing',
  report.sourceConfig.defaultModel ? null : 'GEMINI_MODEL default missing',
  report.sourceConfig.fallbackModels.length > 0 ? null : 'fallback models missing',
  report.sourceConfig.timeoutMs ? null : 'timeout config missing',
  report.sourceConfig.hasAllowedOrigins ? null : 'allowed origins config missing',
].filter(Boolean);

const exposedFrontendSecrets = frontendLeakChecks.filter((item) => item.present).map((item) => item.name);
const missingRemoteSecrets = process.env.SUPABASE_ACCESS_TOKEN
  ? report.remoteSecrets.requiredNames.filter((name) => !report.remoteSecrets.presentRequired.includes(name))
  : [];

report.ok = missingSourceConfig.length === 0 && exposedFrontendSecrets.length === 0 && missingRemoteSecrets.length === 0;
report.nextAction = missingSourceConfig.length > 0
  ? `Fix AI source config: ${missingSourceConfig.join(', ')}.`
  : exposedFrontendSecrets.length > 0
    ? `Remove frontend-exposed secrets: ${exposedFrontendSecrets.join(', ')}.`
    : !process.env.SUPABASE_ACCESS_TOKEN
      ? 'Set SUPABASE_ACCESS_TOKEN to verify remote Gemini secrets.'
      : missingRemoteSecrets.length > 0
        ? `Set missing remote secrets: ${missingRemoteSecrets.join(', ')}.`
        : 'Gemini config is wired and required remote secrets are present.';

console.log(JSON.stringify(report, null, 2));

if (!report.ok && process.env.SUPABASE_ACCESS_TOKEN) {
  process.exitCode = 1;
}
