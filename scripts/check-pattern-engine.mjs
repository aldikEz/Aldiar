import { readFileSync } from 'node:fs';

const appFile = 'src/components/ui/digestisnap-site.tsx';
const app = readFileSync(appFile, 'utf8');

const checks = [
  {
    name: 'main pattern requires repeated discomfort signals',
    ok: /const discomfortScans = eatenScans\.filter\(\(scan\) => scan\.feeling && scan\.feeling !== 'Fine'\)/.test(app)
      && /if \(strongest && strongest\.count >= 2\)/.test(app),
  },
  {
    name: 'waiting state does not claim pattern before feelings',
    ok: /title:\s*isRussian \? 'Нужны отметки самочувствия' : 'Waiting for check-ins'/.test(app),
  },
  {
    name: 'weekly signal requires at least two occurrences',
    ok: /const weeklyRepeatedConcern = weeklyTopConcern && weeklyTopConcern\[1\] >= 2 \? weeklyTopConcern : null/.test(app)
      && /No repeated weekly signal yet/.test(app),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix pattern engine checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Pattern insights require repeated real signals.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
