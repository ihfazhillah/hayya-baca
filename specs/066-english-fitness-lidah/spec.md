# Spec 066 — "Fitness Lidah" (targeted articulation drills)

## Problem

When a learner keeps mispronouncing the same words/sounds ("salah terus"), plain
shadowing doesn't fix it. We want the app to **notice repeated errors and route
the learner into targeted articulation drills** — a "tongue gym" that trains the
specific weak sound until it improves. This directly serves the "salis" goal by
removing the learner's recurring failure points.

## Prerequisites (important)

- **Spec 065** (reliable in-browser per-word scoring + word timestamps).
- **NEW: attempt-history persistence** — today scoring is ephemeral (per attempt,
  discarded). Fitness Lidah needs errors recorded **across sessions** to detect
  "salah terus". This persistence layer is built as part of this spec.
- **Word → phoneme mapping** to drill the right *sound*, not just the word (the
  MeloTTS/g2p stack already turns text into phonemes server-side; reuse it).

## Actors

- Logged-in learner (guardian account now; child later — same ownership model as
  Spec 064).

## Functional requirements

### Error tracking
- **FR1** Each shadowing/dictation attempt records, per word, whether it was said
  correctly (from `scoring.ts` output) — stored per user (owner), auth-gated.
- **FR2** Aggregate per user: a word/phoneme becomes a **weak point** when it fails
  **≥ N times** (threshold configurable; default TBD in plan).
- **FR3** Map failed words → target **phonemes** (server g2p) so drills group by
  sound (e.g. `θ` "th", `r`/`l`), not by individual word.

### Drills
- **FR4** A **"Fitness Lidah"** section lists the learner's current weak sounds and
  offers drills per sound:
  - **Minimal pairs** (e.g. *think/sink*, *light/right*) — train the contrast.
  - **Slow → fast repetition** of target words.
  - **Tongue twisters** focused on the sound.
  - Short **mouth/tongue-position tip** per phoneme.
- **FR5** A drill uses the same record → (browser) STT → score loop; success on the
  target sound **reduces** its weakness score.
- **FR6** **Spaced revisit**: a weak sound stays in the queue and resurfaces until
  the learner passes it consistently (simple interval logic, not a full SRS).

### Content
- **FR7** A small curated **drill content set** per target phoneme (minimal-pair
  lists + tongue twisters + tips), bundled/served like other content. Start with
  the handful of phonemes that trip Indonesian speakers of English most (e.g. `θ/ð`
  "th", `v/f`, `r/l`, final consonants).

## Non-goals (v1)

- True phoneme-level ASR scoring (we approximate the target sound from word errors
  + g2p; not a pronunciation-assessment model).
- Full spaced-repetition scheduling algorithm (keep interval logic simple).
- Auto-generating drill content (curated set first).

## Edge cases

- **Not enough data** → no weak points yet; hide the section or show "latih dulu".
- **Word not in g2p / OOV** → skip phoneme grouping, keep as word-level weak point.
- **Improvement detection** — define "passed": e.g. target word correct M times in
  a row → drop from queue (M in plan).
- **False errors from STT** (base.en mishears) → require repeats before flagging, so
  one bad recognition doesn't create a phantom weak point.
- **Privacy** — error history is personal; owner-only, never public.

## Acceptance

- After failing "think" (θ) several times across attempts, a **"th" drill** appears
  in Fitness Lidah with minimal pairs + a tongue twister.
- Completing the drill and saying the target correctly enough times **removes** the
  sound from the queue.
- A single STT misfire does NOT create a weak point (needs repeated failures).
- All history is per-account and auth-gated.

## Open decisions (resolve in plan.md)

- Data model shape: raw `Attempt` rows vs aggregated `WordError`/`PhonemeError`
  counters per user (leaning aggregated for simplicity + privacy).
- Thresholds: N (fails → weak point), M (passes → cleared), revisit interval.
- Where phoneme mapping runs (server endpoint vs bundled dict) given STT is moving
  to the browser in Spec 065.
- Initial phoneme set + who curates the drill content.
