import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const migrationsDir = 'supabase/migrations';
const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'))
  .join('\n')
  .toLowerCase();

const app = readFileSync('src/components/ui/digestisnap-site.tsx', 'utf8');
const deleteFunction = readFileSync('supabase/functions/delete-account/index.ts', 'utf8').toLowerCase();

const privateTables = [
  'entries',
  'profiles',
  'scan_corrections',
  'food_events',
  'user_daily_state',
];

const checks = [];

for (const table of privateTables) {
  checks.push({
    name: `${table} is deleted by auth user cascade`,
    ok: new RegExp(`create table if not exists public\\.${table}[\\s\\S]+references auth\\.users \\(id\\) on delete cascade`).test(migrations),
  });
}

checks.push(
  {
    name: 'delete-account requires POST',
    ok: /req\.method !== 'post'/.test(deleteFunction),
  },
  {
    name: 'delete-account verifies caller JWT',
    ok: /authorization.*bearer/.test(deleteFunction) && /\/auth\/v1\/user/.test(deleteFunction),
  },
  {
    name: 'delete-account uses service role only server-side',
    ok: /supabase_service_role_key/.test(deleteFunction) && /\/auth\/v1\/admin\/users\//.test(deleteFunction),
  },
  {
    name: 'delete-account uses no-store responses',
    ok: /cache-control': 'no-store'/.test(deleteFunction),
  },
  {
    name: 'frontend delete invokes Edge Function then clears local user data',
    ok: /supabase\.functions\.invoke\('delete-account'/.test(app)
      && /clearUserLocalData\(session\.user\.id\)/.test(app)
      && /supabase\.auth\.signOut\(\)/.test(app),
  },
  {
    name: 'local account cleanup removes generic pending profile state',
    ok: /DIGESTSNAP_PENDING_PROFILE_KEY/.test(app) && /DIGESTSNAP_PROFILE_STORAGE_KEY/.test(app),
  },
  {
    name: 'export includes account profile streak water entries and scans',
    ok: /const exportData = \{[\s\S]+account:[\s\S]+profile:[\s\S]+streak:[\s\S]+water:[\s\S]+entries:[\s\S]+scans:/.test(app),
  },
  {
    name: 'export includes scan nutrition and feelings',
    ok: /nutrition: scan\.nutrition/.test(app)
      && /feeling: scan\.feeling \?\? null/.test(app)
      && /eaten: scan\.eaten \?\? null/.test(app),
  },
);

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix account lifecycle checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Account export/delete lifecycle looks coherent for local code and migrations.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
