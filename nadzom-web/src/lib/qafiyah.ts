/** Qafiyah: rawiy, harakat rawiy (majra), dan ridf (huruf mad sebelum rawiy). */
import type { Bentuk, HasilBait, Huruf } from './jenis'

export type Harakat = 'fathah' | 'kasrah' | 'dhammah' | 'sukun'

export interface Qafiyah {
  rawiy: string
  harakat: Harakat
  /** Huruf mad tepat sebelum rawiy. و dan ي boleh saling berganti; ا tidak. */
  ridf?: string
  /** Ta'sis: alif yang berjarak satu huruf hidup (dakhil) sebelum rawiy, seperti جَاهِلُ. */
  tasis?: true
}

const TANDA: Record<string, Harakat> = { 'َ': 'fathah', 'ِ': 'kasrah', 'ُ': 'dhammah', 'ْ': 'sukun' }
const DARI_ISYBA: Record<string, Harakat> = { 'ا': 'fathah', 'ي': 'kasrah', 'و': 'dhammah' }
const NAMA: Record<Harakat, string> = { fathah: 'fathah', kasrah: 'kasrah', dhammah: 'dhammah', sukun: 'sukun' }

/**
 * Indeks rawiy: huruf terakhir yang diucapkan, tanpa isyba', nun tanwin, atau huruf mad di ujung.
 * Ha setelah huruf hidup (ha dhamir, ta marbutah yang diwaqafkan) adalah wasl: rawiy-nya huruf sebelumnya.
 */
function indeksRawiy(huruf: Huruf[]): number {
  for (let i = huruf.length - 1; i >= 0; i--) {
    const h = huruf[i]
    if (h.tambahan === 'isyba' || h.tambahan === 'tanwin') continue
    if (h.bit === 0 && 'اويى'.includes(h.h[0]) && i > 0) continue
    if (h.h[0] === 'ه' && huruf[i - 1]?.bit === 1) return i - 1
    return i
  }
  return -1
}

export function qafiyah(huruf: Huruf[]): Qafiyah {
  const i = indeksRawiy(huruf)
  if (i < 0) return { rawiy: '', harakat: 'sukun' }
  const r = huruf[i]
  const tanda = [...r.h].map((c) => TANDA[c]).find(Boolean)
  const setelah = huruf[i + 1]?.h[0] === 'ه' ? huruf[i + 2] : huruf[i + 1]
  const harakat: Harakat = r.bit === 0 ? 'sukun' : tanda && tanda !== 'sukun' ? tanda : setelah ? DARI_ISYBA[setelah.h[0]] ?? 'sukun' : 'sukun'
  const q: Qafiyah = { rawiy: r.h[0], harakat }
  const sebelum = huruf[i - 1]
  if (sebelum && sebelum.bit === 0 && sebelum.tambahan !== 'syaddah' && 'اوي'.includes(sebelum.h[0]) && huruf[i - 2]?.bit === 1) q.ridf = sebelum.h[0]
  const alif = huruf[i - 2]
  if (!q.ridf && sebelum?.bit === 1 && alif?.bit === 0 && alif.h[0] === 'ا' && alif.kata === r.kata) q.tasis = true
  return q
}

const ridfSama = (a?: string, b?: string) => (a === 'ا' || b === 'ا' ? a === b : !a === !b)

/** `istilah: false` (Jilid 1): pesan tanpa nama ridf/ta'sis yang belum diajarkan. */
function beda(a: Qafiyah, b: Qafiyah, istilah = true): string | null {
  if (a.rawiy !== b.rawiy) return `rawiy ${b.rawiy || '?'} berbeda dari ${a.rawiy}`
  if (a.harakat !== b.harakat) return `rawiy ${b.rawiy} ber-${NAMA[b.harakat]}, seharusnya ${NAMA[a.harakat]}`
  if (!ridfSama(a.ridf, b.ridf)) return a.ridf ? `sebelum rawiy seharusnya ada huruf mad ${a.ridf}` : `huruf mad ${b.ridf} sebelum rawiy tidak ada di bait pertama`
  if (!a.tasis !== !b.tasis && !istilah)
    return a.tasis ? 'pola memakai alif yang berjarak satu huruf sebelum huruf ujung (seperti جَارِمُ); di sini tidak ada. Pakai kata berwazan فَاعِلُ' : 'di sini ada alif yang berjarak satu huruf sebelum huruf ujung; di pola tidak ada'
  if (!a.tasis !== !b.tasis) return a.tasis ? `bait pertama memakai ta'sis (alif sebelum huruf sebelum rawiy, seperti جَاهِلُ); di sini tidak ada` : `di sini ada ta'sis (alif sebelum huruf sebelum rawiy), bait pertama tidak`
  return null
}

/** Ujung syathr dibandingkan dengan ujung acuan (mis. bait pola mu'aradhah); null bila sama. */
export function bedaUjung(acuan: Huruf[], syathr: Huruf[], istilah = true): string | null {
  return beda(qafiyah(acuan), qafiyah(syathr), istilah)
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
export function periksaQafiyah(bait: Huruf[][][], pola: 'muzdawij' | 'satu', istilah = true): MasalahQafiyah[] {
  const masalah: MasalahQafiyah[] = []
  if (pola === 'muzdawij') {
    bait.forEach((s, k) => {
      if (s.length < 2) return
      const m = beda(qafiyah(s[0]), qafiyah(s[s.length - 1]), istilah)
      if (m) masalah.push({ bait: k + 1, pesan: `Dua syathr tidak berpasangan: ${m}.` })
    })
    return masalah
  }
  const acuan = bait[0] ? qafiyah(bait[0][bait[0].length - 1]) : null
  if (!acuan) return masalah
  bait.slice(1).forEach((s, k) => {
    const m = beda(acuan, qafiyah(s[s.length - 1]), istilah)
    if (m) masalah.push({ bait: k + 2, pesan: `Ujung bait: ${m}.` })
  })
  return masalah
}

const ILLAH = ["qath'", 'hadzadz', 'hadzf', 'qashr', 'tasbigh', 'qathf']

/** Jenis ujung: 'illah yang dipakai, atau shahih. Zihaf yang menyertainya (idhmar, khabn) boleh berganti. */
function jenisUjung(b: Bentuk): string {
  if (!b.illah || !b.zihaf) return 'shahih'
  return b.zihaf.split(' + ').find((z) => ILLAH.includes(z)) ?? b.zihaf
}

/** 'Illah dharb, sekali dipakai, harus tetap di seluruh qasidah. Dibandingkan dengan bait pertama. */
export function periksaDharb(hasil: HasilBait[]): MasalahQafiyah[] {
  const ujung = (h: HasilBait) => {
    const p = h.syathr.at(-1)?.potongan.at(-1)
    return p && p.status !== 'patah' ? p.bentuk : null
  }
  const acuan = hasil[0] ? ujung(hasil[0]) : null
  if (!acuan) return []
  const masalah: MasalahQafiyah[] = []
  hasil.slice(1).forEach((h, k) => {
    const b = ujung(h)
    if (b && jenisUjung(b) !== jenisUjung(acuan)) {
      masalah.push({ bait: k + 2, pesan: `Dharb ${b.namaLain ?? b.nama} (${jenisUjung(b)}) berbeda dari bait pertama, ${acuan.namaLain ?? acuan.nama} (${jenisUjung(acuan)}). 'Illah dharb harus tetap.` })
    }
  })
  return masalah
}
