import type { Babak, Istilah, KataBank, Modul, ModulPeta } from './jenis'
import peta from './peta.json'
import rujukan from './rujukan.json'

export const BABAK: Babak[] = peta.babak as Babak[]

/** Urutan belajar mengikuti peta: Boss di akhir babaknya, bonus paling akhir. */
const URUTAN = BABAK.flatMap((b) => b.modul.map((m) => m.nomor))

const berkas = import.meta.glob<{ default: Modul }>('./modul-*.json', { eager: true })
export const MODUL: Modul[] = Object.values(berkas)
  .map((m) => m.default)
  .sort((a, b) => URUTAN.indexOf(a.nomor) - URUTAN.indexOf(b.nomor))

export const ISTILAH: Istilah[] = rujukan.istilah

/** Laci: bank kata awal ditambah kata dari setiap modul, tanpa duplikat. */
export const BANK_KATA: KataBank[] = [
  ...(rujukan.bankKata as KataBank[]),
  ...MODUL.flatMap((m) => (m.laci ?? []).map((k) => ({ ...k, dari: k.dari ?? namaModul(m) }))),
].filter((k, i, semua) => semua.findIndex((x) => x.teks === k.teks) === i)

export function cariModul(nomor: number): Modul | undefined {
  return MODUL.find((m) => m.nomor === nomor)
}

/** "Modul 3", "Boss 1", atau "Bonus". */
export function namaModul(m: Pick<Modul, 'nomor' | 'label'>): string {
  return m.label ?? `Modul ${m.nomor}`
}

/** Judul baris di peta. */
export function judulPeta(m: ModulPeta): string {
  return m.boss || m.bonus ? m.judul : `Modul ${m.nomor}: ${m.judul}`
}
