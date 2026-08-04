import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchLesson, type LessonDetail } from '../api'
import { scoreAttempt, type AttemptScore } from '../scoring'
import { useEnglishRecorder } from '../speech'
import { ScoreMarks } from '../components/ScoreMarks'
import { SalisPanel } from '../components/SalisPanel'
import { recordAttempt } from '../fitness/record'

type Mode = 'listen' | 'dictation' | 'shadowing'

const MODES: { key: Mode; label: string }[] = [
  { key: 'listen', label: '🎧 Dengar' },
  { key: 'dictation', label: '✍️ Dikte' },
  { key: 'shadowing', label: '🎤 Shadowing' },
]

export function LessonPlayer() {
  const { id } = useParams<{ id: string }>()
  const [lesson, setLesson] = useState<LessonDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('listen')
  const [showText, setShowText] = useState(false)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<AttemptScore | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rec = useEnglishRecorder()

  useEffect(() => {
    if (!id) return
    let alive = true
    let t: ReturnType<typeof setTimeout> | null = null
    const load = () => {
      fetchLesson(id)
        .then((l) => {
          if (!alive) return
          setLesson(l)
          // Poll while the MeloTTS worker is still generating audio.
          if (l.audio_status === 'pending' || l.audio_status === 'processing') {
            t = setTimeout(load, 4000)
          }
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Gagal memuat'),
        )
    }
    load()
    return () => {
      alive = false
      if (t) clearTimeout(t)
    }
  }, [id])

  const segment = lesson?.segments[index]

  const resetSegmentState = () => {
    setShowText(false)
    setTyped('')
    setResult(null)
    rec.reset()
  }

  const goto = (next: number) => {
    if (!lesson) return
    setIndex(Math.max(0, Math.min(lesson.segments.length - 1, next)))
    resetSegmentState()
  }

  useEffect(() => {
    if (mode === 'shadowing' && rec.transcript && segment) {
      const s = scoreAttempt(segment.text, rec.transcript)
      setResult(s)
      recordAttempt(s)
      setShowText(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.transcript])

  if (error) return <p className="text-red-500">{error}</p>
  if (!lesson) return <p className="text-gray-500">Memuat…</p>

  if (lesson.audio_status !== 'ready') {
    return (
      <div>
        <h2 className="text-xl font-extrabold text-gray-800">{lesson.title}</h2>
        {lesson.audio_status === 'failed' ? (
          <div className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">
            <p className="font-semibold">⚠️ Gagal membuat audio.</p>
            {lesson.is_owner && lesson.error && (
              <p className="mt-1 text-sm">{lesson.error}</p>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-700">
            <p className="font-semibold">⏳ Audio sedang dibuat di server…</p>
            <p className="mt-1 text-sm">
              Aksen Australia disintesis per kalimat. Halaman ini akan otomatis
              diperbarui saat siap.
            </p>
          </div>
        )}
      </div>
    )
  }

  if (!segment) return <p className="text-gray-500">Memuat…</p>

  return (
    <div>
      <h2 className="text-xl font-extrabold text-gray-800">{lesson.title}</h2>
      <p className="mb-3 text-sm text-gray-500">
        Segmen {index + 1} / {lesson.segments.length}
      </p>

      <audio
        ref={audioRef}
        key={segment.id}
        controls
        src={segment.audio_url ?? undefined}
        className="w-full"
      />

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => goto(index - 1)}
          disabled={index === 0}
          className="flex-1 rounded-lg bg-white p-2.5 font-semibold text-gray-700 shadow-sm disabled:opacity-40"
        >
          ← Sebelumnya
        </button>
        <button
          onClick={() => goto(index + 1)}
          disabled={index >= lesson.segments.length - 1}
          className="flex-1 rounded-lg bg-white p-2.5 font-semibold text-gray-700 shadow-sm disabled:opacity-40"
        >
          Berikutnya →
        </button>
      </div>

      <div className="my-4 flex gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => {
              setMode(m.key)
              setResult(null)
              rec.reset()
            }}
            className={
              'flex-1 rounded-full py-2 text-sm transition ' +
              (mode === m.key
                ? 'bg-emerald-500 font-bold text-white'
                : 'bg-white text-gray-600 shadow-sm')
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'listen' && (
        <button
          onClick={() => setShowText((s) => !s)}
          className="font-semibold text-[#6C5CE7]"
        >
          {showText ? 'Sembunyikan teks' : 'Tampilkan teks'}
        </button>
      )}

      {mode === 'dictation' && (
        <div>
          <textarea
            className="min-h-20 w-full rounded-xl border-0 bg-white p-3 shadow-sm outline-none focus:ring-2 focus:ring-[#6C5CE7]"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Ketik yang kamu dengar…"
          />
          <button
            onClick={() => {
              const s = scoreAttempt(segment.text, typed)
              setResult(s)
              recordAttempt(s)
              setShowText(true)
            }}
            className="mt-2 w-full rounded-xl bg-emerald-500 p-3 font-bold text-white shadow hover:bg-emerald-600"
          >
            ✅ Periksa
          </button>
        </div>
      )}

      {mode === 'shadowing' && (
        <div>
          {!rec.supported ? (
            <p className="text-amber-600">
              Browser ini tidak mendukung perekaman audio.
            </p>
          ) : rec.isTranscribing ? (
            <button
              disabled
              className="w-full rounded-xl bg-gray-400 p-3 font-bold text-white shadow"
            >
              ⏳ Menilai tiruanmu…
            </button>
          ) : !rec.isRecording ? (
            <button
              onClick={() => {
                audioRef.current?.pause()
                setResult(null)
                void rec.start()
              }}
              className="w-full rounded-xl bg-red-500 p-3 font-bold text-white shadow hover:bg-red-600"
            >
              ● Rekam Tiruanmu
            </button>
          ) : (
            <button
              onClick={rec.stop}
              className="w-full rounded-xl bg-emerald-500 p-3 font-bold text-white shadow hover:bg-emerald-600"
            >
              ■ Selesai &amp; Nilai
            </button>
          )}
          {rec.sttStatus === 'downloading' && (
            <p className="mt-2 text-sm text-[#6C5CE7]">
              ⏬ Mengunduh model suara (sekali saja)… {rec.sttProgress}%
            </p>
          )}
          {rec.transcript && (
            <p className="mt-3 italic text-gray-500">
              Terdengar: “{rec.transcript}”
            </p>
          )}
          {rec.error && <p className="mt-2 text-red-500">{rec.error}</p>}
        </div>
      )}

      {result &&
        (mode === 'shadowing' ? (
          <SalisPanel
            score={result}
            target={segment.text}
            words={rec.words}
            refAudioUrl={segment.audio_url}
            myAudioUrl={rec.lastRecordingUrl}
          />
        ) : (
          <ScoreMarks result={result} />
        ))}

      {showText && !(mode === 'shadowing' && result) && (
        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs text-gray-500">Teks asli:</p>
          <p className="text-lg leading-relaxed text-gray-800">{segment.text}</p>
        </div>
      )}
    </div>
  )
}
