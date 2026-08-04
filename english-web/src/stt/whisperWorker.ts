/// <reference lib="webworker" />
/** Web Worker: runs Whisper (base.en) via transformers.js, off the UI thread.
 *  Model files are served from our own nginx (/models/), not the HF CDN. */
import {
  pipeline,
  env,
  type AutomaticSpeechRecognitionPipeline,
} from '@huggingface/transformers'

// Offline-first: resolve models from our host only.
env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = '/models/'

type Device = 'webgpu' | 'wasm'

let transcriber: AutomaticSpeechRecognitionPipeline | null = null

async function getTranscriber(device: Device) {
  if (!transcriber) {
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'whisper-base.en',
      {
        device,
        dtype: device === 'webgpu' ? 'fp16' : 'q8',
        progress_callback: (p) => self.postMessage({ type: 'progress', data: p }),
      },
    )
  }
  return transcriber
}

self.onmessage = async (e: MessageEvent) => {
  const { id, audio, device } = e.data as {
    id: number
    audio: Float32Array
    device: Device
  }
  try {
    const t = await getTranscriber(device)
    self.postMessage({ type: 'ready' })

    // Pass 1 — reliable transcript. Plain decode (no timestamps) avoids the
    // word-timestamp path that can truncate output to the first word.
    const t0 = performance.now()
    const base = await t(audio)
    const text = ((Array.isArray(base) ? base[0] : base).text ?? '').trim()
    const t1 = performance.now()

    // Pass 2 — best-effort word timestamps for Salis/pause. Never affects the
    // transcript: if word output is missing or looks truncated, drop it.
    let chunks: { text: string; timestamp: [number | null, number | null] }[] = []
    let pass2_chunks = 0
    try {
      const wOut = await t(audio, { return_timestamps: 'word' })
      const wc = (Array.isArray(wOut) ? wOut[0] : wOut).chunks ?? []
      pass2_chunks = wc.length
      const words = text ? text.split(/\s+/).length : 0
      if (wc.length >= Math.max(2, words * 0.6)) chunks = wc
    } catch {
      /* keep reliable text, no word timing */
    }
    const t2 = performance.now()

    self.postMessage({
      type: 'result',
      id,
      text,
      chunks,
      meta: {
        device,
        pass1_ms: Math.round(t1 - t0),
        pass2_ms: Math.round(t2 - t1),
        pass2_chunks,
        pass2_used: chunks.length > 0,
        audio_samples: audio.length,
      },
    })
  } catch (err) {
    self.postMessage({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
