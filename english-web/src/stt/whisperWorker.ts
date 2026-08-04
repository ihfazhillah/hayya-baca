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
        // fp16 decoder truncates on WebGPU; the stable combo (per the official
        // transformers.js whisper-webgpu demo) is fp16 encoder + q4 decoder.
        dtype:
          device === 'webgpu'
            ? { encoder_model: 'fp16', decoder_model_merged: 'q4' }
            : { encoder_model: 'q8', decoder_model_merged: 'q4' },
        progress_callback: (p) => self.postMessage({ type: 'progress', data: p }),
      },
    )
  }
  return transcriber
}

self.onmessage = async (e: MessageEvent) => {
  // Warm-up: load + compile the model (1s of silence triggers WebGPU shader
  // compilation) so the first real transcription is fast, not a cold ~20s.
  if (e.data?.type === 'warm') {
    try {
      const t = await getTranscriber(e.data.device as Device)
      await t(new Float32Array(16000))
      self.postMessage({ type: 'ready' })
    } catch (err) {
      self.postMessage({
        type: 'warm_error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }

  const { id, audio, device } = e.data as {
    id: number
    audio: Float32Array
    device: Device
  }
  try {
    const t = await getTranscriber(device)
    self.postMessage({ type: 'ready' })

    // Single plain decode — reliable text. (Word timestamps caused truncation
    // AND a hang, so they're dropped for now; Salis degrades gracefully.)
    const t0 = performance.now()
    const base = await t(audio)
    const single = Array.isArray(base) ? base[0] : base
    const text = (single.text ?? '').trim()
    const t1 = performance.now()

    self.postMessage({
      type: 'result',
      id,
      text,
      chunks: [],
      meta: {
        device,
        pass1_ms: Math.round(t1 - t0),
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
