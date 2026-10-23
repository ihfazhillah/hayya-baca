/** Jelajah (spec 075 K4): Buat soal untuk Ayah dan Alat Bebas. */
import { q, request } from './api'
import type { AlatRingkas, Jawaban, Sorotan, Target, Token } from './types'

const P = '/api/penerbit'

export interface AlatSoal extends AlatRingkas {
  /** sudah punya stiker Perak alat ini (simulasi: semua) */
  terbuka: boolean
  /** Kaca Pembesar: celah dan tanda baca juga bisa ditandai */
  celah: boolean
  syarat: string
}

export interface JawabanKeluarga {
  oleh: string
  ditemukan: number
  total: number
  meleset: number
  selesai: boolean
  tanggal: string
}

export interface SoalBuatanku {
  id: number
  alat: AlatRingkas
  teks: string
  dibuat: string
  tokens: Token[]
  kunci: Target[][]
  celah: boolean
  jumlah: number
  kenapa: string[]
  jawaban: JawabanKeluarga[]
}

/** Satu tanda kesalahan: satu token atau satu celah (indeks dari tokenizer server). */
export type TandaKesalahan = ({ token: number } | { celah: number }) & { kenapa: string }

export const getSoalBuatan = () =>
  request<{ alat: AlatSoal[]; soal: SoalBuatanku[]; batas: { teks: number; kesalahan: number } }>('GET', `${P}/soal-buatan/`)
export const tokenSoal = (teks: string) =>
  request<{ teks: string; tokens: Token[] }>('POST', `${P}/soal-buatan/token/`, { teks })
export const simpanSoal = (alat: string, teks: string, kesalahan: TandaKesalahan[]) =>
  request<SoalBuatanku & { pesan: string }>('POST', `${P}/soal-buatan/`, { alat, teks, kesalahan })
export const hapusSoal = (id: number) => request<void>('DELETE', `${P}/soal-buatan/${id}/`)

// ---- Pojok Orang Tua ----
export interface Punyaku {
  diklik: number[]
  celah: number[]
  ditemukan: number
  total: number
  meleset: number
  selesai: boolean
}

export interface SoalAnakRingkas {
  id: number
  alat: AlatRingkas
  dibuat: string
  jumlah: number
  punyaku: Punyaku | null
}

export interface KunciSoal {
  kunci: Target[][]
  kenapa: string[]
  teks: string
}

export interface SoalAnakDetail extends Partial<KunciSoal> {
  id: number
  alat: AlatRingkas
  penulis: string
  dibuat: string
  tokens: Token[]
  celah: boolean
  jumlah: number
  punyaku: Punyaku | null
}

export const listSoalAnak = (simulasi = false) =>
  request<{ penulis: string; soal: SoalAnakRingkas[] }>(
    'GET', q(`${P}/ortu/soal-buatan/`, { simulasi: simulasi ? 1 : undefined }))
export const getSoalAnak = (id: number) => request<SoalAnakDetail>('GET', `${P}/ortu/soal-buatan/${id}/`)
export const klikSoalAnak = (id: number, target: { token?: number; celah?: number }) =>
  request<{ hasil: 'ketemu' | 'sudah' | 'meleset'; ditemukan: number; total: number; meleset: number; selesai: boolean }
    & Partial<KunciSoal>>('POST', `${P}/ortu/soal-buatan/${id}/klik/`, target)
export const berhentiSoalAnak = (id: number) =>
  request<{ selesai: true; ditemukan: number; total: number } & KunciSoal & Jawaban>(
    'POST', `${P}/ortu/soal-buatan/${id}/berhenti/`)

// ---- Alat Bebas ----
export const sorotanBebas = (teks: string, alat: string[]) =>
  request<Sorotan[]>('POST', `${P}/alat-bebas/sorotan-sistem/`, { teks, alat })
