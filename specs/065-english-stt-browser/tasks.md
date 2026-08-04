# Tasks 065 — STT in the browser (Whisper base.en)

Test-first on the pure modules. Commits: `feat(english-web): …` / `test(english-web): …`.

## A. Setup + pure logic (test-first)
- [ ] A1. Add deps: `@huggingface/transformers`; add **vitest** + config to
  `english-web` (first test runner here). `npm run test` script.
- [ ] A2. `test(english-web)`: `stt/backend.test.ts` — `pickBackend`
  (webgpu→'webgpu', wasm-only→'wasm', none→'server') + `normalizeWords`
  (chunks→words, missing/degenerate timestamps, empty). **Write failing first.**
- [ ] A3. Implement `stt/backend.ts` (`pickBackend`, `normalizeWords`) → A2 green.
- [ ] A4. `stt/audio.ts`: `blobToPcm16k` (decodeAudioData + OfflineAudioContext
  resample to 16 kHz mono). Guard unsupported decode → throw `SttFallback`.

## B. Worker + manager
- [ ] B1. `stt/whisperWorker.ts`: build ASR pipeline lazily (device/dtype from
  message), `progress_callback` → postMessage, transcribe Float32 →
  `{text, chunks}` with word timestamps.
- [ ] B2. `stt/index.ts` manager: spawn worker on first use, `status`/`progress`,
  `transcribe(blob)` = decode → worker → `normalizeWords`; throw `SttFallback` on
  unsupported/error. transformers.js `env` → local `/models/`.
- [ ] B3. `SttFallback` error type + capability probe (navigator.gpu / WASM).

## C. Integration + UI (no regression)
- [ ] C1. `speech.ts`: `upload()` tries `stt.transcribe`; on `SttFallback`/error →
  existing server `fetch`. Expose `sttStatus`, `sttProgress`. Keep server path.
- [ ] C2. `LessonPlayer.tsx` + `Custom.tsx`: one-time "Mengunduh model suara… %"
  indicator while downloading; otherwise unchanged UX.
- [ ] C3. `tsc --noEmit` + `vite build` green (worker + dynamic import).

## D. Model hosting + nginx + deploy
- [ ] D1. Script `scripts/fetch-whisper-model.sh` — download `Xenova/whisper-base.en`
  files into `english-web/models/whisper-base.en/` (gitignored) and rsync to
  server `/home/ihfazh/english-web/models/`.
- [ ] D2. `deploy/english.nginx.conf` + server: `location /models/` (alias, immutable
  cache, wasm/onnx MIME). `nginx -t` + reload.
- [ ] D3. Configure transformers.js `env.localModelPath='/models/'`,
  `allowRemoteModels=false`; verify model resolves from our host (devtools:
  requests hit `/models/…`, not huggingface.co).

## E. Verify
- [ ] E1. Manual QA checklist (below).
- [ ] E2. Confirm server load drop: shadowing scoring makes **no** `/transcribe/`
  call once model cached (devtools network).

## Manual QA checklist
- [ ] First shadowing on a fresh browser → shows download %, then transcribes.
- [ ] Reload / go offline → transcribes locally, no network.
- [ ] Transcript & score ≈ server `base` on the same clip.
- [ ] WebGPU browser uses webgpu; non-WebGPU uses WASM; both work.
- [ ] Disable device STT (simulate unsupported) → server fallback identical to today.
- [ ] Word timestamps present in result (foundation for 066/067).
- [ ] Dictation + shadowing both scored correctly.

## Notes
- COOP/COEP deferred (WebGPU needs none; WASM single-thread needs none). Revisit
  only if WASM latency is unacceptable → then add cross-origin isolation on the SPA.
- Keep `scoring.ts` unchanged — only the transcript source changes.
- RN app out of scope (stays on server transcribe).
