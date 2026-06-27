import { readFileSync } from 'node:fs';

const appFile = 'src/components/ui/digestisnap-site.tsx';
const app = readFileSync(appFile, 'utf8');

const checks = [
  {
    name: 'scan analysis shows visible progress',
    ok: app.includes("scanState === 'scanning'")
      && app.includes('scanProgress}% progress')
      && app.includes('scanProgressText')
      && app.includes('width: `${scanProgress}%`'),
  },
  {
    name: 'camera capture disables duplicate taps and spins',
    ok: /disabled=\{cameraCapturing\}/.test(app)
      && /cameraCapturing \? <LoaderCircle/.test(app),
  },
  {
    name: 'manual dish scan disables duplicate submits and spins',
    ok: /menuDishScanning \? <LoaderCircle/.test(app)
      && /disabled=\{menuDishInput\.trim\(\)\.length < 2 \|\| menuDishScanning\}/.test(app),
  },
  {
    name: 'profile save communicates saving state',
    ok: /disabled=\{profileSaving\}/.test(app)
      && /profileSaving && <LoaderCircle/.test(app)
      && /profileSaving \? copy\.saving : copy\.saveProfile/.test(app),
  },
  {
    name: 'account deletion locks modal during delete',
    ok: /onClick=\{\(\) => !deleteLoading && setDeleteSheetOpen\(false\)\}/.test(app)
      && /disabled=\{deleteLoading\}/.test(app)
      && /deleteLoading && <LoaderCircle/.test(app),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix loading state checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Core async paths have visible loading states and duplicate-action protection.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
