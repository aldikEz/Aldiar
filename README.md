# Pace AI

Pace AI is a polished front-end concept for one simple tracker that helps people plan training, food, school, recovery, and coach check-ins.

This build is a landing page plus interactive demo with a working local planner, food log, coach demo, and training session flow. It uses local React state and browser storage for the preview flow. There is no production auth, billing, medical advice, or account database wired into the live page yet.

## Stack

- Vite
- React
- TypeScript
- Supabase project files for future database and AI work
- Vercel config with basic security headers

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints, usually `http://localhost:5173`.

## Verify Before Shipping

```bash
npm run build
```

Also check the page at a small phone width, around `375px`, to confirm there is no horizontal scroll and all buttons fit.

## Current Demo Behavior

- `Start 3-day trial` opens a short planner.
- Planner answers create a saved mock setup in this browser.
- `Start training` creates a focused training session with sets, targets, progress, and saved history.
- `AI week` / `Generate AI Week` calls the Gemini Edge Function when configured and falls back to a local plan when it is not reachable.
- `Log food` saves simple meal, snack, water, or note entries.
- `Log today` updates the plan note.
- `Cmd/Ctrl + K` opens quick actions.
- Pricing buttons open the planner or coach-mode mock action.
- Privacy, Terms, and Safety buttons open readable demo notices.
- The Privacy sheet can clear browser-only demo data.

## Browser-Only Demo Data

The front-end preview stores only small demo state in `localStorage`, such as:

- last action
- plan note
- saved mock setup
- food entries
- active and completed training sessions
- whether a coach note is pinned

Users can clear this from the Privacy sheet. A real product should add account-level export, correction, deletion, consent, and retention controls before launch.

## Optional Supabase Setup

The current landing page does not require Supabase to run. Supabase files are kept for future database and AI features.

If you later wire Supabase into the app:

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase URL and anon key.
3. Link and push migrations only when you are ready to use the database.

```bash
npm run db:login
npm run db:link
npm run db:push
```

## Optional AI Function

The app calls `supabase/functions/ai` for Gemini so the Gemini key is not exposed in browser JavaScript.

For local frontend work, `.env.local` needs:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Before deploying or serving the Edge Function, set both server-side secrets:

```bash
npm run ai:secret -- GEMINI_API_KEY=your_key
npm run ai:secret -- AI_ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com
npm run ai:deploy
```

`AI_ALLOWED_ORIGINS` matters. Without it, the function only allows localhost/127.0.0.1 so it does not become a public AI proxy by accident.

If the Edge Function is missing, blocked, or not configured, Pace still works with a local fallback plan.

## Production Notes

- `vercel.json` adds CSP, frame blocking, referrer policy, permissions policy, and MIME sniff protection.
- These headers reduce common web risk, but they do not make the site impossible to hack.
- The Privacy, Terms, and Safety text is demo copy, not final legal advice.
- Before collecting real user data, payments, health/food/weight data, or teen/minor data, get qualified legal and security review.
