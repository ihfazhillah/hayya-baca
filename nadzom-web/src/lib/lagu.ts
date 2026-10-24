/**
 * Lagu tanghim: setiap juz taf'ilah dilagukan dengan satu kata, mengikuti metode Lisan Mubin (lm.edu.sa, Level 1).
 * Pengelompokan diambil dari data bentuk, bukan ditebak dari bit: مُتَفْعِلُنْ = لَ لا نعم, bukan نعم نعم.
 */
import type { Bahr, Bentuk } from './jenis'
import { pecahJuz, type Juz } from './juz'

const KATA: Record<string, Juz> = {
  'لا': { jenis: 'sabab', bit: '10' },
  'نعم': { jenis: 'watad', bit: '110' },
  'لَ': { jenis: 'tunggal', bit: '1' },
  /** Sabab + sukun tambahan (tasbigh). */
  'لال': { jenis: 'sabab', bit: '100' },
  /** Watad + sukun tambahan (qashr, tadzyil). */
  'نعام': { jenis: 'watad', bit: '1100' },
}

function kataLagu(lagu: string): Juz[] {
  return lagu.split(' ').map((k) => {
    const j = KATA[k]
    if (!j) throw new Error(`Kata lagu tidak dikenal: ${k}`)
    return { ...j, lagu: k }
  })
}

export function bitLagu(lagu: string): string {
  return kataLagu(lagu).map((j) => j.bit).join('')
}

/** Juz taf'ilah menurut lagu bentuknya; bila tak berlagu atau bitnya lain (patah), dipecah dari bitnya sendiri. */
export function juzBentuk(bit: string, bentuk?: Bentuk): Juz[] {
  if (bentuk?.lagu && bentuk.bit === bit) return kataLagu(bentuk.lagu)
  return pecahJuz(bit)
}

/** Lagu kunci bahr per syathr, dari bentuk pertama tiap slot. Null bila ada slot yang belum berlagu. */
export function laguBahr(bahr: Bahr): string[] | null {
  const hasil = bahr.slot.map((syathr) => syathr.map((slot) => slot[0].lagu))
  if (hasil.some((s) => s.some((l) => !l))) return null
  return hasil.map((s) => s.join(' '))
}
