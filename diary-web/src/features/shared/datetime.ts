// Friendly Indonesian timestamp for a post, in the viewer's local time.
// "Hari ini, 14.30" / "Kemarin, 08.05" / "28 Jul, 14.30" (adds year if not the
// current year). `now` is injectable so it is deterministic under test.
const MONTHS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatPostTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const time = `${pad(d.getHours())}.${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return `Hari ini, ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Kemarin, ${time}`

  const datePart =
    d.getFullYear() === now.getFullYear()
      ? `${d.getDate()} ${MONTHS_ID[d.getMonth()]}`
      : `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`
  return `${datePart}, ${time}`
}
