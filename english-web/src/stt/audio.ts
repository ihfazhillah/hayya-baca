import { SttFallback } from './errors'

const TARGET_RATE = 16000 // Whisper expects 16 kHz mono

/** Decode a recorded Blob (webm/opus | mp4) → 16 kHz mono Float32 PCM.
 *  Throws SttFallback if the browser can't decode → caller uses the server. */
export async function blobToPcm16k(blob: Blob): Promise<Float32Array> {
  const Ctx: typeof AudioContext | undefined =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (globalThis as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
  if (!Ctx) throw new SttFallback('Web Audio API tidak tersedia')

  const bytes = await blob.arrayBuffer()
  const ctx = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(bytes)
  } catch {
    throw new SttFallback('Gagal decode audio rekaman')
  } finally {
    void ctx.close()
  }

  if (decoded.sampleRate === TARGET_RATE && decoded.numberOfChannels === 1) {
    return decoded.getChannelData(0).slice()
  }

  // Resample (and downmix to mono) via OfflineAudioContext.
  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE))
  const off = new OfflineAudioContext(1, frames, TARGET_RATE)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start()
  const rendered = await off.startRendering()
  return rendered.getChannelData(0).slice()
}
