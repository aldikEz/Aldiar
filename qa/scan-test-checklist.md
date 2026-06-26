# DigestSnap P0 Scan QA Checklist

Run this checklist after every AI prompt, scoring, nutrition, or correction change.

## Setup

- Use one logged-in test account.
- Clear browser cache only when testing first-run behavior.
- Keep app language set to English for the first pass, then Russian for the Cyrillic cases.
- Use clear photos first, then intentionally blurry photos.
- For every scan, open the result sheet and verify the result card, confidence chip, nutrition block, recent upload row, and history/progress surfaces.

## Pass Criteria

- The result has a recognizable food or product name.
- The confidence chip is structured from backend data:
  - `label_read` for visible label or package text.
  - `database_match` when nutrition was matched to OpenFoodFacts.
  - `visual_estimate` for whole foods or no-label meals.
  - `fallback` for blurry or untrusted scans.
  - `user_corrected` after Fix result.
- Whole fruit and simple whole foods are not marked unreadable.
- Soda, sweetened tea, energy drinks, chips, and candy are never Safe.
- Nutrition is plausible for one normal serving or one package.
- Fix result saves locally and creates or updates a `scan_corrections` row for the current user.
- No raw Supabase or Gemini error text appears in the UI.

## Manual Test Flow

1. Scan apple.
2. Scan avocado.
3. Scan eggs.
4. Scan Borjomi.
5. Scan Coca-Cola.
6. Scan Fuse Tea.
7. Scan Lay's chips.
8. Scan Kinder Молочный ломтик.
9. Scan plain pasta.
10. Scan a blurry packaged food photo.
11. Fix one result manually and reload the app.

## Result Logging

Record each run with:

| Case | Rating | Score | Confidence Source | Name OK | Nutrition OK | Correction OK | Notes |
|---|---:|---:|---|---|---|---|---|
| whole-apple |  |  |  |  |  |  |  |
| avocado |  |  |  |  |  |  |  |
| plain-eggs |  |  |  |  |  |  |  |
| borjomi |  |  |  |  |  |  |  |
| coca-cola |  |  |  |  |  |  |  |
| fuse-tea |  |  |  |  |  |  |  |
| lays-chips |  |  |  |  |  |  |  |
| kinder-milk-slice-ru |  |  |  |  |  |  |  |
| plain-pasta |  |  |  |  |  |  |  |
| unreadable-packaged-food |  |  |  |  |  |  |  |
| user-correction |  |  |  |  |  |  |  |
