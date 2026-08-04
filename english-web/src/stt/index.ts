import { blobToPcm16k } from './audio'
import { normalizeWords, pickBackend, type RawChunk, type Word } from './backend'
import { SttFallback } from './errors'

export type SttStatus = 'idle' | 'downloading' | 'ready' | 'error'
export interface SttResult {
  text: string
  words: Word[]
  meta: Record<string, unknown>
}

export { SttFallback }

function detectCaps() {
  return {
    webgpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
    wasm: typeof WebAssembly !== 'undefined',
  }
}

type Pending = {
  resolve: (r: {
    text: string
    chunks: RawChunk[]
    meta: Record<string, unknown>
  }) => void
  reject: (e: unknown) => void
}

/** Singleton that owns the Whisper worker and exposes a simple transcribe API
 *  with progress + graceful fallback (throws SttFallback when unusable). */
class SttManager {
  status: SttStatus = 'idle'
  progress = 0
  readonly backend = pickBackend(detectCaps())

  private worker: Worker | null = null
  private seq = 0
  private pending = new Map<number, Pending>()
  private listeners = new Set<() => void>()

  /** True when a device backend is usable (else callers should use the server). */
  get available(): boolean {
    return this.backend !== 'server'
  }

  /** Preload + compile the model early (fire-and-forget) so the first real
   *  transcription isn't a cold ~20s start. Safe to call repeatedly. */
  warm(): void {
    if (this.backend === 'server') return
    const worker = this.ensureWorker()
    worker.postMessage({ type: 'warm', device: this.backend })
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(status?: SttStatus, progress?: number) {
    if (status) this.status = status
    if (progress !== undefined) this.progress = progress
    this.listeners.forEach((fn) => fn())
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./whisperWorker.ts', import.meta.url), {
        type: 'module',
      })
      this.worker.onmessage = (e) => this.onMessage(e.data)
      this.worker.onerror = () => this.failAll('worker error')
      if (this.status === 'idle') this.emit('downloading', 0)
    }
    return this.worker
  }

  private onMessage(msg: {
    type: string
    id?: number
    text?: string
    chunks?: RawChunk[]
    meta?: Record<string, unknown>
    message?: string
    data?: { progress?: number; status?: string }
  }) {
    if (msg.type === 'progress') {
      if (typeof msg.data?.progress === 'number') {
        this.emit('downloading', Math.round(msg.data.progress))
      }
    } else if (msg.type === 'ready') {
      this.emit('ready', 100)
    } else if (msg.type === 'result' && msg.id != null) {
      this.pending
        .get(msg.id)
        ?.resolve({ text: msg.text ?? '', chunks: msg.chunks ?? [], meta: msg.meta ?? {} })
      this.pending.delete(msg.id)
    } else if (msg.type === 'error' && msg.id != null) {
      this.pending.get(msg.id)?.reject(new Error(msg.message ?? 'STT error'))
      this.pending.delete(msg.id)
    }
  }

  private failAll(reason: string) {
    this.emit('error')
    this.pending.forEach((p) => p.reject(new SttFallback(reason)))
    this.pending.clear()
    this.worker?.terminate()
    this.worker = null
  }

  async transcribe(blob: Blob): Promise<SttResult> {
    if (this.backend === 'server') {
      throw new SttFallback('device STT tidak didukung')
    }
    const audio = await blobToPcm16k(blob) // throws SttFallback on decode failure

    // Diagnostic: is the decoded PCM silent after the first bit? (webm decode
    // corruption would leave the tail near-zero → whisper only sees the start.)
    const rms = (s: number, e: number) => {
      let x = 0
      for (let i = s; i < e; i++) x += audio[i] * audio[i]
      return Math.sqrt(x / Math.max(1, e - s))
    }
    const half = Math.floor(audio.length / 2)
    const rmsHead = +rms(0, half).toFixed(4)
    const rmsTail = +rms(half, audio.length).toFixed(4)

    const worker = this.ensureWorker()
    const id = ++this.seq
    const raw = await new Promise<{
      text: string
      chunks: RawChunk[]
      meta: Record<string, unknown>
    }>((resolve, reject) => {
      // A hung model call must never freeze the UI — time out → server fallback.
      // Generous: the FIRST inference includes WebGPU shader compilation (cold
      // start can take ~15-25s); warm calls are ~1-2s.
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new SttFallback('device STT timeout'))
        }
      }, 45_000)
      const done = <T>(fn: (v: T) => void) => (v: T) => {
        clearTimeout(timer)
        fn(v)
      }
      this.pending.set(id, { resolve: done(resolve), reject: done(reject) })
      worker.postMessage({ id, audio, device: this.backend })
    })
    if (this.status !== 'ready') this.emit('ready', 100)
    return {
      text: raw.text.trim(),
      words: normalizeWords(raw.chunks),
      meta: {
        backend: this.backend,
        blob_size: blob.size,
        blob_type: blob.type,
        pcm_samples: audio.length,
        pcm_dur_s: +(audio.length / 16000).toFixed(2),
        rms_head: rmsHead,
        rms_tail: rmsTail,
        ...raw.meta,
      },
    }
  }
}

export const stt = new SttManager()
