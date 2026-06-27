import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const expectedFunctions = ['ai', 'delete-account'];
const projectRefPath = join('supabase', '.temp', 'project-ref');

function readText(path) {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return '';
  }
}

function redact(value) {
  if (!value) return '';
  if (value.length <= 8) return '<redacted>';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
    ...options,
  });
}

const localFunctions = expectedFunctions.map((name) => ({
  name,
  path: join('supabase', 'functions', name, 'index.ts'),
  exists: existsSync(join('supabase', 'functions', name, 'index.ts')),
}));

const projectRef = readText(projectRefPath);
const cliVersion = run('npx', ['supabase', '--version']);
const hasAccessToken = Boolean(process.env.SUPABASE_ACCESS_TOKEN);

const report = {
  projectRef: projectRef ? redact(projectRef) : null,
  cliAvailable: cliVersion.status === 0,
  cliVersion: cliVersion.status === 0 ? cliVersion.stdout.trim() : null,
  localFunctions,
  remote: {
    checked: false,
    status: 'skipped_missing_SUPABASE_ACCESS_TOKEN',
    functions: [],
  },
};

if (hasAccessToken) {
  const remoteList = run('npx', ['supabase', 'functions', 'list']);
  report.remote.checked = true;
  report.remote.status = remoteList.status === 0 ? 'ok' : 'failed';
  report.remote.functions = remoteList.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => expectedFunctions.some((name) => line.includes(name)));
  if (remoteList.status !== 0) {
    report.remote.error = remoteList.stderr.trim().replace(process.env.SUPABASE_ACCESS_TOKEN, '<redacted>');
  }
}

const missingLocal = localFunctions.filter((item) => !item.exists).map((item) => item.name);
const remoteMissing = hasAccessToken
  ? expectedFunctions.filter((name) => !report.remote.functions.some((line) => line.includes(name)))
  : [];

report.ok = report.cliAvailable && projectRef && missingLocal.length === 0 && (!hasAccessToken || remoteMissing.length === 0);
report.nextAction = !report.cliAvailable
  ? 'Run npm install so the local Supabase CLI is available.'
  : !projectRef
    ? 'Run npm run db:link to link the Supabase project.'
    : missingLocal.length > 0
      ? `Restore missing local functions: ${missingLocal.join(', ')}.`
      : !hasAccessToken
        ? 'Set SUPABASE_ACCESS_TOKEN locally or in CI to verify deployed functions.'
        : remoteMissing.length > 0
          ? `Deploy missing remote functions: ${remoteMissing.join(', ')}.`
          : 'Supabase functions are present locally and remotely.';

console.log(JSON.stringify(report, null, 2));

if (!report.ok && hasAccessToken) {
  process.exitCode = 1;
}
