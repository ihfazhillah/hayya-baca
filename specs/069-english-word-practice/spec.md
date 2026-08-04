# Spec 069 — "Latihan Baca Kata" (per-word pronunciation practice)

## Problem

Some specific words keep tripping the learner (*We're vs We are*, *the*,
*attribution*, *issues*, *nuanced*…). They want to **practice pronouncing those
words**: hear how it's said, say it, and get feedback until it sticks. This is
the **word-level** counterpart to Fitness Lidah (Spec 066, which is phoneme-level).

MeloTTS is tuned for sentences and clips/garbles single words, so per-word audio
uses the **browser's Web Speech API (en-AU)** instead (reliable, instant, offline).

## Decisions (locked)

- **Audio v1 = Browser TTS en-AU** (`speakAU`, already used on the Custom page).
  **v2 = dictionary API** (native-speaker audio + IPA) — added later.
- **IPA / phonetic text** comes with v2 (dictionary). v1 teaches by ear (audio).
- **Scope:** auto-collected mis-said words + manual add + contraction/weak-strong
  drills.

## Functional requirements

### Word list
- **FR1** Words the learner **mis-said** in shadowing (the `wrong` marks from
  scoring) are **auto-collected** per user; a word becomes ACTIVE after ≥ N misses
  (or immediately if added manually). Cleared after M clean passes (spaced revisit).
- **FR2** Learner can **manually add** a word to practice (status ACTIVE) and
  **remove** one.
- **FR3** `GET /api/english/words/` → active practice words (owner-scoped, auth).

### Drill
- **FR4** A **Latihan Kata** page lists active words. Each opens a drill:
  - the word (big);
  - ▶️ **play** (browser TTS en-AU);
  - **record → score** against the word (`scoreAttempt(word, transcript)`), pass
    builds the streak, clearing removes it (same loop as Fitness Lidah).
- **FR5** **Contraction & weak/strong drills** — a curated set showing paired
  forms side by side with play for each: contractions (*We're ↔ We are*, *it's ↔
  it is*, *they're ↔ they are*…) and weak/strong function words (*the* /ðə/ vs
  /ðiː/, *a*, *to*, *for*). Practice each form.

### Recording (server STT)
- **FR6** Uses the existing server transcription (device STT is disabled, Spec
  065). Scoring a single word works with the same `/transcribe/` endpoint.

## Non-goals (v1)

- IPA/phonetic text (v2 with the dictionary).
- Dictionary native-speaker audio (v2).
- Per-phoneme scoring (that's Fitness Lidah's future heavy path).
- RN app.

## Edge cases

- **Browser lacks en-AU voice** (some desktop Chrome) → fall back to any English
  voice with a subtle note (same behaviour as the Custom page today).
- **One STT misfire** shouldn't auto-add a word → need ≥ N misses (like 066).
- **Very short word STT** ("the") may transcribe unreliably → generous fuzzy match
  in scoring; don't over-penalize.
- **Duplicate/normalization** — words stored lowercased, punctuation-stripped.
- **Manual add of a non-word / phrase** → allow short phrases too (e.g. "We are").

## Acceptance

- Mis-saying "attribution" a few times in shadowing → it appears in Latihan Kata.
- Opening it plays the AU pronunciation; recording it correctly enough clears it.
- Manually adding "nuanced" works; contraction drill plays both *We're* and *We are*.
- All per-account & auth-gated; a single misfire doesn't create an entry.

## Open decisions (plan.md)

- Threshold N (auto-add) / M (clear) — reuse 066's 3/3?
- Where auto-collect hooks in (extend `fitness/record.ts` to also post words).
- Curated contraction/weak-strong list (starter set).
- Whether phrases (not just single words) are allowed in v1 (lean yes).
