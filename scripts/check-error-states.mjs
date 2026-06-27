import { readFileSync } from 'node:fs';

const appFile = 'src/components/ui/digestisnap-site.tsx';
const app = readFileSync(appFile, 'utf8');

const alertBlocks = [...app.matchAll(/role=\{?["']alert["']?\}?[\s\S]{0,500}/g)].map((match) => match[0]);
const alertText = alertBlocks.join('\n').toLowerCase();

const rawBackendTerms = [
  'pgrst',
  '23505',
  '42501',
  'violates row-level security',
  'duplicate key',
  'supabase',
  'schema',
  'jwt',
];

const checks = [
  {
    name: 'profile save maps backend errors to friendly copy',
    ok: /profileUsernameTaken/.test(app)
      && /profileSaveError/.test(app)
      && !/text:\s*error\?\.message/.test(app),
  },
  {
    name: 'camera errors use centralized user-facing copy',
    ok: /cameraBrowserUnsupported/.test(app)
      && /cameraPermissionBlocked/.test(app)
      && !/setCameraError\('Camera /.test(app),
  },
  {
    name: 'unclear scan result avoids technical error title',
    ok: /Could not verify image/.test(app)
      && !/productName:\s*isQuotaError \? 'AI cooling down' : 'Image check error'/.test(app),
  },
  {
    name: 'visible alerts do not expose raw backend terms',
    ok: rawBackendTerms.every((term) => !alertText.includes(term)),
  },
  {
    name: 'delete and auth errors use concise retry copy',
    ok: /deleteError:/.test(app)
      && /Unable to delete account\. Please try again/.test(app)
      && /Could not open Google sign-in\. Please try again/.test(app),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix error state checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'User-visible error states are friendly and do not expose backend details.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
