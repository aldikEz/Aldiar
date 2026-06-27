import { readFileSync } from 'node:fs';

const appFile = 'src/components/ui/digestisnap-site.tsx';
const app = readFileSync(appFile, 'utf8');

const checks = [
  {
    name: 'landing prevents horizontal overflow',
    ok: /min-h-screen overflow-x-hidden bg-white/.test(app),
  },
  {
    name: 'app shell prevents horizontal overflow',
    ok: /overflow-x-hidden overflow-y-auto/.test(app)
      && /min-w-0 flex-1/.test(app),
  },
  {
    name: 'home scales from phone width to desktop width',
    ok: /max-w-\[430px\].*sm:max-w-\[620px\].*lg:max-w-\[1040px\]/s.test(app),
  },
  {
    name: 'non-home app pages keep readable width',
    ok: /max-w-\[430px\] pb-28 pt-0 sm:max-w-\[620px\] lg:max-w-\[980px\]/.test(app),
  },
  {
    name: 'bottom primary action respects mobile safe area',
    ok: /env\(safe-area-inset-bottom\)/.test(app)
      && /pointer-events-none absolute inset-x-0 bottom-0/.test(app),
  },
  {
    name: 'mobile app shell uses clamp padding instead of desktop fixed gutters',
    ok: /px-\[clamp\(12px,4vw,24px\)\]/.test(app),
  },
  {
    name: 'dashboard secondary switch is compact on mobile',
    ok: /max-w-\[300px\] grid-cols-2/.test(app)
      && /h-10 rounded-full text-xs/.test(app),
  },
  {
    name: 'nutrition cards fit mobile before expanding on larger screens',
    ok: /grid grid-cols-2 gap-2 sm:grid-cols-4/.test(app),
  },
  {
    name: 'camera sheet uses full viewport without fixed crop',
    ok: /absolute inset-0 z-50 flex flex-col bg-black text-white/.test(app)
      && /className="h-full w-full object-cover"/.test(app),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix responsive checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'Responsive layout constraints are present for mobile and desktop shells.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
