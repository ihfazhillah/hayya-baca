# Plan 067 — implementation (Salis)

Frontend-only (`english-web`). No backend, no migration, no new server load.
Deploy = build + rsync. Depends on Spec 065 word timestamps (`rec.words`).

## New files (`english-web/src/salis/`) — all pure, vitest-first

- **`markup.ts`** — `pauseMarkup(target): Token[]` where a token is a word or a
  pause mark (`/` short, `//` long) derived from punctuation; `chunks(target):
  string[]` breath-groups (split at `,;:` and coordinating conjunctions). No
  timestamps needed → always available.
- **`pauses.ts`**
  - `expectedPauses(target): {afterWordIndex:number, strength:'short'|'long'}[]`
    from punctuation (index into the target's normalized words).
  - `measuredPauses(words: Word[], gap=PAUSE_GAP_S): {afterWordIndex, dur}[]` —
    gaps between consecutive words ≥ threshold.
  - `comparePauses(expected, measured, wordCount): {missed:number[], extra:number[],
    score:number}` — missed = expected pause not observed; extra = observed pause
    where none expected (mid-phrase break). Score = 100·(matched / expected+extra),
    clamped.
- **`fluency.ts`**
  - `wpm(words): number` — `words.length / (last.end - first.start) × 60`, guard
    empty/zero.
  - `hesitations(words, expectedPauses): number` — long gaps NOT at an expected
    pause index.
  - `fluencyScore(wpm, hesitations): number` — bell around a target WPM band
    (default 90–150) minus a hesitation penalty; clamp 0–100.
- **`score.ts`** — `salisScore({accuracy, pause, fluency}, weights=DEFAULT)`:
  weighted blend (default `{accuracy:0.5, pause:0.25, fluency:0.25}`) → `{score,
  verdict}` (verdict thresholds → Indonesian copy).
- **`config.ts`** — thresholds in one place: `PAUSE_GAP_S=0.3`, `HESITATION_S=0.6`,
  `WPM_MIN=90`, `WPM_MAX=150`, default weights.

## Recorder change (`speech.ts`)

- Keep the recorded Blob → expose `lastRecordingUrl: string | null` (an object URL,
  revoked/replaced per attempt) so the UI can replay for A/B compare. `words` and
  `sttStatus` already exposed (065). Small, additive.

## Components (`english-web/src`)

- **`components/PauseText.tsx`** — render `pauseMarkup` tokens (words + `/`,`//`
  marks styled), with mis-said words highlighted (map from `AttemptScore.marks`).
- **`components/SalisPanel.tsx`** — given `{score: AttemptScore, words, target,
  refAudioUrl, myAudioUrl}`: computes pause/fluency/salis (via salis/*), shows
  accuracy, WPM, pause feedback list, combined Salis meter + verdict, and a
  **"🔁 Bandingkan"** button (play ref audio → onended → play my recording).
  Degrades: if `words.length < 2` → hide WPM/pause-measured, show markers + note.

## Wiring

- **`LessonPlayer.tsx`** (shadowing): after scoring, render `<SalisPanel>` with the
  segment audio URL (ref) + `rec.lastRecordingUrl` (mine) + `rec.words`. Dictation
  mode keeps just `ScoreMarks` (no speech).
- **`Custom.tsx`**: lite — `PauseText` + Salis score (ref audio is browser TTS, so
  compare-playback is optional/omitted there).

## scoring.ts touchpoint

Reuse `AttemptScore.marks` for accuracy% and per-word highlight. Add a tiny helper
`okFlagsFromMarks(marks)` (shared with 066's record.ts if handy). No scoring change.

## Testing

- **Vitest** (pure, test-first): `markup` (markers + chunks), `pauses`
  (expected from punctuation, measured from gaps, compare missed/extra/score),
  `fluency` (wpm guards, hesitation count, score band), `score` (weights + verdict
  thresholds, degenerate inputs).
- **Build/tsc** gate. **Manual QA**: needs device STT (timestamps) — checklist.
- No backend tests (no backend change).

## Rollout

1. salis/* pure modules + vitest (test-first).
2. `speech.ts` lastRecordingUrl; `PauseText` + `SalisPanel`.
3. Wire LessonPlayer (+ Custom lite). tsc/build.
4. Deploy: build + rsync. Manual QA (device STT on).

## Open decisions (confirm)
- Thresholds `PAUSE_GAP_S`, `HESITATION_S`, WPM band, weights — start with defaults
  above, tune after dogfooding.
- Custom page: full panel vs lite (plan = lite).
