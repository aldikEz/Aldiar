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
    name: 'food_events stores feeling context',
    ok: /\bfeeling_logged_at\s+timestamptz\b/.test(migrations)
      && /\bfeeling_delay_minutes\s+integer\b/.test(migrations)
      && /\bfood_category\s+text\b/.test(migrations),
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
    name: 'user_daily_state table exists',
    ok: /create table if not exists public\.user_daily_state/.test(migrations),
  },
  {
    name: 'user_daily_state stores water',
    ok: /\bwater_ml\s+integer\b/.test(migrations) && /\bwater_unit\s+text\b/.test(migrations),
  },
  {
    name: 'user_daily_state stores streak',
    ok: /\bstreak_count\s+integer\b/.test(migrations)
      && /\bstreak_max_count\s+integer\b/.test(migrations)
      && /\bstreak_last_logged_at\s+timestamptz\b/.test(migrations),
  },
  {
    name: 'user_daily_state has user/day primary key',
    ok: /primary key\s*\(\s*user_id\s*,\s*day\s*\)/.test(migrations),
  },
  {
    name: 'user_daily_state has RLS enabled',
    ok: /alter table(?: if exists)? public\.user_daily_state enable row level security/.test(migrations),
  },
  {
    name: 'user_daily_state has forced RLS',
    ok: /alter table(?: if exists)? public\.user_daily_state force row level security/.test(migrations),
  },
  {
    name: 'user_daily_state is not readable by anon',
    ok: /revoke all on table public\.user_daily_state from anon/.test(migrations),
  },
  {
    name: 'user_daily_state policies enforce auth uid ownership',
    ok: /on public\.user_daily_state[\s\S]+auth\.uid\(\)\s*=\s*user_id/.test(migrations),
  },
  {
    name: 'scan corrections have reusable product key',
    ok: /\bproduct_key\s+text\b/.test(migrations)
      && /scan_corrections_user_product_key_updated_idx/.test(migrations),
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
    name: 'frontend persists feeling context',
    ok: /feeling_logged_at:\s*scan\.feelingLoggedAt \?\? null/.test(app)
      && /feeling_delay_minutes:\s*typeof scan\.feelingDelayMinutes === 'number'/.test(app)
      && /food_category:\s*scan\.foodCategory \?\? deriveFoodCategory\(scan\.result\)/.test(app),
  },
  {
    name: 'frontend timestamps direct feeling check-ins',
    ok: /const consumedAt = activeSavedScan\?\.consumedAt \?\? new Date\(\)\.toISOString\(\)/.test(app)
      && /consumedAt,\s*\n\s*foodCategory: deriveFoodCategory\(scanResult\.result\)/.test(app),
  },
  {
    name: 'frontend restores remote rows into recent scans',
    ok: /function foodEventRowToRecentScan/.test(app) && /\.map\(foodEventRowToRecentScan\)/.test(app),
  },
  {
    name: 'frontend does not boot scan history from local cache',
    ok: /const \[recentScans, setRecentScans\] = useState<RecentScan\[\]>\(\[\]\)/.test(app),
  },
  {
    name: 'frontend only shows recovered cache after Supabase backfill',
    ok: /Promise\.allSettled\(cachedScans\.map\(\(scan\) => persistFoodEvent\(scan\)\)\)/.test(app)
      && /setRecentScans\(recoveredScans\)/.test(app),
  },
  {
    name: 'frontend persists reusable scan corrections',
    ok: /product_key:\s*productKey/.test(app)
      && /\.from\('scan_corrections'\)[\s\S]{0,700}\.eq\('product_key', productKey\)/.test(app),
  },
  {
    name: 'frontend reads Supabase daily state',
    ok: /\.from\('user_daily_state'\)[\s\S]{0,500}\.select/.test(app),
  },
  {
    name: 'frontend upserts Supabase daily state',
    ok: /\.from\('user_daily_state'\)[\s\S]{0,900}\.upsert/.test(app),
  },
  {
    name: 'frontend persists water and streak state',
    ok: /water_ml:\s*nextWaterMl/.test(app)
      && /streak_count:\s*nextStreak\.count/.test(app)
      && /streak_last_logged_at:\s*nextStreak\.lastLoggedAt/.test(app),
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
