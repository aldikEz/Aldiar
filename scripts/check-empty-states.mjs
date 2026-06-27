import { readFileSync } from 'node:fs';

const appFile = 'src/components/ui/digestisnap-site.tsx';
const app = readFileSync(appFile, 'utf8');

const checks = [
  {
    name: 'home recent scans has intentional empty state',
    ok: /No scans yet/.test(app)
      && /Take a food or label photo to save the first result/.test(app),
  },
  {
    name: 'progress timeline has intentional empty state',
    ok: /No saved scans yet/.test(app)
      && /Your first clear photo starts this timeline/.test(app),
  },
  {
    name: 'history search empty state is not blank',
    ok: /No matches for this filter/.test(app)
      && /Clear search or choose another filter/.test(app),
  },
  {
    name: 'selected day empty state is explicit',
    ok: /Nothing saved on this date/.test(app),
  },
  {
    name: 'weekly pattern empty state avoids fake insight',
    ok: /No repeated weekly signal yet/.test(app),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix empty state checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Core empty states are intentional and non-fake.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
