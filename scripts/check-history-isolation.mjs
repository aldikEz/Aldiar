import { readFileSync } from 'node:fs';

const appFile = 'src/components/ui/digestisnap-site.tsx';
const app = readFileSync(appFile, 'utf8');

const checks = [
  {
    name: 'remote merge keeps only current owner local scans',
    ok: /const freshLocalScans = current\.filter\(\(scan\) =>[\s\S]{0,180}scan\.ownerId === session\.user\.id[\s\S]{0,180}Date\.parse\(scan\.createdAt\) >= loadStartedAt/.test(app),
  },
  {
    name: 'ownedRecentScans is the only render/export source',
    ok: /const ownedRecentScans = recentScans\.filter\(\(scan\) => !scan\.ownerId \|\| scan\.ownerId === session\.user\.id\)/.test(app)
      && !/recentScans\.(?:some|filter|find|slice|map)\(/.test(app.replace(/const ownedRecentScans = recentScans\.filter\([\s\S]*?\);/, '')),
  },
  {
    name: 'history and progress are derived from owned scans',
    ok: /const filteredHistoryScans = ownedRecentScans/.test(app)
      && /const progressTimelineScans = ownedRecentScans/.test(app)
      && /buildPatternInsight\(ownedRecentScans, language\)/.test(app),
  },
  {
    name: 'export uses owned scans only',
    ok: /scans: ownedRecentScans\.map\(\(scan\) =>/.test(app),
  },
  {
    name: 'recent scan cache reads and writes under user key',
    ok: /readRecentScans\(session\.user\.id\)/.test(app)
      && /saveRecentScans\(next, session\.user\.id\)/.test(app),
  },
];

const failed = checks.filter((check) => !check.ok);
const summary = {
  ok: failed.length === 0,
  checks,
  nextAction: failed.length
    ? `Fix history isolation checks: ${failed.map((check) => check.name).join(', ')}.`
    : 'History, progress, export, and cache recovery render only current-user scans.',
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failed.length) {
  process.exitCode = 1;
}
