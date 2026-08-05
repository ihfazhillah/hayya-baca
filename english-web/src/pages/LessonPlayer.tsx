import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  addWord,
  fetchLesson,
  fetchProgress,
  lookupWord,
  saveProgress,
  type LessonDetail,
  type Segment,
} from '../api'
import { scoreAttempt, type AttemptScore } from '../scoring'
import { speakAU, useEnglishRecorder } from '../speech'
import { SalisPanel } from '../components/SalisPanel'
import { recordAttempt } from '../fitness/record'

const normWord = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '')

// ---- word pronunciation popover -------------------------------------------
interface PopState {
  word: string
  x: number
  y: number
}

function WordPopover({ pop, onClose }: { pop: PopState; onClose: () => void }) {
  const [ipa, setIpa] = useState('')
  const [audio, setAudio] = useState('')
  const [added, setAdded] = useState(false)
  const key = normWord(pop.word)

  useEffect(() => {
    setIpa('')
    setAudio('')
    setAdded(false)
    let alive = true
    lookupWord(key)
      .then((d) => {
        if (!alive) return
        setIpa(d.ipa)
        setAudio(d.audio)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [key])

  const left = Math.max(10, Math.min(pop.x - 110, window.innerWidth - 240))
  const top = Math.min(pop.y + 12, window.innerHeight - 190)

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-56 rounded-2xl border border-violet-100 bg-white p-3 shadow-xl"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-extrabold text-gray-800">{pop.word}</p>
        <p className="mb-2 text-sm text-gray-400">{ipa ? `/${ipa}/` : '…'}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => speakAU(key)}
            className="rounded-lg bg-[#6C5CE7] px-2.5 py-1.5 text-sm font-bold text-white"
          >
            ▶️ TTS
          </button>
          {audio && (
            <button
              onClick={() => void new Audio(audio).play()}
              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-sm font-bold text-white"
            >
              🔊 Asli
            </button>
          )}
        </div>
        <button
          onClick={() => {
            void addWord(key).catch(() => {})
            setAdded(true)
          }}
          className={
            'mt-2 w-full rounded-lg border border-dashed border-[#6C5CE7] p-2 text-sm font-bold text-[#6C5CE7] ' +
            (added ? 'border-solid bg-violet-50' : '')
          }
        >
          {added ? '✓ Ada di Latihan Kata' : '➕ Latih kata ini'}
        </button>
      </div>
    </>
  )
}

// ---- per-sentence practice card -------------------------------------------
function PracticePanel({
  segment,
  index,
  lessonId,
  onPracticed,
  onNext,
  hasNext,
  onWordTap,
}: {
  segment: Segment
  index: number
  lessonId: string
  onPracticed: () => void
  onNext: () => void
  hasNext: boolean
  onWordTap: (word: string, x: number, y: number) => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [speed, setSpeed] = useState(1)
  const [dikte, setDikte] = useState(false)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<AttemptScore | null>(null)
  const [spokenIdx, setSpokenIdx] = useState(-1)
  const rec = useEnglishRecorder()

  const wordsArr = useMemo(() => segment.text.split(/\s+/), [segment.text])

  useEffect(() => {
    rec.setContext({
      mode: 'shadowing',
      lesson_id: lessonId,
      segment_index: index,
      target: segment.text,
      target_words: wordsArr.length,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment.id])

  // Shadowing: score when the transcript arrives.
  useEffect(() => {
    if (rec.transcript) {
      const s = scoreAttempt(segment.text, rec.transcript)
      setResult(s)
      void recordAttempt(s)
      onPracticed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.transcript])

  const play = () => {
    const a = audioRef.current
    if (!a) return
    a.playbackRate = speed
    a.currentTime = 0
    void a.play()
  }

  const checkDikte = () => {
    const s = scoreAttempt(segment.text, typed)
    setResult(s)
    void recordAttempt(s)
    onPracticed()
  }

  return (
    <div className="px-4 pb-4 pt-1">
      {/* big sentence (tappable words + karaoke) */}
      <p
        className={
          'mb-3 text-xl font-medium leading-relaxed text-gray-800 ' +
          (dikte ? 'select-none blur-sm' : '')
        }
      >
        {wordsArr.map((w, i) => (
          <span
            key={i}
            onClick={(e) => onWordTap(w, e.clientX, e.clientY)}
            className={
              'cursor-pointer rounded px-0.5 ' +
              (i === spokenIdx ? 'bg-[#6C5CE7] text-white' : 'hover:bg-violet-100')
            }
          >
            {w}{' '}
          </span>
        ))}
      </p>

      <audio
        ref={audioRef}
        src={segment.audio_url ?? undefined}
        onTimeUpdate={() => {
          const a = audioRef.current
          if (!a || !a.duration) return
          setSpokenIdx(
            Math.min(
              wordsArr.length - 1,
              Math.floor((a.currentTime / a.duration) * wordsArr.length),
            ),
          )
        }}
        onEnded={() => setSpokenIdx(-1)}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={play}
          className="rounded-xl bg-[#6C5CE7] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#5A4BD1]"
        >
          ▶️ Dengar
        </button>
        <button
          onClick={() => setSpeed((s) => (s === 1 ? 0.8 : 1))}
          className={
            'rounded-xl border px-3 py-2 text-sm font-bold ' +
            (speed === 0.8
              ? 'border-[#6C5CE7] text-[#6C5CE7]'
              : 'border-gray-200 text-gray-500')
          }
        >
          {speed.toFixed(1)}×
        </button>
        <button
          onClick={play}
          className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-500"
        >
          🔁 Ulang
        </button>
        <button
          onClick={() => setDikte((d) => !d)}
          className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-500"
        >
          ✍️ Dikte
        </button>
      </div>

      {dikte && (
        <div className="mt-3">
          <textarea
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Ketik yang kamu dengar… (teks diburamkan)"
            className="min-h-16 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 outline-none focus:ring-2 focus:ring-[#6C5CE7]"
          />
          <button
            onClick={() => {
              checkDikte()
              setDikte(false)
            }}
            className="mt-2 w-full rounded-xl bg-emerald-500 p-2.5 font-bold text-white"
          >
            ✅ Periksa
          </button>
        </div>
      )}

      {!dikte && (
        <div className="mt-3">
          {!rec.isRecording ? (
            <button
              onClick={() => {
                audioRef.current?.pause()
                setResult(null)
                void rec.start()
              }}
              disabled={rec.isTranscribing}
              className="w-full rounded-xl bg-red-500 p-3 font-bold text-white shadow hover:bg-red-600 disabled:opacity-50"
            >
              {rec.isTranscribing ? '⏳ Menilai…' : '🎤 Tiru & Nilai'}
            </button>
          ) : (
            <button
              onClick={rec.stop}
              className="w-full rounded-xl bg-emerald-500 p-3 font-bold text-white shadow"
            >
              ■ Selesai
            </button>
          )}
          {rec.error && <p className="mt-2 text-sm text-red-500">{rec.error}</p>}
        </div>
      )}

      {result && (
        <SalisPanel
          score={result}
          target={segment.text}
          words={rec.words}
          refAudioUrl={segment.audio_url}
          myAudioUrl={rec.lastRecordingUrl}
        />
      )}

      {hasNext && (
        <button
          onClick={onNext}
          className="mt-3 w-full rounded-xl bg-violet-50 p-2.5 font-bold text-[#6C5CE7]"
        >
          Kalimat berikut →
        </button>
      )}
    </div>
  )
}

// ---- lesson player --------------------------------------------------------
export function LessonPlayer() {
  const { id } = useParams<{ id: string }>()
  const [lesson, setLesson] = useState<LessonDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [pop, setPop] = useState<PopState | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    let t: ReturnType<typeof setTimeout> | null = null
    const load = () => {
      fetchLesson(id)
        .then((l) => {
          if (!alive) return
          setLesson(l)
          if (l.audio_status === 'pending' || l.audio_status === 'processing')
            t = setTimeout(load, 4000)
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Gagal memuat'),
        )
    }
    load()
    fetchProgress(id)
      .then((p) => {
        if (!alive) return
        setDone(new Set(p.done))
        setActive(Math.max(0, p.last_index))
      })
      .catch(() => {})
    return () => {
      alive = false
      if (t) clearTimeout(t)
    }
  }, [id])

  const select = (i: number) => {
    setActive(i)
    setPop(null)
    if (id) void saveProgress(id, { last_index: i }).catch(() => {})
  }

  const markPracticed = (i: number, order: number) => {
    setDone((prev) => new Set(prev).add(order))
    if (id)
      void saveProgress(id, { last_index: i, done_order: order }).catch(() => {})
  }

  if (error) return <p className="text-red-500">{error}</p>
  if (!lesson) return <p className="text-gray-500">Memuat…</p>

  if (lesson.audio_status !== 'ready') {
    return (
      <div>
        <h2 className="text-xl font-extrabold text-gray-800">{lesson.title}</h2>
        <div className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-700">
          {lesson.audio_status === 'failed'
            ? '⚠️ Gagal membuat audio.'
            : '⏳ Audio sedang dibuat di server… halaman ini akan otomatis diperbarui.'}
        </div>
      </div>
    )
  }

  const total = lesson.segments.length
  const activeIdx = Math.min(active, total - 1)

  return (
    <div>
      <h2 className="text-xl font-extrabold text-gray-800">{lesson.title}</h2>

      <div className="mb-4 mt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-bold text-gray-700">Progres latihan</span>
          <span className="text-xs tabular-nums text-gray-400">
            {done.size} / {total} kalimat
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6C5CE7] to-emerald-500 transition-all"
            style={{ width: `${total ? (done.size / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <p className="mb-3 text-xs text-gray-400">
        👆 Ketuk kalimat untuk dengar &amp; tiru · ketuk{' '}
        <b className="text-[#6C5CE7]">satu kata</b> untuk cara bacanya.
      </p>

      <ul className="space-y-2">
        {lesson.segments.map((seg, i) => {
          const isActive = i === activeIdx
          const isDone = done.has(seg.order)
          return (
            <li
              key={seg.id}
              className={
                'overflow-hidden rounded-2xl border bg-white shadow-sm ' +
                (isActive ? 'border-[#6C5CE7]' : 'border-gray-100')
              }
            >
              <button
                onClick={() => select(i)}
                className={
                  'flex w-full items-start gap-3 p-3.5 text-left ' +
                  (isActive ? 'bg-violet-50' : 'hover:bg-gray-50')
                }
              >
                <span
                  className={
                    'mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full border-2 text-xs font-extrabold ' +
                    (isDone
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : isActive
                        ? 'border-[#6C5CE7] text-[#6C5CE7]'
                        : 'border-gray-200 text-gray-400')
                  }
                >
                  {isDone ? '✓' : isActive ? '▶' : i + 1}
                </span>
                <span
                  className={
                    'text-[15px] leading-relaxed ' +
                    (isActive
                      ? 'text-gray-800'
                      : isDone
                        ? 'text-gray-400'
                        : 'text-gray-600')
                  }
                >
                  {seg.text}
                </span>
              </button>
              {isActive && (
                <PracticePanel
                  segment={seg}
                  index={i}
                  lessonId={id ?? ''}
                  hasNext={i < total - 1}
                  onNext={() => select(i + 1)}
                  onPracticed={() => markPracticed(i, seg.order)}
                  onWordTap={(word, x, y) => setPop({ word, x, y })}
                />
              )}
            </li>
          )
        })}
      </ul>

      {pop && <WordPopover pop={pop} onClose={() => setPop(null)} />}
    </div>
  )
}
