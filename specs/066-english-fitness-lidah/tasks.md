# Tasks 066 — Fitness Lidah (targeted articulation drills)

Depends on 065 (per-word STT results). Test-first. Commits: `feat(english[-web]): …`.

## A. Backend: weak-point model + threshold logic
- [ ] A1. `test(english)`: threshold state machine — activate at N fails, clear at M
  passes, resurface after clear, owner isolation, auth required. **Fail first.**
- [ ] A2. Model `EnglishWeakPoint` (owner, phoneme, fail_count, pass_streak,
  total_attempts, status, first_seen, last_seen; unique owner+phoneme). Migration.
- [ ] A3. Constants `WEAKPOINT_ACTIVATE_N=3`, `WEAKPOINT_CLEAR_M=3` (one place).
- [ ] A4. `POST /api/english/weakpoints/record/` (bulk deltas + threshold apply) +
  `GET /api/english/weakpoints/` (active, owner-scoped). Serializer.
- [ ] A5. Run A1 → green.

## B. Frontend pure logic + content (vitest)
- [ ] B1. `test(english-web)`: `fitness/analyze.test.ts` — `analyzeAttempt`
  (word→target-phoneme deltas; wrong word→fail, correct→pass; OOV skip; one delta
  per phoneme per attempt). **Fail first.**
- [ ] B2. `fitness/phonemes.ts` — curated target phonemes + drill content
  (TH, V/F, R, L, Z/S, final consonants, SH/CH): label, arpabet, tip, minimalPairs,
  tongueTwister, examples.
- [ ] B3. `fitness/cmudict.ts` — bundled/lazy CMUdict lookup →
  `targetPhonemesForWord`. B4. `fitness/analyze.ts` → B1 green.

## C. Frontend integration + drills UI
- [ ] C1. `api.ts`: `recordWeakpoints(deltas)`, `fetchWeakpoints()`.
- [ ] C2. Scoring hook-in (LessonPlayer shadowing/dictation + Custom): derive
  `okFlags` from scoring result → `analyzeAttempt` → `recordWeakpoints`
  (fire-and-forget, errors ignored).
- [ ] C3. `pages/Fitness.tsx` — list active weak sounds + per-sound **drill**
  (tip + minimal pairs + tongue twister; record → STT → score → streak → clear).
- [ ] C4. Nav entry in `App.tsx` + card on Lessons. `tsc` + `vite build` green.

## D. Deploy + verify
- [ ] D1. Migrate `english` on prod (`.env` sourced). Build + rsync SPA (+ CMUdict
  asset). No new server ML.
- [ ] D2. Manual QA checklist (below).

## Manual QA
- [ ] Fail "think" (TH) across a few attempts → `TH` appears in Fitness Lidah.
- [ ] Open TH drill → minimal pairs + tongue twister + tip shown; record → scored.
- [ ] Pass the target enough times → sound **clears** and leaves the queue.
- [ ] One STT misfire alone does NOT create a weak point (needs ≥ N).
- [ ] Weak points are per-account (second account doesn't see them).
- [ ] OOV word (not in CMUdict) is skipped, no crash.

## Notes / guardrails
- Backend owns the queue + thresholds (authoritative). Frontend only sends deltas.
- Never over-attribute: max one pass/fail per phoneme per attempt.
- Fire-and-forget recording must never block or break the scoring UX.
- RN app out of scope.
