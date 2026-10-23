/** Data contoh untuk tes halaman naskah. */
import type { Alat, NaskahDetail, StempelSlot, VersiDetail } from '../types'

export const P = '/api/penerbit'

function alat(kode: string, nama: string, warna: string, pola: Alat['pola_cetak'], dipelajari: boolean): Alat {
  return {
    kode, nama, emoji: '🔧', pertanyaan: '', cara_pakai: '', contoh_sebelum: '', contoh_sesudah: '', warna,
    pola_cetak: pola, modul_belajar: 1, terbuka: dipelajari,
    slot: [{ tingkat: 'perunggu', punya: dipelajari, tanggal: null, syarat_teks: '', oleh_pemeriksa: false, kemajuan: null }],
  }
}

export const ALAT: Alat[] = [
  alat('pengeras', 'Pengeras Suara', '--color-actor-1', 'gelombang', true),
  alat('gunting', 'Gunting', '--color-actor-2', 'putus', true),
  alat('kembar', 'Detektor Kembar', '--color-actor-3', 'lingkaran', true),
  alat('kamera', 'Kamera', '--color-actor-4', 'tebal', true),
  alat('kaca', 'Kaca Pembesar', '--color-actor-5', 'titik', false),
]

export function stempel(punya: string[]): StempelSlot[] {
  return ['peta', 'kamera', 'gunting', 'kaca', 'pembaca'].map((l) => ({
    lapis: l as StempelSlot['lapis'], nama: l[0].toUpperCase() + l.slice(1), punya: punya.includes(l),
    tanggal: punya.includes(l) ? '2026-10-06T10:00:00Z' : null, catatan: '',
  }))
}

export function naskah(over: Partial<NaskahDetail> = {}): NaskahDetail {
  return {
    id: 5, judul: 'Sandal Jepit yang Hilang', tahap: 'revisi', tahap_label: 'Revisi', laci: null,
    nomor_terbitan: '', created_at: '2026-10-01T10:00:00Z', jumlah_versi: 1, jumlah_kata: 6,
    peta: { siapa: 'Fatih', mau_apa: 'Mencari sandal', masalah: 'Sandal hilang', akhir: 'Ketemu' },
    kartu_tebakan: 'Bagian rak sandal', stempel: stempel(['peta']), stempel_diminta: '', lapis_berikutnya: 'kamera',
    versi: [
      { nomor: 1, lapis: '', tanggal: '2026-10-02T10:00:00Z', jumlah_kata: 6 },
      { nomor: 2, lapis: 'peta', tanggal: '2026-10-06T10:00:00Z', jumlah_kata: 8 },
    ],
    jumlah_kata_v1: 6, draf: null, catatan: [], ulasan: [], paragraf_favorit: {}, sampul: null, tentang_penulis: '',
    ...over,
  }
}

export const TEKS_V1 = 'Fatih punya sandal.\nRak sandalnya kosong. Fatih sedih.'
export const TEKS_V2 = 'Fatih punya sandal.\nRak sandalnya kosong. Mata Fatih mulai panas.'

export function versi(nomor: number, teks: string, over: Partial<VersiDetail> = {}): VersiDetail {
  return {
    nomor, lapis: nomor === 1 ? '' : 'peta', tanggal: '2026-10-06T10:00:00Z', jumlah_kata: teks.split(/\s+/).length,
    isi: { ops: [{ insert: teks + '\n' }] }, teks, sorotan: [], ...over,
  }
}
