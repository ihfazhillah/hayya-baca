import { useEffect, useState } from 'react'
import { scoreAttempt, type AttemptScore } from '../scoring'
import {
  hasNativeAussieVoice,
  speakAU,
  stopSpeaking,
  ttsSupported,
  useEnglishRecorder,
} from '../speech'
import { ScoreMarks } from '../components/ScoreMarks'

const DEFAULT_TEXT = "G'day! I reckon we should head to the beach this arvo."

const RATES = [
  { value: 0.7, label: 'Lambat' },
  { value: 0.9, label: 'Normal' },
  { value: 1.1, label: 'Cepat' },
] as const

export function Custom() {
  const [text, setText] = useState(DEFAULT_TEXT)
  const [rate, setRate] = useState<number>(0.9)
  const [result, setResult] = useState<AttemptScore | null>(null)
  const rec = useEnglishRecorder()

  useEffect(() => () => stopSpeaking(), [])

  // Transkrip datang async setelah upload ke server — nilai saat tiba
  useEffect(() => {
    if (rec.transcript) {
      setResult(scoreAttempt(text, rec.transcript))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.transcript])

  return (
    <div>
      <h2 className="mb-3 text-xl font-extrabold text-gray-800">
        ✍️ Latihan Teks Sendiri
      </h2>

      <label className="mb-1 block text-sm text-gray-600">Teks (English)</label>
      <textarea
        className="min-h-24 w-full rounded-xl border-0 bg-white p-3 text-base shadow-sm outline-none focus:ring-2 focus:ring-[#6C5CE7]"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setResult(null)
          rec.reset()
        }}
        placeholder="Tulis teks bahasa Inggris di sini…"
      />

      <div className="mt-3 flex items-center gap-2">
        {RATES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRate(r.value)}
            className={
              'rounded-full px-4 py-1.5 text-sm transition ' +
              (rate === r.value
                ? 'bg-[#6C5CE7] font-bold text-white'
                : 'bg-white text-gray-600 shadow-sm')
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => speakAU(text, rate)}
        disabled={!ttsSupported()}
        className="mt-4 w-full rounded-xl bg-[#6C5CE7] p-3.5 font-bold text-white shadow transition hover:bg-[#5A4BD1] disabled:opacity-50"
      >
        🔊 Dengarkan (aksen AU)
      </button>
      {ttsSupported() && !hasNativeAussieVoice() && (
        <p className="mt-1.5 text-xs text-amber-600">
          Browser ini tidak punya voice en-AU asli — dipakai voice English
          terdekat. Coba Microsoft Edge atau Chrome di Android untuk aksen
          Australia yang sebenarnya.
        </p>
      )}

      <hr className="my-6 border-violet-200" />
      <h3 className="mb-3 text-lg font-bold text-gray-800">🎤 Sekarang tirukan</h3>

      {!rec.supported ? (
        <p className="text-amber-600">
          Browser ini tidak mendukung perekaman audio.
        </p>
      ) : rec.isTranscribing ? (
        <button
          disabled
          className="w-full rounded-xl bg-gray-400 p-3.5 font-bold text-white shadow"
        >
          ⏳ Menilai ucapanmu…
        </button>
      ) : !rec.isRecording ? (
        <button
          onClick={() => {
            stopSpeaking()
            setResult(null)
            void rec.start()
          }}
          className="w-full rounded-xl bg-red-500 p-3.5 font-bold text-white shadow transition hover:bg-red-600"
        >
          ● Mulai Rekam
        </button>
      ) : (
        <button
          onClick={rec.stop}
          className="w-full rounded-xl bg-emerald-500 p-3.5 font-bold text-white shadow transition hover:bg-emerald-600"
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
        <p className="mt-3 italic text-gray-500">Terdengar: “{rec.transcript}”</p>
      )}
      {rec.error && <p className="mt-2 text-red-500">{rec.error}</p>}
      {result && <ScoreMarks result={result} />}
    </div>
  )
}
