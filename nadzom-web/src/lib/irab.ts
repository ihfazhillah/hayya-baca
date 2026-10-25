/** Fase E (spec 077): pemeriksaan i'rab yang bisa dilakukan tanpa memahami kalimat, yaitu harakat akhir kata. */
import type { Harakat } from '@/content/jenis'

const TANDA: Record<string, Harakat> = { 'ُ': 'u', 'ٌ': 'u', 'َ': 'a', 'ً': 'a', 'ِ': 'i', 'ٍ': 'i', 'ْ': 'sukun' }

/** Harakat akhir kata terakhir; alif tanwin fathah dan alif maqshurah dilewati. Null bila tak berharakat. */
export function harakatAkhir(teks: string): Harakat | null {
  const kata = teks.trim().split(/\s+/).at(-1) ?? ''
  const huruf = [...kata.replace(/[اى]$/, (m, i) => (i > 0 && /[ًَ]/.test(kata[i - 1]) ? '' : m))]
  for (let i = huruf.length - 1; i >= 0; i--) {
    const h = TANDA[huruf[i]]
    if (h) return h
    if (!/[ّٰ]/.test(huruf[i])) return null
  }
  return null
}

export const NAMA_HARAKAT: Record<Harakat, string> = { u: 'dhammah', a: 'fathah', i: 'kasrah', sukun: 'sukun' }
export const KEADAAN: Record<Harakat, string> = { u: "marfu'", a: 'manshub', i: 'majrur', sukun: 'majzum atau mabni sukun' }

export const PERAN = ["mubtada'", 'khabar', "fa'il", "maf'ul bih", "na't", 'mudhaf ilaih', 'majrur', 'hal', 'tamyiz', "fi'il"]
