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

/** Setelah course: tangga kitab, bahr yang belum dipelajari, kebiasaan (spec 077). */
export const LANJUTAN: { kitab: { judul: string; penulis: string; tingkat: string; catatan: string }[]; bahrSisa: string[]; kebiasaan: string[] } = rujukan.lanjutan

/** Laci: bank kata awal ditambah kata dari setiap modul, tanpa duplikat. */
export const BANK_KATA: KataBank[] = [
  ...(rujukan.bankKata as KataBank[]),
  ...MODUL.flatMap((m) =>
    (m.laci ?? []).map((k) => ({
      ...k,
      dari: k.dari ?? namaModul(m),
      modul: k.modul ?? m.nomor,
      bahr: k.bahr ?? (k.laci === 'umum' ? undefined : (m.pelajaran.find((p) => p.nomor === 1) ?? m.pelajaran[0])?.bahts.bahr),
    })),
  ),
].filter((k, i, semua) => semua.findIndex((x) => x.teks === k.teks) === i)

/** Urutan belajar sebuah modul di peta (-1 bila tidak ada). */
export const urutanModul = (nomor: number) => URUTAN.indexOf(nomor)

/** Laci untuk satu tamrin: kata dari modul yang sudah dibuka sampai `sampai`, dan dari bahr yang sama. */
export function laciUntuk(sampai: number, bahr?: string): KataBank[] {
  const batas = urutanModul(sampai)
  return BANK_KATA.filter((k) => (k.modul === undefined || urutanModul(k.modul) <= batas) && (!bahr || !k.bahr || k.bahr === bahr))
}

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
