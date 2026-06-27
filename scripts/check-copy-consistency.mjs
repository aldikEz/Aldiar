import { readFileSync } from 'node:fs';

const appFile = 'src/components/ui/digestisnap-site.tsx';
const app = readFileSync(appFile, 'utf8');

const staleBrandTerms = [
  'SensiBite',
  'sensibite',
  'LabelRead',
  'CalZen',
  'Pace AI',
  'Apple Health',
  'HealthKit',
  'Google Fit',
];

const checks = [
  {
    name: 'no stale brand or native-health copy remains',
    ok: staleBrandTerms.every((term) => !app.includes(term)),
  },
  {
    name: 'recent unclear scan status is localized through copy helpers',
    ok: app.includes('${copy.needsRetake} · ${copy.notScored}')
      && !app.includes("?'Needs retake · not scored'"),
  },
  {
    name: 'dashboard scan ratings use localized labels',
    ok: app.includes('ratingLabel(item.result.overallRating)')
      && app.includes('ratingLabel(scanResult.result.overallRating)'),
  },
  {
    name: 'core camera and scan copy has Russian and English branches',
    ok: /cameraTitle: isRussian \?/.test(app)
      && /menuFallbackTitle: isRussian \?/.test(app)
      && /aiCoolingDownTitle: isRussian \?/.test(app),
  },
  {
    name: 'DigestSnap naming is present and consistent',
    ok: /DigestSnap/.test(app)
      && !/Digestisnap/.test(app),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix copy consistency checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Core product copy is consistent across brand, language, and scan states.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
