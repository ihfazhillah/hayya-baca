/** Browser speech untuk english-web.
 *
 *  - TTS  : speechSynthesis dengan preferensi voice en-AU (hanya untuk halaman
 *           "Teks Sendiri"; audio lesson dari server sudah MeloTTS EN-AU).
 *  - STT  : TANPA webkitSpeechRecognition. Rekam via MediaRecorder, upload ke
 *           `POST /api/english/transcribe/` (faster-whisper di Django), terima
 *           transkrip. Jalan di semua browser modern termasuk Firefox.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from './api'
import { stt, type SttStatus } from './stt'
import type { Word } from './stt/backend'

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------
let cachedVoices: SpeechSynthesisVoice[] = []

function loadVoices(): SpeechSynthesisVoice[] {
  const v = window.speechSynthesis?.getVoices() ?? []
  if (v.length) cachedVoices = v
  return cachedVoices
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

export function findAussieVoice(): SpeechSynthesisVoice | null {
  const voices = loadVoices()
  const norm = (l: string) => l.replace('_', '-').toLowerCase()
  return (
    voices.find((v) => norm(v.lang) === 'en-au') ??
    voices.find((v) => norm(v.lang).startsWith('en-au')) ??
    voices.find((v) => norm(v.lang).startsWith('en')) ??
    null
  )
}

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function hasNativeAussieVoice(): boolean {
  const v = findAussieVoice()
  return !!v && v.lang.replace('_', '-').toLowerCase().startsWith('en-au')
}

export function speakAU(text: string, rate = 0.9): void {
  if (!ttsSupported()) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const voice = findAussieVoice()
  if (voice) {
    u.voice = voice
    u.lang = voice.lang
  } else {
    u.lang = 'en-AU'
  }
  u.rate = rate
  window.speechSynthesis.speak(u)
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel()
}

// ---------------------------------------------------------------------------
// STT — MediaRecorder + server-side faster-whisper
// ---------------------------------------------------------------------------
const MAX_RECORD_MS = 60_000 // hard stop; klip latihan itu pendek

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4', // Safari
  ]
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported?.(c)) return c
  }
  return ''
}

export interface EnglishRecorder {
  supported: boolean
  isRecording: boolean
  isTranscribing: boolean
  transcript: string
  /** Per-word timestamps when device STT is used (empty on server fallback). */
  words: Word[]
  error: string | null
  /** 'idle' | 'downloading' | 'ready' | 'error' — device model load progress. */
  sttStatus: SttStatus
  sttProgress: number
  start: () => Promise<void>
  /** Stop rekaman; transkrip terisi setelah transkripsi selesai. */
  stop: () => void
  reset: () => void
}

export function useEnglishRecorder(): EnglishRecorder {
  const [supported] = useState(
    () =>
      typeof window !== 'undefined' &&
      'MediaRecorder' in window &&
      !!navigator.mediaDevices?.getUserMedia,
  )
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [words, setWords] = useState<Word[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sttStatus, setSttStatus] = useState<SttStatus>('idle')
  const [sttProgress, setSttProgress] = useState(0)

  // Mirror the device-STT model status (download progress etc.) for the UI.
  useEffect(
    () =>
      stt.subscribe(() => {
        setSttStatus(stt.status)
        setSttProgress(stt.progress)
      }),
    [],
  )

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  const cleanupStream = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    recorderRef.current = null
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => cleanupStream, [cleanupStream])

  // Server STT (fallback): upload the clip to faster-whisper on Django.
  const serverTranscribe = useCallback(async (blob: Blob): Promise<string> => {
    const form = new FormData()
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
    form.append('audio', blob, `speech.${ext}`)
    const token = getToken()
    const res = await fetch('/api/english/transcribe/', {
      method: 'POST',
      headers: token ? { Authorization: `Token ${token}` } : undefined,
      body: form,
    })
    const data = (await res.json()) as { transcript?: string; detail?: string }
    if (!res.ok) throw new Error(data.detail ?? `API error ${res.status}`)
    return data.transcript ?? ''
  }, [])

  const upload = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true)
      setError(null)
      try {
        // Prefer on-device Whisper; any failure (unsupported, decode, worker)
        // falls back to the server so there is never a regression.
        if (stt.available) {
          try {
            const r = await stt.transcribe(blob)
            setTranscript(r.text)
            setWords(r.words)
            return
          } catch {
            /* fall through to server */
          }
        }
        setTranscript(await serverTranscribe(blob))
        setWords([])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal transkripsi')
      } finally {
        setIsTranscribing(false)
      }
    },
    [serverTranscribe],
  )

  const start = useCallback(async () => {
    if (!supported) {
      setError('Browser ini tidak mendukung perekaman audio.')
      return
    }
    setError(null)
    setTranscript('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickMimeType()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        setIsRecording(false)
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || 'audio/webm',
        })
        cleanupStream()
        if (blob.size > 0) void upload(blob)
      }
      recorderRef.current = rec
      rec.start()
      setIsRecording(true)
      timerRef.current = window.setTimeout(() => rec.stop(), MAX_RECORD_MS)
    } catch {
      setError('Izin mikrofon ditolak atau tidak tersedia.')
    }
  }, [supported, upload, cleanupStream])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setWords([])
    setError(null)
  }, [])

  return {
    supported,
    isRecording,
    isTranscribing,
    transcript,
    words,
    error,
    sttStatus,
    sttProgress,
    start,
    stop,
    reset,
  }
}
