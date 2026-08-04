# Plan 069 — implementation (Latihan Baca Kata)

Parallels Fitness Lidah (066) but at word granularity. Reuses the recorder,
`scoreAttempt`, and the browser TTS (`speakAU`) already in `speech.ts`.

## Backend (`backend/english/`)

- **Model `EnglishWordPractice`** — `owner` FK, `word` (CharField, lowercased,
  ≤64), `fail_count`, `pass_streak`, `total_attempts`, `status`
  (`tracking`/`active`/`cleared`), `manual` (bool), `first_seen`, `last_seen`.
  `unique_together(owner, word)`. Migration `0005`. `register()` state machine
  (fail→+1 & reset streak; pass→+streak; ≥N → active; streak ≥M → cleared+reset),
  mirroring `EnglishWeakPoint`. Constants reuse `WEAKPOINT_ACTIVATE_N/CLEAR_M` (3/3).
- **Endpoints** (IsAuthenticated, owner-scoped):
  - `GET /api/english/words/` → active words.
  - `POST /api/english/words/record/` → bulk `[{word, pass, fail}]` + thresholds
    (auto-collect from shadowing).
  - `POST /api/english/words/add/` → `{word}` manual (created ACTIVE, `manual=true`).
  - `POST /api/english/words/remove/` → `{word}` delete.
- `serializers.EnglishWordPracticeSerializer` (word, fail_count, pass_streak,
  status, manual). Admin registration.
- Tests (`english/tests.py`): activate at N, clear at M, manual→active, remove,
  owner isolation, auth. (~6 tests, mirror WeakPointTest.)

## Frontend (`english-web/src`)

- **`api.ts`** — `WordPractice` type + `fetchWords`, `recordWords(deltas)`,
  `addWord(word)`, `removeWord(word)`.
- **Auto-collect** — extend `fitness/record.ts` (`recordAttempt`) to also POST the
  attempt's **wrong** words as `fail=1` deltas to `/words/record/` (fire-and-forget,
  alongside the existing phoneme deltas + streak ping). Correct-word passes come
  from the drill, not lessons (avoids flooding).
- **`words/contractions.ts`** (bundled content) — curated pairs:
  contractions (*we're/we are*, *it's/it is*, *they're/they are*, *don't/do not*,
  *I'll/I will*…) + weak/strong function words (*the*, *a*, *to*, *for*, *and*).
  Each: `{ label, forms: [{text, note}] }`.
- **`pages/WordPractice.tsx`** — "🗣️ Latihan Kata":
  - manual add input (word or short phrase);
  - list of active words → per-word **drill**: big word, ▶️ (`speakAU` en-AU),
    record → `scoreAttempt(word, transcript)` → on pass `recordWords([{word,pass:1}])`
    → refetch (clears when done); remove button;
  - **Contractions** section from `contractions.ts` — show paired forms, ▶️ each,
    practice.
- **Nav** — add "🗣️ Kata" entry in `App.tsx` header + a card on Lessons/Fitness.
- Audio: reuse `speakAU(text, rate, ...)` from `speech.ts` (browser TTS, en-AU
  preferred; falls back to any English voice with the existing UI note).

## Scoring for single words

`scoreAttempt(word, transcript)` already fuzzy-matches (LCS + fuzzball ≥85). For
one short word, keep it lenient. No scoring change.

## Testing

- **Backend**: Django tests (threshold/manual/remove/isolation/auth), test-first.
- **Frontend**: vitest for any pure helper (word normalization, wrong-word
  extraction from `AttemptScore.marks`); `tsc` + `vite build` gate; manual QA.
- No new server ML (browser TTS + existing `/transcribe/`).

## Rollout

1. Backend model + endpoints + threshold (test-first).
2. Pure helpers + contractions content (vitest).
3. api + auto-collect hook + WordPractice page + nav.
4. Deploy (migrate; build+rsync). Manual QA.

## v2 (later, not now)

Dictionary integration (dictionaryapi.dev): native-speaker audio + **IPA** shown
per word. v1 ships browser-TTS audio only.

## Open decisions (confirm at build)
- Auto-collect: also send *pass* for correctly-said practiced words in lessons, or
  only via drills? (Plan: drills only, to avoid noise.)
- Starter contraction/weak-strong list contents.
