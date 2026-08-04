# Tasks 069 — Latihan Baca Kata (per-word pronunciation)

Test-first on backend + pure helpers. Commits: `feat(english[-web]): …`.

## A. Backend: word-practice model + endpoints
- [ ] A1. `test(english)`: activate at N fails, clear at M passes, manual add →
  active, remove, owner isolation, auth. **Fail first.** (mirror WeakPointTest)
- [ ] A2. Model `EnglishWordPractice` + migration `0005`; `register()` state machine.
- [ ] A3. Endpoints: `GET /words/`, `POST /words/record/`, `POST /words/add/`,
  `POST /words/remove/` + serializer + admin.
- [ ] A4. Run A1 → green.

## B. Frontend pure + content (vitest)
- [ ] B1. `test(english-web)`: `words/collect.ts` — extract wrong words from
  `AttemptScore.marks` → `{word, fail:1}` deltas (dedupe, normalize, skip empties).
- [ ] B2. Implement `words/collect.ts`; `words/contractions.ts` curated content.

## C. Frontend integration + page
- [ ] C1. `api.ts`: `fetchWords`, `recordWords`, `addWord`, `removeWord` + type.
- [ ] C2. Extend `fitness/record.ts` → also post wrong-word deltas (fire-and-forget).
- [ ] C3. `pages/WordPractice.tsx`: manual add; active-word drills (word + ▶️
  `speakAU` + record→score→pass→clear + remove); Contractions section.
- [ ] C4. Nav entry in `App.tsx` + card. `tsc` + `vite build` green.

## D. Deploy + verify
- [ ] D1. Migrate `english` on prod; build + rsync SPA.
- [ ] D2. Manual QA.

## Manual QA
- [ ] Mis-say "attribution" a few times in shadowing → appears in Latihan Kata.
- [ ] Word drill plays AU pronunciation; recording it correctly enough clears it.
- [ ] Manual add "nuanced" works; remove works.
- [ ] Contraction drill plays both "We're" and "We are".
- [ ] One STT misfire alone doesn't create an entry (needs ≥N).
- [ ] Per-account & auth-gated.

## Notes
- Browser TTS (`speakAU`) — en-AU preferred, English fallback with note.
- IPA + dictionary audio = v2 (separate).
- Device STT stays disabled (065) — recording uses server `/transcribe/`.
