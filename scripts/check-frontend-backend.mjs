import { readFileSync } from 'node:fs';

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

const files = {
  supabaseClient: readText('src/lib/supabase.ts'),
  imageClient: readText('src/lib/imageScanClient.ts'),
  dashboard: readText('src/components/ui/digestisnap-site.tsx'),
  vercel: readText('vercel.json'),
  envExample: readText('.env.example'),
};

const sourceText = `${files.supabaseClient}\n${files.imageClient}\n${files.dashboard}`;

const directAiDomains = [
  'generativelanguage.googleapis.com',
  'api.openai.com',
  'openai.com',
].filter((domain) => sourceText.includes(domain));

const frontendViteSecrets = [
  'VITE_GEMINI',
  'VITE_OPENAI',
  'VITE_SUPABASE_SERVICE_ROLE',
].filter((needle) => files.envExample.includes(needle) || sourceText.includes(needle));

const aiInvokes = [...files.imageClient.matchAll(/functions\.invoke<[^>]+>\('([^']+)'/g)].map((match) => match[1]);
const rawFunctionUrls = [...sourceText.matchAll(/functions\/v1\/([a-z0-9_-]+)/gi)].map((match) => match[1]);

const cspAllowsDirectAi = /connect-src[^"]*(generativelanguage\.googleapis\.com|api\.openai\.com|openai\.com)/i.test(files.vercel);

const report = {
  supabaseClient: {
    readsViteSupabaseUrl: /VITE_SUPABASE_URL/.test(files.supabaseClient),
    readsViteSupabaseAnonKey: /VITE_SUPABASE_ANON_KEY/.test(files.supabaseClient),
  },
  aiCalls: {
    invokes: aiInvokes,
    rawFunctionUrls,
    onlySupabaseFunctionInvoke: directAiDomains.length === 0 && rawFunctionUrls.length === 0 && aiInvokes.every((name) => name === 'ai'),
  },
  csp: {
    allowsDirectAi: cspAllowsDirectAi,
  },
  frontendSecretExposure: {
    suspiciousViteNames: frontendViteSecrets,
  },
};

report.ok = Boolean(
  report.supabaseClient.readsViteSupabaseUrl &&
    report.supabaseClient.readsViteSupabaseAnonKey &&
    report.aiCalls.onlySupabaseFunctionInvoke &&
    !report.csp.allowsDirectAi &&
    frontendViteSecrets.length === 0,
);

report.nextAction = !report.supabaseClient.readsViteSupabaseUrl || !report.supabaseClient.readsViteSupabaseAnonKey
  ? 'Fix src/lib/supabase.ts to use VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  : directAiDomains.length > 0
    ? `Remove direct browser AI domains from source: ${directAiDomains.join(', ')}.`
    : rawFunctionUrls.length > 0
      ? `Use supabase.functions.invoke instead of raw function URLs: ${rawFunctionUrls.join(', ')}.`
      : aiInvokes.some((name) => name !== 'ai')
        ? `Unexpected AI function name found: ${aiInvokes.join(', ')}.`
        : cspAllowsDirectAi
          ? 'Remove direct AI provider domains from connect-src; browser should only talk to Supabase.'
          : frontendViteSecrets.length > 0
            ? `Remove frontend-exposed secret names: ${frontendViteSecrets.join(', ')}.`
            : 'Frontend backend target is clean: browser calls Supabase Edge Function only.';

console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
