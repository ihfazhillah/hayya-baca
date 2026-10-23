/** Suku kata Latin (ma-la-hal-ar-waa) → huruf ber-bit. Satu sel per suku kata, bit-nya berurutan. */
import type { Huruf } from './jenis'

const VOKAL = /[aiueoâîû]/

export function latinKeHuruf(teks: string): Huruf[] {
  const suku = teks.toLowerCase().split(/[-\s]+/).filter(Boolean)
  const out: Huruf[] = []
  suku.forEach((s, kata) => {
    const m = /^([^aiueoâîû]*)([aiueoâîû]+)([^aiueoâîû]*)$/.exec(s)
    if (!m || !VOKAL.test(s)) {
      out.push({ h: s, bit: 1, kata })
      return
    }
    const [, , vokal, akhir] = m
    // Vokal panjang (aa, ii, uu, â) dan diftong (ai, au) = satu huruf mati setelah huruf hidup.
    const panjang = vokal.length > 1 || /[âîû]/.test(vokal)
    out.push({ h: s, bit: 1, kata })
    if (panjang) out.push({ h: 'ـ', bit: 0, kata })
    if (akhir) out.push({ h: 'ـ', bit: 0, kata })
  })
  return out
}

/** Masukan Latin bila tidak ada huruf Arab sama sekali. */
export function apakahLatin(teks: string): boolean {
  return !/[؀-ۿ]/.test(teks) && /[a-z]/i.test(teks)
}
