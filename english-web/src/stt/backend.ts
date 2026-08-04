/** Pure helpers for browser STT — no worker/model/DOM, unit-tested. */

export type SttBackend = 'webgpu' | 'wasm' | 'server'

export interface SttCaps {
  webgpu: boolean
  wasm: boolean
}

/** Choose the backend. WebGPU whisper (transformers.js/ONNX Runtime) produces
 *  garbage output ("B. C. C…") on non-trivial audio on this stack, so prefer
 *  WASM (CPU — slower but numerically stable & correct). */
export function pickBackend(caps: SttCaps): SttBackend {
  if (caps.wasm) return 'wasm'
  if (caps.webgpu) return 'webgpu'
  return 'server'
}

export interface Word {
  word: string
  start: number
  end: number
}

/** One transformers.js ASR chunk: `{ text, timestamp: [start, end] }`. */
export interface RawChunk {
  text: string
  timestamp: [number | null, number | null]
}

/** Normalize transformers.js word chunks → clean `Word[]` (drops blanks,
 *  fills missing timestamps). Foundation for Spec 066/067 pause & error work. */
export function normalizeWords(chunks: RawChunk[] | undefined): Word[] {
  if (!chunks) return []
  const out: Word[] = []
  for (const c of chunks) {
    const word = c.text.trim()
    if (!word) continue
    const start = c.timestamp?.[0] ?? 0
    const end = c.timestamp?.[1] ?? start
    out.push({ word, start, end })
  }
  return out
}
