import type { AttemptScore } from '../scoring'

export function ScoreMarks({ result }: { result: AttemptScore }) {
  return (
    <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
      <p className="mb-2 font-bold text-gray-800">
        Skor: {result.score}% — {result.correct}/{result.total} kata benar
      </p>
      <p className="flex flex-wrap gap-x-1.5 gap-y-1 text-lg leading-relaxed">
        {result.marks.map((m, i) => {
          if (m.kind === 'correct')
            return (
              <span key={i} className="font-semibold text-emerald-600">
                {m.word}
              </span>
            )
          if (m.kind === 'wrong')
            return (
              <span key={i} className="text-red-500 line-through">
                {m.word}
              </span>
            )
          return (
            <span key={i} className="italic text-gray-400">
              +{m.word}
            </span>
          )
        })}
      </p>
      <p className="mt-2 text-xs text-gray-500">
        hijau = benar · merah = salah/terlewat · abu = kata ekstra
      </p>
    </div>
  )
}
