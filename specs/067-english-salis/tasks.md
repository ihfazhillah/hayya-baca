# Tasks 067 — Salis (rhythm, accent compare, speed)

Frontend-only. Test-first on pure logic. Commits: `feat(english-web): …`.

## A. Pure logic (vitest, test-first)
- [ ] A1. `salis/config.ts` — thresholds + default weights in one place.
- [ ] A2. `test`: `salis/markup.test.ts` — `pauseMarkup` (`/`,`//` from punctuation),
  `chunks` (breath-groups). Then implement `salis/markup.ts`.
- [ ] A3. `test`: `salis/pauses.test.ts` — `expectedPauses` (punctuation→indices),
  `measuredPauses` (gaps≥threshold), `comparePauses` (missed/extra/score). Impl
  `salis/pauses.ts`.
- [ ] A4. `test`: `salis/fluency.test.ts` — `wpm` (guards empty/zero),
  `hesitations`, `fluencyScore` (band + penalty, clamp). Impl `salis/fluency.ts`.
- [ ] A5. `test`: `salis/score.test.ts` — `salisScore` weights + verdict thresholds
  + degenerate inputs. Impl `salis/score.ts`.

## B. Recorder + components
- [ ] B1. `speech.ts`: expose `lastRecordingUrl` (object URL of the clip; revoke on
  reset/replace). Additive to `EnglishRecorder`.
- [ ] B2. `components/PauseText.tsx` — render markup tokens + highlight mis-said
  words (from `AttemptScore.marks`).
- [ ] B3. `components/SalisPanel.tsx` — compute pause/fluency/salis, show accuracy +
  WPM + pause feedback + Salis meter + verdict + "🔁 Bandingkan" (ref→mine
  playback). Degrade when `words.length < 2`.

## C. Wiring
- [ ] C1. `LessonPlayer.tsx` shadowing → `<SalisPanel>` with segment audio (ref) +
  `rec.lastRecordingUrl` + `rec.words`.
- [ ] C2. `Custom.tsx` → lite (PauseText + Salis score; compare optional).
- [ ] C3. `tsc --noEmit` + `vite build` green.

## D. Deploy + verify
- [ ] D1. Build + rsync SPA (no backend/migration).
- [ ] D2. Manual QA checklist (below).

## Manual QA (device STT required for timing)
- [ ] Reference text shows `/` and `//` markers from punctuation.
- [ ] Shadowing attempt → Salis panel: accuracy, WPM, pause feedback tied to
  specific words, combined Salis score + verdict.
- [ ] "Bandingkan" plays reference then my recording.
- [ ] Missed pause (rushed comma) is flagged; mid-phrase break is flagged.
- [ ] Server-fallback (no timestamps) → accuracy + static markers only, note shown,
  no crash.
- [ ] Empty/1-word recording doesn't divide-by-zero or throw.

## Notes
- Timing features depend on 065 word timestamps; always degrade gracefully.
- No persistence in v1 (per-attempt). A future spec could store Salis trends.
- Keep `scoring.ts` unchanged.
