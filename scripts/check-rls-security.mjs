import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const migrationsDir = 'supabase/migrations';

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'))
  .join('\n')
  .toLowerCase();

const clientOwnedTables = [
  'entries',
  'profiles',
  'scan_corrections',
  'food_events',
  'user_daily_state',
];

const internalTables = [
  'cached_labels',
];

const checks = [];

function has(pattern) {
  return pattern.test(migrations);
}

for (const table of [...clientOwnedTables, ...internalTables]) {
  checks.push({
    name: `${table} has RLS enabled`,
    ok: has(new RegExp(`alter table(?: if exists)? public\\.${table} enable row level security`)),
  });
  checks.push({
    name: `${table} has forced RLS`,
    ok: has(new RegExp(`alter table(?: if exists)? public\\.${table} force row level security`)),
  });
  checks.push({
    name: `${table} revokes anon access`,
    ok: has(new RegExp(`revoke all on table public\\.${table} from anon`)),
  });
}

for (const table of clientOwnedTables) {
  checks.push({
    name: `${table} grants only authenticated client access`,
    ok: has(new RegExp(`grant (?:select, insert, update(?:, delete)?|select, insert, update, delete) on table public\\.${table} to authenticated`)),
  });
  checks.push({
    name: `${table} policies enforce auth.uid ownership`,
    ok: has(new RegExp(`on public\\.${table}[\\s\\S]+auth\\.uid\\(\\)\\s*=\\s*user_id`)),
  });
}

checks.push({
  name: 'cached_labels is service-role only',
  ok: has(/revoke all on table public\.cached_labels from authenticated/),
});

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix RLS checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'All local table migrations have the expected RLS/security posture.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
