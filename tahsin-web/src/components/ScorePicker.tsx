/** 7-button score picker: – 0 1 2 3 4 5. `null` = not assessed. */
const SCORE_BG: Record<number, string> = {
  0: 'bg-red-700',
  1: 'bg-red-600',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-green-600',
  5: 'bg-green-700',
}

export function scoreClass(v: number | null | undefined): string {
  if (v == null) return 'bg-gray-100 text-gray-400'
  return `${SCORE_BG[v]} text-white`
}

export function ScorePicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  const opts: (number | null)[] = [null, 0, 1, 2, 3, 4, 5]
  return (
    <div className="flex gap-1">
      {opts.map((v) => {
        const active = value === v
        const label = v == null ? '–' : v
        const base =
          'flex-1 h-10 rounded-lg font-bold text-[15px] tabular-nums border transition'
        const cls = active
          ? v == null
            ? 'bg-gray-500 text-white border-transparent'
            : `${SCORE_BG[v]} text-white border-transparent`
          : v == null
            ? 'bg-white text-gray-400 border-gray-200'
            : 'bg-white text-gray-800 border-gray-200'
        return (
          <button
            key={String(v)}
            type="button"
            className={`${base} ${cls}`}
            aria-pressed={active}
            onClick={() => onChange(v)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
