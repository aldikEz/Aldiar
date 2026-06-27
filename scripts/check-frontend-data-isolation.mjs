import { readFileSync } from 'node:fs';

const app = readFileSync('src/components/ui/digestisnap-site.tsx', 'utf8');

function has(pattern) {
  return pattern.test(app);
}

const checks = [
  {
    name: 'entries read is scoped to current user',
    ok: has(/\.from\('entries'\)[\s\S]{0,240}\.select\('id,user_id,title,created_at'\)[\s\S]{0,180}\.eq\('user_id', session\.user\.id\)/),
  },
  {
    name: 'food_events read is scoped to current user',
    ok: has(/\.from\('food_events'\)[\s\S]{0,260}\.select\('user_id,local_scan_id,result,nutrition,image_data_url,eaten,feeling,consumed_at,note,created_at'\)[\s\S]{0,180}\.eq\('user_id', session\.user\.id\)/),
  },
  {
    name: 'profiles read is scoped to current user',
    ok: has(/\.from\('profiles'\)[\s\S]{0,220}\.select\('user_id,full_name,username'\)[\s\S]{0,180}\.eq\('user_id', session\.user\.id\)/),
  },
  {
    name: 'daily state read is scoped to current user and day',
    ok: has(/\.from\('user_daily_state'\)[\s\S]{0,280}\.select\('user_id,day,water_ml,water_unit,streak_count,streak_max_count,streak_last_logged_at,updated_at'\)[\s\S]{0,220}\.eq\('user_id', session\.user\.id\)[\s\S]{0,120}\.eq\('day', todayKey\)/),
  },
  {
    name: 'entries writes include current user id',
    ok: has(/\.from\('entries'\)[\s\S]{0,160}\.insert\(\{ title, user_id: session\.user\.id \}\)/),
  },
  {
    name: 'scan corrections upsert is user-owned',
    ok: has(/\.from\('scan_corrections'\)[\s\S]{0,420}user_id: session\.user\.id[\s\S]{0,260}\{ onConflict: 'user_id,local_scan_id' \}/),
  },
  {
    name: 'food events upsert is user-owned',
    ok: has(/\.from\('food_events'\)[\s\S]{0,900}user_id: session\.user\.id[\s\S]{0,900}\{ onConflict: 'user_id,local_scan_id' \}/),
  },
  {
    name: 'daily state upsert is user-owned',
    ok: has(/\.from\('user_daily_state'\)[\s\S]{0,900}user_id: session\.user\.id[\s\S]{0,700}\{ onConflict: 'user_id,day' \}/),
  },
  {
    name: 'profiles upserts are user-owned',
    ok: has(/\.from\('profiles'\)[\s\S]{0,420}user_id: session\.user\.id[\s\S]{0,240}\{ onConflict: 'user_id' \}/),
  },
  {
    name: 'remote food rows are filtered after fetch',
    ok: has(/\.filter\(\(row\) => row\.user_id === session\.user\.id\)/),
  },
  {
    name: 'remote entry rows are filtered after fetch',
    ok: has(/setLogs\(\(data \?\? \[\]\)\.filter\(\(item\) => item\.user_id === session\.user\.id\)\)/),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix frontend isolation checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Frontend private-data reads and writes are scoped to the signed-in user.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
