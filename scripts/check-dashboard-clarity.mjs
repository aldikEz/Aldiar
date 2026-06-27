import { readFileSync } from 'node:fs';

const app = readFileSync('src/components/ui/digestisnap-site.tsx', 'utf8');

const checks = [
  {
    name: 'home derives a single hero title from pending check-in, saved scan, or ready state',
    ok: /const homeHeroTitle = laterCheckInCandidate[\s\S]+latestScore !== null[\s\S]+Ready/.test(app),
  },
  {
    name: 'home hero gives pending check-in priority over scan score',
    ok: /\{laterCheckInCandidate \? homeHeroTitle : latestScore \?\? homeHeroTitle\}/.test(app),
  },
  {
    name: 'dashboard progress shortcut is not mislabeled as patterns',
    ok: /\{isRussian \? 'Прогресс' : 'Progress'\}/.test(app)
      && !/<p className="text-\[18px\][\s\S]+?\{isRussian \? 'Паттерны' : 'Patterns'\}/.test(app),
  },
  {
    name: 'home scan list is presented as a timeline',
    ok: /\{isRussian \? 'Таймлайн' : 'Timeline'\}/.test(app)
      && /\{isRussian \? 'История' : 'Full history'\}/.test(app),
  },
  {
    name: 'first-time dashboard empty state explains where the first scan appears',
    ok: /Timeline is empty/.test(app) && /Your first food or label photo will appear here/.test(app),
  },
];

const failed = checks.filter((check) => !check.ok);

const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix dashboard clarity checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Dashboard labels and next-action priority are coherent.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
