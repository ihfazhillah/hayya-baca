/** Period math for the dashboard. Dates are 'YYYY-MM-DD' strings (local). */

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

export function iso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): string {
  return iso(new Date())
}

/** Monday of the week containing `start`. */
export function weekStart(start: string): string {
  const d = parse(start)
  const dow = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow)
  return iso(d)
}

export function weekRange(start: string): { start: string; end: string } {
  const s = parse(weekStart(start))
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  return { start: iso(s), end: iso(e) }
}

export function monthRange(start: string): { start: string; end: string } {
  const d = parse(start)
  const s = new Date(d.getFullYear(), d.getMonth(), 1)
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start: iso(s), end: iso(e) }
}

/** Shift the period start by ±1 unit. Returns the new anchor date string. */
export function shift(period: 'week' | 'month', start: string, dir: number): string {
  const d = parse(start)
  if (period === 'month') {
    return iso(new Date(d.getFullYear(), d.getMonth() + dir, 1))
  }
  d.setDate(d.getDate() + dir * 7)
  return weekStart(iso(d))
}

/** ISO week number (1..53). */
export function isoWeek(start: string): number {
  const d = parse(weekStart(start))
  d.setDate(d.getDate() + 3) // Thursday of this week
  const firstThu = new Date(d.getFullYear(), 0, 4)
  const dow = (firstThu.getDay() + 6) % 7
  firstThu.setDate(firstThu.getDate() - dow + 3)
  return 1 + Math.round((d.getTime() - firstThu.getTime()) / (7 * 864e5))
}

export function label(period: 'week' | 'month', start: string): string {
  if (period === 'month') {
    const d = parse(start)
    return `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`
  }
  const { start: s, end: e } = weekRange(start)
  const sd = parse(s)
  const ed = parse(e)
  const wk = isoWeek(start)
  const sameMonth = sd.getMonth() === ed.getMonth()
  const left = `${sd.getDate()}${sameMonth ? '' : ' ' + MONTHS_SHORT[sd.getMonth()]}`
  const right = `${ed.getDate()} ${MONTHS_SHORT[ed.getMonth()]} ${ed.getFullYear()}`
  return `Pekan ${wk} · ${left}–${right}`
}

export function fmtShort(dateStr: string): string {
  const d = parse(dateStr)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}
