import { useCallback, useEffect, useState } from 'react'
import { fetchWeakpoints, type WeakPoint } from '../api'
import { TARGET_BY_ID, type TargetPhoneme } from '../fitness/phonemes'
import { recordAttempt } from '../fitness/record'
import { scoreAttempt, type AttemptScore } from '../scoring'
import { useEnglishRecorder } from '../speech'
import { ScoreMarks } from '../components/ScoreMarks'

function Drill({
  phoneme,
  onProgress,
}: {
  phoneme: TargetPhoneme
  onProgress: () => void
}) {
  const items = [...phoneme.examples, phoneme.tongueTwister]
  const [idx, setIdx] = useState(0)
  const [result, setResult] = useState<AttemptScore | null>(null)
  const rec = useEnglishRecorder()
  const target = items[idx]

  useEffect(() => {
    if (rec.transcript) {
      const s = scoreAttempt(target, rec.transcript)
      setResult(s)
      void recordAttempt(s).then(onProgress) // refresh queue if it just cleared
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.transcript])

  const next = () => {
    setIdx((i) => (i + 1) % items.length)
    setResult(null)
    rec.reset()
  }

  return (
    <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-600">{phoneme.tip}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {phoneme.minimalPairs.map(([a, b]) => (
          <span
            key={a + b}
            className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-700"
          >
            {a} ↔ {b}
          </span>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-500">Ucapkan:</p>
      <p className="text-lg font-semibold text-gray-800">{target}</p>

      <div className="mt-2 flex gap-2">
        {!rec.isRecording ? (
          <button
            onClick={() => {
              setResult(null)
              void rec.start()
            }}
            className="flex-1 rounded-xl bg-red-500 p-2.5 font-bold text-white shadow disabled:opacity-50"
            disabled={rec.isTranscribing}
          >
            {rec.isTranscribing ? '⏳ Menilai…' : '● Rekam'}
          </button>
        ) : (
          <button
            onClick={rec.stop}
            className="flex-1 rounded-xl bg-emerald-500 p-2.5 font-bold text-white shadow"
          >
            ■ Selesai
          </button>
        )}
        <button
          onClick={next}
          className="rounded-xl bg-white px-4 font-semibold text-gray-600 shadow-sm"
        >
          Lain →
        </button>
      </div>

      {rec.sttStatus === 'downloading' && (
        <p className="mt-2 text-sm text-[#6C5CE7]">
          ⏬ Mengunduh model suara… {rec.sttProgress}%
        </p>
      )}
      {result && <ScoreMarks result={result} />}
    </div>
  )
}

export function Fitness() {
  const [weak, setWeak] = useState<WeakPoint[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchWeakpoints()
      .then(setWeak)
      .catch(() => setWeak([]))
  }, [])
  useEffect(() => load(), [load])

  return (
    <div>
      <h2 className="text-xl font-extrabold text-gray-800">🏋️ Fitness Lidah</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Latihan terarah untuk bunyi yang sering meleset. Muncul otomatis saat kamu
        sering salah di bunyi tertentu.
      </p>

      {!weak && <p className="text-gray-500">Memuat…</p>}
      {weak && weak.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-gray-500 shadow-sm">
          Belum ada bunyi yang perlu dilatih. Lanjut latihan shadowing — kalau ada
          bunyi yang sering salah, ia akan muncul di sini. 💪
        </p>
      )}

      <ul className="space-y-2.5">
        {weak?.map((w) => {
          const p = TARGET_BY_ID[w.phoneme]
          if (!p) return null
          const isOpen = open === w.phoneme
          return (
            <li key={w.phoneme}>
              <button
                onClick={() => setOpen(isOpen ? null : w.phoneme)}
                className="flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm"
              >
                <span className="font-semibold text-gray-800">{p.label}</span>
                <span className="text-sm text-amber-600">
                  {w.fail_count}× salah · {w.pass_streak}/3 lulus
                </span>
              </button>
              {isOpen && <Drill phoneme={p} onProgress={load} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
