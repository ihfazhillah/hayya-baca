import { normalizeWords, type AttemptScore } from '../scoring'
import type { Word } from '../stt/backend'
import { comparePauses, expectedPauses, measuredPauses } from '../salis/pauses'
import { fluencyScore, hesitations, wpm } from '../salis/fluency'
import { salisScore } from '../salis/score'
import { PauseText } from './PauseText'

function Meter({ label, value }: { label: string; value: number }) {
  const color =
    value >= 85 ? 'bg-emerald-500' : value >= 65 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export function SalisPanel({
  score,
  target,
  words,
  refAudioUrl,
  myAudioUrl,
}: {
  score: AttemptScore
  target: string
  words: Word[]
  refAudioUrl?: string | null
  myAudioUrl?: string | null
}) {
  const accuracy = score.score
  const hasTiming = words.length >= 2

  const expected = expectedPauses(target)
  const measured = hasTiming ? measuredPauses(words) : []
  const pauseCmp = comparePauses(expected, measured)
  const speed = hasTiming ? Math.round(wpm(words)) : 0
  const hes = hasTiming ? hesitations(words, expected) : 0
  const fluency = hasTiming ? fluencyScore(speed, hes) : 0

  const salis = hasTiming
    ? salisScore({ accuracy, pause: pauseCmp.score, fluency })
    : { score: accuracy, verdict: 'Aktifkan model suara untuk nilai ritme & kecepatan' }

  const refWords = normalizeWords(target)
  const missedWords = pauseCmp.missed.map((i) => refWords[i]).filter(Boolean)
  const extraWords = pauseCmp.extra.map((i) => refWords[i]).filter(Boolean)

  const playCompare = () => {
    const seq = [refAudioUrl, myAudioUrl].filter(Boolean) as string[]
    let i = 0
    const playNext = () => {
      if (i >= seq.length) return
      const a = new Audio(seq[i])
      i++
      a.onended = playNext
      void a.play()
    }
    playNext()
  }

  return (
    <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">🎯 Salis</span>
        <span className="text-2xl font-extrabold text-[#6C5CE7]">
          {salis.score}
        </span>
      </div>
      <p className="mb-3 text-sm text-gray-600">{salis.verdict}</p>

      <Meter label="Ketepatan kata" value={accuracy} />
      {hasTiming && <Meter label="Jeda / ritme" value={pauseCmp.score} />}
      {hasTiming && <Meter label="Kelancaran" value={fluency} />}

      <p className="mb-3 mt-2 text-xs text-gray-500">Teks + tanda jeda:</p>
      <PauseText target={target} marks={score.marks} />

      {hasTiming && (
        <div className="mt-2 space-y-1 text-sm">
          <p className="text-gray-500">
            Kecepatan: <b>{speed} kata/menit</b>
            {hes > 0 && ` · ${hes} jeda ragu`}
          </p>
          {missedWords.length > 0 && (
            <p className="text-amber-600">
              Beri jeda setelah: {missedWords.map((x) => `«${x}»`).join(', ')}
            </p>
          )}
          {extraWords.length > 0 && (
            <p className="text-amber-600">
              Jangan putus di: {extraWords.map((x) => `«${x}»`).join(', ')}
            </p>
          )}
        </div>
      )}

      {(refAudioUrl || myAudioUrl) && (
        <button
          onClick={playCompare}
          className="mt-3 w-full rounded-xl bg-violet-100 p-2.5 font-semibold text-violet-700"
        >
          🔁 Bandingkan (contoh → suaramu)
        </button>
      )}
    </div>
  )
}
