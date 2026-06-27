import { readFileSync } from 'node:fs';

const appFile = 'src/components/ui/digestisnap-site.tsx';
const app = readFileSync(appFile, 'utf8');

const checks = [
  {
    name: 'feeling choices render only after eaten decision',
    ok: /selectedMealStatus === 'eaten'\s*\?\s*\(/.test(app)
      && /How do you feel\?/.test(app),
  },
  {
    name: 'not eaten clears feeling state',
    ok: /if \(status === 'not_eaten'\) setSelectedFeeling\(null\)/.test(app),
  },
  {
    name: 'food event feeling is only written for eaten scans',
    ok: /feeling:\s*status === 'eaten'\s*\?\s*selectedFeeling \?\? undefined\s*:\s*undefined/.test(app),
  },
  {
    name: 'saved scan check-in timestamps are tied to consumed scan',
    ok: /consumedAt:\s*activeSavedScan\?\.consumedAt \?\? new Date\(\)\.toISOString\(\)/.test(app),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix feeling flow checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Feeling check-ins are gated behind eaten scans.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
