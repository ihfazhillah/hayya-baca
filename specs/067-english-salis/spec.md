# Spec 067 — "Salis" (fluency: rhythm, accent compare, speed)

## Problem

Shadowing today only scores **which words** were said. The learner's goal is to
become **"salis"** — fluent/smooth: right **pausing/rhythm**, closer **accent**,
and a natural **speed**. Give per-attempt feedback on those three dimensions on
top of the existing word accuracy.

## Foundation

Built on Spec 065: on-device Whisper returns **word-level timestamps**
(`rec.words: {word,start,end}[]`). Timing-based features (measured pauses, WPM,
hesitation) need these. When STT falls back to the server (no timestamps), Salis
**degrades gracefully** to accuracy + static (punctuation-based) pause markers —
no crash, just fewer signals. No backend/persistence (per-attempt only, v1).

## Dimensions (the three the user prioritised)

### 1. Jeda / ritme (pausing & rhythm)
- **FR1** Show the reference text with **pause markers** derived from punctuation:
  comma/`;`/`:` → short `/`, sentence end → long `//`. Also expose a **chunked**
  (breath-group) view.
- **FR2** From `rec.words`, detect the learner's **measured pauses** (gaps between
  consecutive words above a threshold).
- **FR3** Compare measured vs expected → feedback: "should pause after «however»"
  (missed) and "don't break inside «... ...»" (paused mid-phrase). Produce a
  **pause score** (0–100).

### 2. Aksen — banding & highlight
- **FR4** Highlight mis-said words (reuse existing per-word `ScoreMarks`).
- **FR5** **Compare playback**: play the reference AU audio, then the learner's own
  recording, back-to-back, so the ear self-corrects. (Requires keeping the
  recorded blob.)
- *(Per-phoneme accent scoring stays out of scope — that's a future heavy model.)*

### 3. Kelancaran (fluency / speed)
- **FR6** From `rec.words`: **WPM** (words / spoken-duration × 60) and **hesitation**
  detection (long gaps NOT at an expected pause = filler/stall). Produce a
  **fluency score**.
- **FR7** A combined **"Salis" score** = weighted blend of accuracy + pause +
  fluency (weights tunable; default 50/25/25).

## UI

- **FR8** After a shadowing attempt (LessonPlayer; and Custom where it applies),
  show a **Salis panel**: word accuracy (existing), pause markers on the text,
  pause feedback, WPM, and the combined Salis score with a short verdict
  ("Sudah cukup salis 👍" / "Coba beri jeda di koma").
- **FR9** A **"Bandingkan"** control replays reference-then-yours.
- **FR10** When timestamps are absent (server fallback), show accuracy + static
  pause markers only, with a subtle note that rhythm/WPM needs the on-device model.

## Non-goals (v1)

- Per-phoneme pronunciation scoring (future).
- Persisting Salis history / trends (per-attempt only; could feed a future
  dashboard).
- Changing `scoring.ts` word logic.
- RN app (english-web only).

## Edge cases

- **No/short timestamps** (server fallback, ≤1 word) → skip pause/WPM, show
  accuracy + static markers.
- **Very slow/fast or empty recording** → clamp WPM; don't divide by zero.
- **Punctuation-less target** → whole thing is one chunk; no internal expected
  pauses.
- **Mismatch length** (spoken ≠ reference word count) → align on the scored marks,
  not raw indices.

## Acceptance

- Reference text shows `/`//` pause markers from punctuation.
- With device STT: attempt yields a pause score + WPM + combined Salis score, and
  concrete pause feedback tied to specific words.
- "Bandingkan" plays reference then the user's own clip.
- Server-fallback attempt still shows accuracy + markers, no errors.
- Pure logic (pauses, fluency, score, markup) unit-tested.

## Open decisions (resolve in plan.md)

- Pause threshold seconds; hesitation threshold; WPM target band for scoring.
- Salis score weights (default 50/25/25).
- Whether Custom page gets the full panel or a lite version.
