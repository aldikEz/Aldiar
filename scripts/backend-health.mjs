import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const checks = [
  { name: 'functions-audit', command: 'npm', args: ['run', 'backend:functions'] },
  { name: 'ai-config', command: 'npm', args: ['run', 'backend:ai-config'] },
  { name: 'frontend-target', command: 'npm', args: ['run', 'backend:frontend-target'] },
  { name: 'edge-typecheck', command: 'deno', args: ['check', 'supabase/functions/ai/index.ts'] },
];

function hasLocalSupabaseEnv() {
  if (!existsSync('.env.local')) return false;
  const env = readFileSync('.env.local', 'utf8');
  return /^VITE_SUPABASE_URL=https:\/\/.+\.supabase\.co/m.test(env) && /^VITE_SUPABASE_ANON_KEY=.+/m.test(env);
}

if (hasLocalSupabaseEnv()) {
  checks.push({ name: 'food-smoke-tests', command: 'node', args: ['qa/smoke-food-text.mjs'] });
} else {
  checks.push({ name: 'food-smoke-tests', skipped: true, reason: '.env.local is missing Supabase URL or anon key' });
}

const results = [];

function redactSecrets(text) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  return token ? text.replaceAll(token, '<redacted>') : text;
}

for (const check of checks) {
  if (check.skipped) {
    results.push({ name: check.name, status: 'skipped', reason: check.reason });
    continue;
  }

  const startedAt = Date.now();
  const result = spawnSync(check.command, check.args, {
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const durationMs = Date.now() - startedAt;

  process.stdout.write(`\n=== ${check.name} ===\n`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(redactSecrets(result.stderr));

  results.push({
    name: check.name,
    status: result.status === 0 ? 'passed' : 'failed',
    durationMs,
  });
}

const failed = results.filter((item) => item.status === 'failed');
const summary = {
  ok: failed.length === 0,
  results,
  nextAction: failed.length
    ? `Fix failed backend checks: ${failed.map((item) => item.name).join(', ')}.`
    : 'Backend health checks passed for local config and remote smoke-test path.',
};

process.stdout.write(`\n=== backend-health-summary ===\n${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
