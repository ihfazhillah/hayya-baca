/** Bentuk isi course (spec 076 K2: alur an-Nahwul Wadhih). Teks boleh memakai **tebal**; huruf Arab otomatis diberi font Arab. */
import type { Bahr } from '@/lib/jenis'

export type KodeBahr = Bahr['kode']

export interface Contoh {
  bait: string[]
  bahr: KodeBahr
  sumber: string
  catatan?: string
  /** Jumlah taf'ilah patah yang diharapkan (bawaan 0). Diperiksa oleh test isi. */
  patah?: number
}

export type TampilPeragaan = 'bait' | 'kitabah' | 'huruf' | 'tanda' | 'kelompok' | 'mizan' | 'bahr' | 'timbang' | 'teks'

export interface LangkahPeragaan {
  tampil: TampilPeragaan
  /** Kata-kata Hudhud. */
  kata: string
  /** Untuk `timbang`/`bait`: bait lain dari bait bahts (mis. draf v1 yang pincang). */
  bait?: string[]
  /** Untuk `teks`: isi papan. */
  papan?: string
  /** Untuk `timbang`: harapan jumlah patah (diperiksa test isi). */
  patah?: number
}

export interface Bahts {
  bait: string[]
  bahr: KodeBahr
  /** Syathr yang diperagakan (indeks). */
  syathr: number
  langkah: LangkahPeragaan[]
  /** Syathr yang dikerjakan sendiri setelah peragaan. */
  giliran: { syathr: number; petunjuk: string }
}

export type Tamrin =
  | { jenis: 'pilih'; soal: string; pilihan: string[]; jawaban: number; alasan: string }
  | { jenis: 'taqthi'; petunjuk: string; bait: string[]; bahr: KodeBahr }
  | {
      jenis: 'cetakan'
      petunjuk: string
      /** Teks cetakan; `{1}`, `{2}` = kotak isian. */
      cetakan: string
      kotak: { petunjuk: string; pola: string; contoh: string[] }[]
      bahr: KodeBahr
      /** Berapa baris berbeda yang harus dibuat. */
      jumlah: number
    }
  | { jenis: 'susun'; petunjuk: string; bahr: KodeBahr; makna: string; bankKata: boolean }

export interface Pelajaran {
  nomor: number
  judul: string
  ringkas: string
  menit: number
  analogi: string
  amtsilah: Contoh[]
  bahts: Bahts
  qaidah: string[]
  tamarin: Tamrin[]
  patokan: string
}

export interface Modul {
  nomor: number
  judul: string
  tujuan: string
  pelajaran: Pelajaran[]
}

export interface ModulPeta {
  nomor: number | null
  judul: string
  fokus: string
  hasil: string
  boss?: boolean
}

export interface Babak {
  nomor: number
  judul: string
  bahr: string
  ringkas: string
  modul: ModulPeta[]
}

export interface KataBank {
  teks: string
  arti: string
  catatan?: string
}

export interface Istilah {
  istilah: string
  ar: string
  arti: string
  jembatan: string
}
