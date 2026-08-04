# Plan 066 — implementation (Fitness Lidah)

## Architecture

```
Shadowing/Dictation attempt (LessonPlayer / Custom)
   │  scoring.ts → per-word {word, ok}          (already exists, STT-source agnostic)
   ▼
fitness/analyze.ts (pure)   ── bundled CMUdict ──►  which TARGET phonemes each
   │  word touches, and did that word pass/fail
   ▼  per-phoneme deltas {phoneme, pass, fail}
POST /api/english/weakpoints/record/   (backend, owner-scoped, threshold logic)
   ▼
EnglishWeakPoint rows  ──►  GET /api/english/weakpoints/  ──►  pages/Fitness.tsx
                                                                 (drills per weak sound)
Drill = record → STT (065) → scoreAttempt → pass increments streak → clears at M
```

Phoneme mapping + drill content run **client-side** (offline-first, no server ML);
the backend only **persists history + decides the active queue** (thresholds).

## Backend (`backend/english/`)

- **Model `EnglishWeakPoint`**: `owner` FK, `phoneme` (CharField, e.g. `TH`,`R`,`V`),
  `fail_count`, `pass_streak`, `total_attempts`, `status` (`active`/`cleared`),
  `first_seen`, `last_seen`. `unique_together(owner, phoneme)`. Migration `0003`.
- **Endpoints** (IsAuthenticated, owner-scoped):
  - `POST /api/english/weakpoints/record/` — body `[{phoneme, pass:int, fail:int}]`
    (aggregated per attempt). Applies threshold logic (below). Returns updated rows.
  - `GET /api/english/weakpoints/` — active weak points for the caller.
- **Threshold logic** (constants in one place):
  - fail → `fail_count += n`, `pass_streak = 0`; activate (`status=active`) when
    `fail_count - passes_credit ≥ N` (default **N=3**).
  - pass → `pass_streak += n`; when `pass_streak ≥ M` (default **M=3**) → `cleared`
    and reset `fail_count` (resurfaces later if it fails again → spaced revisit).
- `serializers.py` + a small `weakpoints.py` view module or extend `views.py`.
- Tests (`english/tests.py`, Django): activate at N, clear at M, resurface after
  clear, owner isolation (can't see/alter another user's), auth required.

## Frontend (`english-web/src/fitness/`)

- **`phonemes.ts`** — curated **target phonemes** (bundled content). Each:
  `{ id, label, arpabet:string[], tip, minimalPairs:[a,b][], tongueTwister, examples }`.
  Initial set tuned for Indonesian→English learners:
  `TH (θ/ð)`, `V/F`, `R`, `L`, `Z/S`, final consonants (e.g. `-D`,`-T`), `SH/CH`.
- **`cmudict.ts`** — word → ARPABET via a **bundled CMUdict** (lazy-loaded chunk),
  `targetPhonemesForWord(word): string[]` mapping ARPABET → our target ids. OOV →
  `[]` (skip). (Decision: full CMUdict ~3–4 MB gz vs a curated subset — see below.)
- **`analyze.ts`** (pure, unit-tested) — `analyzeAttempt(refWords, okFlags)`:
  for each reference word, find its target phonemes; a wrong word → `fail` on those
  phonemes, a correct word → `pass`. Returns aggregated `{phoneme, pass, fail}[]`.
  **False-positive guard:** only count a phoneme, never over-attribute (one delta
  per phoneme per attempt).
- **`api.ts`** — `recordWeakpoints(deltas)`, `fetchWeakpoints()`.
- **Hook-in:** where `scoreAttempt` runs (LessonPlayer shadowing/dictation, Custom),
  compute `okFlags` per reference word (from the existing `ScoreMarks`/scoring
  result), call `analyzeAttempt` → `recordWeakpoints`. Fire-and-forget (don't block
  UI); ignore errors.
- **`pages/Fitness.tsx`** — "🏋️ Fitness Lidah": list active weak sounds (from
  `fetchWeakpoints`), each opens a **drill**: show tip + minimal pairs + tongue
  twister; record → STT → score; correct reps build the streak; clearing removes it.
- **Nav:** add a "Fitness Lidah" entry in `App.tsx` header + a card on Lessons.

## scoring.ts touchpoint

`scoring.ts` already yields per-word correctness (LCS align + fuzzball). Expose it
as `okFlags: boolean[]` aligned to reference words if not already — small helper,
no scoring change. This is the only coupling to 065 (transcript source is
irrelevant; per-word result is what we consume).

## Testing

- **Backend** (Django): threshold state machine (activate/clear/resurface), owner
  isolation, auth, bulk record idempotence-ish. Test-first.
- **Frontend vitest**: `analyze.ts` (word→phoneme deltas, OOV skip, no
  over-attribution) + threshold display selectors. `cmudict` lookup smoke.
- **Manual QA**: fail "think" repeatedly → `TH` drill appears; complete drill →
  clears; single STT misfire doesn't create a phantom weak point (needs ≥N).

## Rollout order

1. Backend model + endpoints + threshold logic (test-first).
2. `analyze.ts` + `cmudict` + `phonemes.ts` content (pure, vitest).
3. Wire scoring hook-in → record; Fitness page + drills + nav.
4. Deploy (migrate; build+rsync; bundle/host CMUdict). Manual QA.

## Open decisions (confirm before/at build)

- **N / M thresholds** (default 3 / 3) — tune after dogfooding.
- **CMUdict size**: full (~4 MB gz, accurate) vs curated subset of common words
  (smaller, more OOV). Lean full but lazy-loaded, cached.
- **Initial target-phoneme set + drill content** — who curates minimal pairs /
  tongue twisters (start with the 6–8 above, expand later).
- **Threshold logic location** — backend (authoritative queue) vs frontend. Plan =
  backend.
- Whether drills also feed `recordWeakpoints` (yes) and how a pass in a *drill*
  differs from a pass in a *lesson* (same signal v1).
