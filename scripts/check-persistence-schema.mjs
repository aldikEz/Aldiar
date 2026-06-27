import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const migrationsDir = 'supabase/migrations';
const appFile = 'src/components/ui/digestisnap-site.tsx';

function readAllMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'))
    .join('\n')
    .toLowerCase();
}

const migrations = readAllMigrations();
const app = readFileSync(appFile, 'utf8');

const checks = [
  {
    name: 'food_events table exists',
    ok: /create table if not exists public\.food_events/.test(migrations),
  },
  {
    name: 'food_events stores eaten decision',
    ok: /\beaten\s+boolean\b/.test(migrations),
  },
  {
    name: 'food_events stores feeling check-ins',
    ok: /\bfeeling\s+text\b/.test(migrations),
  },
  {
    name: 'food_events stores consumed timestamp',
    ok: /\bconsumed_at\s+timestamptz\b/.test(migrations),
  },
  {
    name: 'food_events stores user note',
    ok: /\bnote\s+text\b/.test(migrations),
  },
  {
    name: 'food_events has user/local scan uniqueness',
    ok: /unique\s*\(\s*user_id\s*,\s*local_scan_id\s*\)/.test(migrations),
  },
  {
    name: 'food_events has RLS enabled',
    ok: /alter table(?: if exists)? public\.food_events enable row level security/.test(migrations),
  },
  {
    name: 'food_events has forced RLS',
    ok: /alter table(?: if exists)? public\.food_events force row level security/.test(migrations),
  },
  {
    name: 'food_events is not readable by anon',
    ok: /revoke all on table public\.food_events from anon/.test(migrations),
  },
  {
    name: 'food_events policies enforce auth uid ownership',
    ok: /on public\.food_events[\s\S]+auth\.uid\(\)\s*=\s*user_id/.test(migrations),
  },
  {
    name: 'frontend reads Supabase food_events',
    ok: /\.from\('food_events'\)[\s\S]{0,500}\.select/.test(app),
  },
  {
    name: 'frontend upserts Supabase food_events',
    ok: /\.from\('food_events'\)[\s\S]{0,900}\.upsert/.test(app),
  },
  {
    name: 'frontend persists eaten decision',
    ok: /eaten:\s*typeof scan\.eaten === 'boolean'/.test(app),
  },
  {
    name: 'frontend persists feeling check-in',
    ok: /feeling:\s*scan\.feeling \?\? null/.test(app),
  },
  {
    name: 'frontend timestamps direct feeling check-ins',
    ok: /consumedAt:\s*activeSavedScan\?\.consumedAt \?\? new Date\(\)\.toISOString\(\)/.test(app),
  },
  {
    name: 'frontend restores remote rows into recent scans',
    ok: /function foodEventRowToRecentScan/.test(app) && /\.map\(foodEventRowToRecentScan\)/.test(app),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix persistence contract checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Persistence schema and frontend scan ownership contract look coherent.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
