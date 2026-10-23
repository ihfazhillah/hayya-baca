/** Qafiyah: rawiy, harakat rawiy (majra), dan ridf (huruf mad sebelum rawiy). */
import type { Huruf } from './jenis'

export type Harakat = 'fathah' | 'kasrah' | 'dhammah' | 'sukun'

export interface Qafiyah {
  rawiy: string
  harakat: Harakat
  /** Huruf mad tepat sebelum rawiy. و dan ي boleh saling berganti; ا tidak. */
  ridf?: string
}

const TANDA: Record<string, Harakat> = { 'َ': 'fathah', 'ِ': 'kasrah', 'ُ': 'dhammah', 'ْ': 'sukun' }
const DARI_ISYBA: Record<string, Harakat> = { 'ا': 'fathah', 'ي': 'kasrah', 'و': 'dhammah' }
const NAMA: Record<Harakat, string> = { fathah: 'fathah', kasrah: 'kasrah', dhammah: 'dhammah', sukun: 'sukun' }

/** Indeks rawiy: huruf terakhir yang diucapkan, tanpa isyba', nun tanwin, atau huruf mad di ujung. */
function indeksRawiy(huruf: Huruf[]): number {
  for (let i = huruf.length - 1; i >= 0; i--) {
    const h = huruf[i]
    if (h.tambahan === 'isyba' || h.tambahan === 'tanwin') continue
    if (h.bit === 0 && 'اويى'.includes(h.h[0]) && i > 0) continue
    return i
  }
  return -1
}

export function qafiyah(huruf: Huruf[]): Qafiyah {
  const i = indeksRawiy(huruf)
  if (i < 0) return { rawiy: '', harakat: 'sukun' }
  const r = huruf[i]
  const tanda = [...r.h].map((c) => TANDA[c]).find(Boolean)
  const setelah = huruf[i + 1]
  const harakat: Harakat = r.bit === 0 ? 'sukun' : tanda && tanda !== 'sukun' ? tanda : setelah ? DARI_ISYBA[setelah.h[0]] ?? 'sukun' : 'sukun'
  const q: Qafiyah = { rawiy: r.h[0], harakat }
  const sebelum = huruf[i - 1]
  if (sebelum && sebelum.bit === 0 && 'اوي'.includes(sebelum.h[0]) && huruf[i - 2]?.bit === 1) q.ridf = sebelum.h[0]
  return q
}

const ridfSama = (a?: string, b?: string) => (a === 'ا' || b === 'ا' ? a === b : !a === !b)

function beda(a: Qafiyah, b: Qafiyah): string | null {
  if (a.rawiy !== b.rawiy) return `rawiy ${b.rawiy || '?'} berbeda dari ${a.rawiy}`
  if (a.harakat !== b.harakat) return `rawiy ${b.rawiy} ber-${NAMA[b.harakat]}, seharusnya ${NAMA[a.harakat]}`
  if (!ridfSama(a.ridf, b.ridf)) return a.ridf ? `sebelum rawiy seharusnya ada huruf mad ${a.ridf}` : `huruf mad ${b.ridf} sebelum rawiy tidak ada di bait pertama`
  return null
}

export interface MasalahQafiyah {
  /** Nomor bait, mulai 1. */
  bait: number
  pesan: string
}

/**
 * `muzdawij`: dua syathr setiap bait berqafiyah sama, bait berikutnya boleh berganti (Alfiyah).
 * `satu`: ujung setiap bait mengikuti ujung bait pertama (qashidah).
 */
export function periksaQafiyah(bait: Huruf[][][], pola: 'muzdawij' | 'satu'): MasalahQafiyah[] {
  const masalah: MasalahQafiyah[] = []
  if (pola === 'muzdawij') {
    bait.forEach((s, k) => {
      if (s.length < 2) return
      const m = beda(qafiyah(s[0]), qafiyah(s[s.length - 1]))
      if (m) masalah.push({ bait: k + 1, pesan: `Dua syathr tidak berpasangan: ${m}.` })
    })
    return masalah
  }
  const acuan = bait[0] ? qafiyah(bait[0][bait[0].length - 1]) : null
  if (!acuan) return masalah
  bait.slice(1).forEach((s, k) => {
    const m = beda(acuan, qafiyah(s[s.length - 1]))
    if (m) masalah.push({ bait: k + 2, pesan: `Ujung bait: ${m}.` })
  })
  return masalah
}
