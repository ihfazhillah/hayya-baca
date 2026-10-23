/** Bentuk isi course (spec 076 K2: alur an-Nahwul Wadhih). Teks boleh memakai **tebal**; huruf Arab otomatis diberi font Arab. */
import type { Bahr } from '@/lib/jenis'

export type KodeBahr = Bahr['kode']

export interface Contoh {
  bait: string[]
  bahr: KodeBahr
  /** Makna bait dalam bahasa Indonesia, disesuaikan agar mudah ditangkap (bukan kata per kata). */
  makna: string
  sumber: string
  catatan?: string
  /** Jumlah taf'ilah patah yang diharapkan (bawaan 0). Diperiksa oleh test isi. */
  patah?: number
}

export type TampilPeragaan = 'bait' | 'kitabah' | 'huruf' | 'tanda' | 'kelompok' | 'mizan' | 'bahr' | 'timbang' | 'teks' | 'irama'

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
  makna?: string
  /** Syathr yang diperagakan (indeks). */
  syathr: number
  langkah: LangkahPeragaan[]
  /** Syathr yang dikerjakan sendiri setelah peragaan. */
  giliran: { syathr: number; petunjuk: string }
}

export interface SoalPilih {
  soal: string
  pilihan: string[]
  jawaban: number
  alasan: string
  /** Pilihan berupa teks Arab (kitabah, pola kata): ditampilkan besar dan RTL. */
  arab?: boolean
}

export type Tamrin =
  | ({ jenis: 'pilih' } & SoalPilih)
  /** Set soal pilihan ganda dalam satu kartu, dengan skor. */
  | { jenis: 'kenali'; petunjuk: string; soal: SoalPilih[] }
  /** Drill: beri tanda 1/0 pada kata atau frasa pendek, satu per satu. Dibaca tanpa isyba' akhir bait. */
  | { jenis: 'tandai'; petunjuk: string; butir: string[] }
  /** Dari beberapa baris, tandai mana yang pincang. Mesin yang memutuskan; minimal satu lurus dan satu pincang. */
  | { jenis: 'pincang'; petunjuk: string; bahr: KodeBahr; baris: { bait: string[]; catatan?: string }[] }
  | { jenis: 'taqthi'; petunjuk: string; bait: string[]; bahr: KodeBahr; makna?: string }
  /** Dengar irama bait: suku kata pendek dan panjang diputar berurutan; pengguna melagukan bersamanya. */
  | { jenis: 'irama'; petunjuk: string; bait: string[]; bahr: KodeBahr; makna?: string }
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
  | {
      jenis: 'susun'
      petunjuk: string
      bahr: KodeBahr
      makna: string
      bankKata: boolean
      /** Jumlah bait yang disusun (bawaan 1). */
      jumlah?: number
      /** Aturan qafiyah untuk lebih dari satu bait. */
      qafiyah?: 'muzdawij' | 'satu'
      /** Rancangan makna per bait (Boss). */
      rancangan?: string[]
      judulDiwan?: string
    }

export interface Pelajaran {
  nomor: number
  judul: string
  ringkas: string
  menit: number
  analogi: string
  amtsilah: Contoh[]
  bahts: Bahts
  /** Uraian tertulis setelah peragaan Hudhud: membahas setiap contoh, seperti al-bahts an-Nahwul Wadhih. */
  syarh?: string[]
  /** Kesalahan yang sering dibuat penutur 'ajam. */
  keliru?: Keliru[]
  qaidah: string[]
  tamarin: Tamrin[]
  patokan: string
  /** Tautan dengar (YouTube, dengan menit), sudah dicek ada. */
  dengar?: Dengar[]
}

export interface Keliru {
  salah: string
  benar: string
  sebab: string
}

export interface Dengar {
  judul: string
  url: string
  catatan?: string
}

export interface Modul {
  nomor: number
  /** Nama tampilan selain "Modul N", mis. "Boss 1" atau "Bonus". */
  label?: string
  judul: string
  tujuan: string
  pelajaran: Pelajaran[]
  /** Kata baru dari bait-bait modul ini; masuk ke laci (bank kata). */
  laci?: KataBank[]
}

export interface ModulPeta {
  nomor: number
  judul: string
  fokus: string
  hasil: string
  boss?: boolean
  bonus?: boolean
}

export interface Babak {
  nomor: number
  judul: string
  bahr: string
  ringkas: string
  modul: ModulPeta[]
}

export type JenisLaci = 'hasyw' | 'wazan' | 'qafiyah' | 'umum'

export interface KataBank {
  teks: string
  arti: string
  catatan?: string
  /** Laci: frasa pengisi (hasyw), kelompok wazan sharaf, akhiran qafiyah, atau kata umum. */
  laci?: JenisLaci
  /** Asal kata, mis. "Alfiyah bait 1". */
  dari?: string
}

export interface Istilah {
  istilah: string
  ar: string
  arti: string
  jembatan: string
}
