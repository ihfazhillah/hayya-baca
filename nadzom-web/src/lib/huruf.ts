/** Memecah kata Arab berharakat menjadi huruf dasar + tandanya. */

export const FATHAH = 'َ'
export const DHAMMAH = 'ُ'
export const KASRAH = 'ِ'
export const SUKUN = 'ْ'
const SYADDAH = 'ّ'
const FATHATAIN = 'ً'
const DHAMMATAIN = 'ٌ'
const KASRATAIN = 'ٍ'
const ALIF_KHANJARIYAH = 'ٰ'
const TATWIL = 'ـ'
const SUKUN_QURANI = 'ۡ'
const MADDAH = 'ٓ'
const HAMZAH_ATAS = 'ٔ'
const HAMZAH_BAWAH = 'ٕ'
const ALIF_WASHAL = 'ٱ'

export type Harakat = 'a' | 'i' | 'u' | 'sukun' | null

export interface HurufAsli {
  dasar: string
  harakat: Harakat
  syaddah: boolean
  tanwin: boolean
  khanjariyah: boolean
}

export const TANDA: Record<Exclude<Harakat, null>, string> = { a: FATHAH, i: KASRAH, u: DHAMMAH, sukun: SUKUN }
export const MAD_DARI: Record<'a' | 'i' | 'u', string> = { a: 'ا', i: 'ي', u: 'و' }

const HURUF = /[ء-يٱ]/

export function bersihkan(teks: string): string {
  return teks.normalize('NFC').replaceAll(TATWIL, '').replaceAll(SUKUN_QURANI, SUKUN).replaceAll(ALIF_WASHAL, 'ا')
}

export function pecahKata(kata: string): HurufAsli[] {
  const hasil: HurufAsli[] = []
  for (const c of bersihkan(kata)) {
    if (HURUF.test(c)) {
      hasil.push({ dasar: c, harakat: null, syaddah: false, tanwin: false, khanjariyah: false })
      continue
    }
    const akhir = hasil.at(-1)
    if (!akhir) continue
    switch (c) {
      case FATHAH: akhir.harakat = 'a'; break
      case KASRAH: akhir.harakat = 'i'; break
      case DHAMMAH: akhir.harakat = 'u'; break
      case SUKUN: akhir.harakat = 'sukun'; break
      case SYADDAH: akhir.syaddah = true; break
      case FATHATAIN: akhir.harakat = 'a'; akhir.tanwin = true; break
      case KASRATAIN: akhir.harakat = 'i'; akhir.tanwin = true; break
      case DHAMMATAIN: akhir.harakat = 'u'; akhir.tanwin = true; break
      case ALIF_KHANJARIYAH: akhir.khanjariyah = true; break
      case MADDAH: case HAMZAH_ATAS: case HAMZAH_BAWAH: break
    }
  }
  return hasil
}

export function kerangka(kata: HurufAsli[]): string {
  return kata.map((h) => h.dasar).join('')
}

/** Kata yang alif mad-nya tidak ditulis (alif khanjariyah tersirat). Nilai = indeks huruf yang diberi alif. */
const KHANJARIYAH: Record<string, number> = {
  'هذا': 0, 'هذه': 0, 'هذان': 0, 'هذين': 0, 'هؤلاء': 0, 'ذلك': 0, 'ذلكم': 0, 'لكن': 0,
  'الرحمن': 4, 'إله': 1, 'إلهي': 1, 'إلهنا': 1,
}
const AWALAN = ['', 'و', 'ف', 'ب', 'ك', 'ل']

/** Tandai alif khanjariyah yang tersirat. Teks yang sudah menulis ٰ tidak diubah. */
export function tandaiKhanjariyah(kata: HurufAsli[]): void {
  if (kata.some((h) => h.khanjariyah)) return
  const k = kerangka(kata)
  // Lafzh Allah: الله، لله، بالله، والله، فالله، اللهم → lam terakhir sebelum ه dipanjangkan.
  const allah = /^(?:[وفبت]?ا?)?لله(?:م)?$/.exec(k)
  if (allah) {
    const i = k.lastIndexOf('له')
    kata[i].khanjariyah = true
    return
  }
  for (const awal of AWALAN) {
    if (!k.startsWith(awal)) continue
    const inti = k.slice(awal.length)
    if (inti in KHANJARIYAH) {
      kata[awal.length + KHANJARIYAH[inti]].khanjariyah = true
      return
    }
  }
}
