import { pauseMarkup } from '../salis/markup'
import type { WordMark } from '../scoring'

/** Reference text with rhythm markers (`/` short, `//` long) and mis-said words
 *  highlighted (Spec 067). */
export function PauseText({
  target,
  marks,
}: {
  target: string
  marks?: WordMark[]
}) {
  const refMarks = marks?.filter((m) => m.kind !== 'extra') ?? []
  const tokens = pauseMarkup(target)
  return (
    <p className="text-lg leading-loose text-gray-800">
      {tokens.map((t, i) =>
        t.kind === 'word' ? (
          <span
            key={i}
            className={
              refMarks[t.index]?.kind === 'wrong'
                ? 'text-red-500 underline decoration-red-400 decoration-2'
                : undefined
            }
          >
            {t.text}{' '}
          </span>
        ) : (
          <span key={i} className="mx-0.5 font-bold text-[#6C5CE7]">
            {t.strength === 'long' ? '//' : '/'}{' '}
          </span>
        ),
      )}
    </p>
  )
}
