import { readFileSync } from 'node:fs';

const app = readFileSync('src/components/ui/digestisnap-site.tsx', 'utf8');
const appRouter = readFileSync('src/App.tsx', 'utf8');

const forbiddenPatterns = [
  { name: 'empty onClick handler', pattern: /onClick=\{\(\) => \{\}\}/ },
  { name: 'placeholder hash link', pattern: /href=["']#["']/ },
  { name: 'browser alert used as product feedback', pattern: /alert\(/ },
  { name: 'coming soon filler', pattern: /coming soon|not implemented|placeholder action/i },
];

const failedForbidden = forbiddenPatterns.filter(({ pattern }) => pattern.test(`${app}\n${appRouter}`));

const checks = [
  {
    name: 'no obvious dead or fake UI actions remain',
    ok: failedForbidden.length === 0,
  },
  {
    name: 'primary camera action opens the camera sheet',
    ok: /const openCamera = \(\) => \{[\s\S]+setCameraSheetOpen\(true\)/.test(app)
      && /onClick=\{openCamera\}/.test(app),
  },
  {
    name: 'history rows open saved scan details',
    ok: /onClick=\{\(\) => openSavedScan\(item\)\}/.test(app),
  },
  {
    name: 'profile rows navigate or open real editors',
    ok: /openProfileEditor/.test(app)
      && /openGoalsEditor/.test(app)
      && /navigate\('\/manage-subscription'\)/.test(app),
  },
  {
    name: 'authenticated dashboard route protects private app',
    ok: /if \(!session && path === '\/dashboard'\)/.test(appRouter)
      && /navigate\('\/login', \{ replace: true \}\)/.test(appRouter),
  },
];

const failed = checks.filter((check) => !check.ok);

const summary = {
  ok: failed.length === 0,
  checks,
  forbiddenHits: failedForbidden.map((item) => item.name),
  nextAction: failed.length
    ? `Fix action wiring checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Core UI actions are wired to real product behavior.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
