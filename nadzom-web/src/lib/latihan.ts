/** Pemeriksa untuk latihan bertahap (spec 076 K3, mode bertahap) dan format Diwan. */
import type { Bentuk, HasilBait, Huruf } from './jenis'
import { kitabahBait, pisahBait, type Aturan } from './kitabah'
import { cocokkan } from './timbang'

/** Huruf digabung per kata, kata dipisah spasi. */
export function teksKitabah(huruf: Huruf[]): string {
  const kata: string[] = []
  let ke = -1
  for (const h of huruf) {
    if (h.kata !== ke) {
      kata.push('')
      ke = h.kata
    }
    kata[kata.length - 1] += h.h
  }
  return kata.join(' ')
}

const PENGECOH: Aturan[][] = [['hamzahWashal'], ['tanwin'], ['syaddah'], ['lamSyamsiyah'], ['isyba'], ['hamzahWashal', 'lamSyamsiyah']]

/** Kitabah yang benar + pengecoh dari aturan yang dimatikan; urutan diacak tetap (bergantung teks). */
export function pilihanKitabah(bait: string[], ke: number): { pilihan: string[]; benar: number } {
  const benarK = kitabahBait(bait)
  if (!benarK.ok) return { pilihan: [], benar: 0 }
  const benar = teksKitabah(benarK.syathr[ke])
  const set = new Set([benar])
  for (const matikan of PENGECOH) {
    const k = kitabahBait(bait, { matikan })
    if (k.ok) set.add(teksKitabah(k.syathr[ke]))
    if (set.size >= 4) break
  }
  // Pengecoh terakhir: tulisan biasa, seperti tertulis di kitab.
  if (set.size < 3) set.add(bait[ke].trim())
  const urut = [...set]
  const geser = [...benar].reduce((a, c) => a + c.charCodeAt(0), 0) % urut.length
  const pilihan = [...urut.slice(geser), ...urut.slice(0, geser)]
  return { pilihan, benar: pilihan.indexOf(benar) }
}

/** Per huruf: apakah tanda yang diberikan sama dengan bit-nya. */
export function periksaTanda(huruf: Huruf[], jawab: (0 | 1 | null)[]): boolean[] {
  return huruf.map((h, i) => jawab[i] === h.bit)
}

export interface SegmenPotong {
  mulai: number
  akhir: number
  bit: string
  cocok?: Bentuk
}

/** `batas` = indeks huruf tempat taf'ilah baru dimulai. Sah bila setiap potongan cocok dengan bentuk yang dikenal di slotnya. */
export function periksaPotong(huruf: Huruf[], batas: number[], slot: Bentuk[][]): { benar: boolean; segmen: SegmenPotong[] } {
  const titik = [0, ...[...batas].sort((a, b) => a - b), huruf.length]
  const segmen: SegmenPotong[] = []
  for (let i = 0; i < titik.length - 1; i++) {
    const bit = huruf.slice(titik[i], titik[i + 1]).map((h) => h.bit).join('')
    const bentuk = slot[i]
    const c = bentuk ? cocokkan(bit, bentuk) : undefined
    segmen.push({ mulai: titik[i], akhir: titik[i + 1], bit, ...(c && c.status !== 'patah' ? { cocok: c.bentuk } : {}) })
  }
  return { benar: segmen.length === slot.length && segmen.every((s) => s.cocok), segmen }
}

/** Satu entri Diwan dalam Markdown, siap ditempel di Obsidian atau catatan lain. */
export function diwanMarkdown(judul: string, bait: string[], hasil: HasilBait, tanggal = new Date()): string {
  const tgl = tanggal.toISOString().slice(0, 10)
  const pola = hasil.syathr.map((s) => s.potongan.map((p) => p.bit).join(' ')).join(' / ')
  return [
    `### ${judul || 'Bait'} · ${tgl}`,
    '',
    ...bait.map((s) => `> ${s}`),
    '',
    `- Bahr: ${hasil.bahr.nama}`,
    `- Pola: ${pola}`,
    `- Patah: ${hasil.patah}`,
    '',
  ].join('\n')
}

/** Beberapa bait sekaligus (Muzdawij, Boss) dalam satu entri Diwan. */
export function diwanQasidah(judul: string, bait: string[][], hasil: HasilBait[], tanggal = new Date()): string {
  const tgl = tanggal.toISOString().slice(0, 10)
  const patah = hasil.reduce((a, h) => a + h.patah, 0)
  return [
    `### ${judul || 'Qasidah'} · ${tgl}`,
    '',
    ...bait.flatMap((b, i) => [`${i + 1}. ${b.join(' ... ')} — patah ${hasil[i]?.patah ?? '?'}`]),
    '',
    `- Bahr: ${hasil[0]?.bahr.nama ?? '-'}`,
    `- Jumlah bait: ${bait.length}`,
    `- Patah: ${patah}`,
    '',
  ].join('\n')
}

/** Banyak bait: satu baris berisi dua syathr (dipisah | / * …), atau dua baris berurutan menjadi satu bait. */
export function pisahQasidah(teks: string): string[][] {
  const bait: string[][] = []
  let sisa: string | null = null
  for (const baris of teks.split('\n').map((x) => x.trim()).filter(Boolean)) {
    const s = pisahBait(baris)
    if (s.length >= 2) {
      if (sisa) bait.push([sisa])
      sisa = null
      bait.push(s.slice(0, 2))
    } else if (sisa) {
      bait.push([sisa, s[0]])
      sisa = null
    } else sisa = s[0]
  }
  if (sisa) bait.push([sisa])
  return bait
}
