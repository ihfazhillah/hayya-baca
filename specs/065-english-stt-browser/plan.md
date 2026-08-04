# Plan 065 — implementation (STT in the browser)

## Architecture

```
LessonPlayer / Custom (shadowing, dictation)
        │  rec.stop() → Blob (webm/opus | mp4)
        ▼
useEnglishRecorder (speech.ts)
        │  try device STT ───────────────► src/stt/index.ts (manager)
        │                                     │  decode+resample → Float32 16k mono
        │                                     ▼
        │                              Web Worker (whisperWorker.ts)
        │                              transformers.js pipeline
        │                              'automatic-speech-recognition'
        │                              whisper-base.en  (WebGPU → else WASM)
        │                              model files ← nginx /models/whisper-base.en/
        │  ◄── {text, words:[{word,start,end}]}
        │
        └─ on unsupported / load-fail / not-cached-offline
              └──► fallback: POST /api/english/transcribe/  (existing server path)
```

Same-origin, offline-first: model served by our nginx, cached in-browser by
transformers.js after first load.

## New / changed files (`english-web/src`)

- **`stt/whisperWorker.ts`** (new) — Web Worker. Lazily builds the ASR pipeline
  (`pipeline('automatic-speech-recognition', 'whisper-base.en', {device, dtype})`),
  forwards `progress_callback` messages, transcribes a Float32Array →
  `{ text, chunks }` with `return_timestamps: 'word'`.
- **`stt/audio.ts`** (new, pure) — `blobToPcm16k(blob): Promise<Float32Array>` via
  `AudioContext.decodeAudioData` + `OfflineAudioContext` resample to 16 kHz mono.
- **`stt/backend.ts`** (new, pure) — `pickBackend(caps): 'webgpu'|'wasm'|'server'`
  and `normalizeWords(chunks): Word[]`. Pure → unit-testable without a worker.
- **`stt/index.ts`** (new) — manager singleton: spawns the worker on first use,
  tracks `status: 'idle'|'downloading'|'ready'|'error'` + `progress`, exposes
  `transcribe(blob): Promise<{text, words}>`. Throws `SttFallback` on
  unsupported/error so callers fall back to the server.
- **`config.ts`** (new) or top of `stt/index.ts` — transformers.js `env` setup:
  `env.allowRemoteModels=false; env.allowLocalModels=true; env.localModelPath='/models/';`
  WASM paths pointed at our hosted `/models/ort/` if needed.
- **`speech.ts`** (change) — `useEnglishRecorder.upload()`: try `stt.transcribe`;
  on `SttFallback`/any error → existing `fetch('/api/english/transcribe/')`. Expose
  `sttStatus` + `sttProgress` for UI. Keep the FormData server path intact.
- **`pages/LessonPlayer.tsx` / `pages/Custom.tsx`** (small) — show a one-time
  "⏬ Mengunduh model suara… {progress}%" note while `sttStatus==='downloading'`.

## transformers.js / runtime choices

- Prefer **WebGPU** (`device:'webgpu'`, `dtype:'q4'|'fp16'`) when `navigator.gpu`
  exists → fast, and **no COOP/COEP needed**. Else **WASM** single-thread
  (`device:'wasm'`, `dtype:'q8'`) — slower but works everywhere, still no special
  headers. → **Defer COOP/COEP entirely in v1** (only needed for multi-thread WASM);
  revisit only if WASM speed is unacceptable.
- Model id `whisper-base.en`; resolved locally from `/models/whisper-base.en/`.

## Model self-hosting (deploy)

- Mirror `Xenova/whisper-base.en` files (config.json, tokenizer.json,
  preprocessor_config.json, `onnx/encoder_model_quantized.onnx`,
  `onnx/decoder_model_merged_quantized.onnx`, etc.) to the server at
  `/home/ihfazh/english-web/models/whisper-base.en/`.
- Also host the onnxruntime-web `.wasm`/`.mjs` if we choose to self-host ORT
  assets (`/models/ort/`); otherwise let Vite bundle them from the npm package.
- **nginx** (`deploy/english.nginx.conf` + server): add
  ```
  location /models/ {
      alias /home/ihfazh/english-web/models/;
      add_header Cache-Control "public, max-age=31536000, immutable";
      types { application/wasm wasm; application/octet-stream onnx; }
  }
  ```
- Deploy step fetches the model once (script) so git stays lean (no 145 MB blobs).

## Fallback & no-regression

- `pickBackend` returns `'server'` when neither WebGPU nor WASM is usable → manager
  immediately signals fallback; `speech.ts` uses the current server endpoint.
- Any worker/model error at runtime → catch → same server fallback. The server
  `/api/english/transcribe/` stays exactly as today (still `IsAuthenticated`).

## Testing

- **Vitest (new, minimal)** for the **pure** modules only — no worker/model needed:
  - `backend.ts`: `pickBackend` matrix (webgpu / wasm / none→server);
    `normalizeWords` maps transformers chunks → `{word,start,end}` incl. edge cases
    (missing timestamps, empty).
  - This is the test-first surface (write failing first).
- **Vite build + `tsc --noEmit`** gate as today (worker + dynamic import compile).
- **Manual QA** (real model can't run in CI): checklist in tasks.md — first-load
  download %, offline re-use, transcript parity vs server, fallback on a browser
  with WebGPU/WASM disabled, no network call in devtools after cache.
- RN untouched.

## Rollout order

1. Pure logic + vitest (backend.ts, audio.ts) — test-first.
2. Worker + manager + speech.ts integration behind fallback (device path off by
   default until model hosted).
3. Host model on server + nginx `/models/` + deploy.
4. Flip device STT on; manual QA; keep server fallback.
