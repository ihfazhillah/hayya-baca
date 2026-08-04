# Spec 065 — English STT in the browser (Whisper base.en ONNX)

## Problem

Shadowing/dictation scoring ("penilaian tiruan") uploads the learner's recording
to `POST /api/english/transcribe/` where **faster-whisper runs on the server**.
On the 2 GB production box (shared with gunicorn + the MeloTTS worker) this takes
several seconds per utterance and gets much worse under load. It doesn't scale and
contradicts the app's offline-first philosophy.

**Move STT to the device**: run Whisper in the browser via ONNX, so scoring is
local, fast, offline-capable, and puts zero load on the server.

## Decision (locked)

- Model: **`whisper-base.en`** (English-only) — NOT tiny. Accuracy over download
  size; ~145 MB, downloaded once then cached on-device.
- Runtime: **transformers.js** (`@huggingface/transformers`) over
  `onnxruntime-web` (WASM; WebGPU when available), running in a **Web Worker**.

## Scope

`english-web` only. The RN app keeps using the server endpoint (out of scope).

## Functional requirements

- **FR1** Recording → transcript happens **in-browser** (no upload) for
  shadowing & dictation scoring, in a Web Worker so the UI never freezes.
- **FR2** First use downloads + caches the model (transformers.js browser cache);
  subsequent loads are instant/offline. Show a one-time **download progress** UI.
- **FR3** The transcriber also returns **word-level timestamps**
  (`return_timestamps: 'word'`) — foundation for later "Salis"/pause features
  (Spec 067) and error tracking (Spec 066).
- **FR4** **Fallback to the server** (`/api/english/transcribe/`) when: the browser
  lacks support, model load fails, or the model isn't cached yet AND the device is
  offline is NOT the case (i.e. online-but-first-time may either download or fall
  back — see edge cases). No regression vs today.
- **FR5** Model files are **self-hosted** on nginx (e.g. `/models/whisper-base.en/`)
  instead of the HuggingFace CDN, to stay offline-first and dependency-free.
- **FR6** Scoring logic (`scoring.ts` LCS + fuzzball) is unchanged — only the
  transcript **source** changes. Scores stay comparable.

## Non-goals

- RN app STT (stays server-side).
- Phoneme-level recognition (words only).
- Streaming/partial transcription (batch per utterance is enough).

## Edge cases

- **No WebGPU** → WASM (slower but works). Threads via SIMD/COOP-COEP if enabled.
- **Model not cached + offline** → fall back to server if reachable; else clear
  "perlu online sekali untuk unduh model suara" message.
- **Model download fails / corrupt** → fall back to server, retry cache later.
- **Very long recording** → cap duration (e.g. 30s) before transcription.
- **Low-end phone** → base.en may take a few seconds; show a spinner, still local.
- **COOP/COEP headers** — WASM threads need cross-origin isolation; nginx must send
  `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy:
  require-corp` on the SPA (verify it doesn't break other embeds).

## Acceptance

- After a one-time model download, shadowing scoring works with **no network
  round-trip** (verify in devtools) and offline.
- Transcript quality ≈ current server `base`; scores comparable on the same clip.
- Fallback path returns identical behaviour to today when the browser can't run
  the model.
- Word timestamps are available in the transcriber output.

## Open decisions (resolve in plan.md)

- Exact nginx COOP/COEP rollout (only on english site) + model hosting path.
- Whether to also expose an on-screen "STT: device/server" indicator for debugging.
