import { readFileSync } from 'node:fs';

const app = readFileSync('src/components/ui/digestisnap-site.tsx', 'utf8');

const checks = [
  {
    name: 'result sheet has mobile max height and scroll',
    ok: /resultSheetOpen && scanResult[\s\S]+max-h-\[86vh\][\s\S]+overflow-y-auto/.test(app),
  },
  {
    name: 'fix result sheet has mobile max height and scroll',
    ok: /fixResultSheetOpen && scanResult[\s\S]+max-h-\[88vh\][\s\S]+overflow-y-auto/.test(app),
  },
  {
    name: 'history sheet keeps list scroll inside the sheet',
    ok: /historySheetOpen[\s\S]+max-h-\[88vh\][\s\S]+overflow-hidden[\s\S]+max-h-\[56vh\][\s\S]+overflow-y-auto/.test(app),
  },
  {
    name: 'water sheet cannot crop on small mobile screens',
    ok: /waterSheetOpen[\s\S]+max-h-\[88vh\][\s\S]+overflow-y-auto/.test(app),
  },
  {
    name: 'all modal sheets respect mobile safe-area bottom padding',
    ok: (app.match(/env\(safe-area-inset-bottom\)/g) ?? []).length >= 4,
  },
];

const failed = checks.filter((check) => !check.ok);

const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix sheet layout checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Sheets have mobile-safe height, scrolling, and safe-area padding.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
