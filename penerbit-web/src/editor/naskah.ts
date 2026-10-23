/** Data bersama halaman naskah: lapis revisi, alatnya, hitung mundur laci. */
import type { Alat, NaskahRingkas } from '../types'

export type LapisRevisi = 'peta' | 'kamera' | 'gunting' | 'kaca'

export interface InfoLapis {
  nomor: number
  nama: string
  /** alat stabilo lapis ini */
  alat: string[]
  /** alat yang disorot otomatis oleh sistem */
  sistem: string[]
  /** modul Level 3 untuk lapis ini (misi kecilnya) */
  modul: number
}

export const LAPIS: Record<LapisRevisi, InfoLapis> = {
  peta: { nomor: 1, nama: 'Cerita Besar', alat: ['pengeras'], sistem: [], modul: 10 },
  kamera: { nomor: 2, nama: 'Adegan', alat: ['kamera'], sistem: [], modul: 11 },
  gunting: { nomor: 3, nama: 'Kalimat', alat: ['gunting', 'kembar'], sistem: ['kembar', 'gunting'], modul: 12 },
  kaca: { nomor: 4, nama: 'Ejaan', alat: ['kaca'], sistem: [], modul: 13 },
}

export const URUTAN_STEMPEL = ['peta', 'kamera', 'gunting', 'kaca', 'pembaca'] as const
export const NAMA_STEMPEL: Record<string, string> = {
  peta: 'Peta', kamera: 'Kamera', gunting: 'Gunting', kaca: 'Kaca', pembaca: 'Pembaca',
}

export function adalahLapis(x: string | undefined | null): x is LapisRevisi {
  return !!x && x in LAPIS
}

export function namaLapis(lapis: string): string {
  if (!lapis) return 'Draf Nol'
  if (adalahLapis(lapis)) return `Revisi Lapis ${LAPIS[lapis].nomor} · ${LAPIS[lapis].nama}`
  return lapis === 'bengkel' ? 'Bengkel' : lapis
}

/** Stempel berikutnya dari daftar stempel yang sudah dimiliki. */
export function lapisBerikutnya(stempel: string[]): string | null {
  return URUTAN_STEMPEL.find((l) => !stempel.includes(l)) ?? null
}

/** "1 hari 4 jam", "3 jam 10 menit", "12 menit". */
export function formatSisa(detik: number): string {
  if (detik <= 0) return 'sekarang'
  const hari = Math.floor(detik / 86400)
  const jam = Math.floor((detik % 86400) / 3600)
  const menit = Math.floor((detik % 3600) / 60)
  if (hari) return jam ? `${hari} hari ${jam} jam` : `${hari} hari`
  if (jam) return menit ? `${jam} jam ${menit} menit` : `${jam} jam`
  if (menit) return `${menit} menit`
  return 'kurang dari 1 menit'
}

/** Tautan lanjut sesuai tahap naskah. */
export function tautanLanjut(n: Pick<NaskahRingkas, 'id' | 'tahap' | 'stempel'>): { ke: string; label: string } {
  if (n.tahap === 'draf_nol' || n.tahap === 'peta') return { ke: `/naskah/${n.id}/draf-nol`, label: 'Lanjut Draf Nol' }
  if (n.tahap === 'revisi') {
    const l = lapisBerikutnya(n.stempel)
    if (adalahLapis(l)) return { ke: `/naskah/${n.id}/revisi/${l}`, label: 'Lanjut revisi' }
  }
  return { ke: `/naskah/${n.id}`, label: 'Lihat naskah' }
}

/** Alat yang boleh muncul di bilah stabilo: hanya yang sudah dipelajari. */
export function alatDipelajari(alat: Alat[]): Alat[] {
  return alat.filter((a) => a.terbuka || a.slot[0]?.punya)
}

export function tanggalPendek(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
