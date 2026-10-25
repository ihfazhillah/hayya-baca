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
      kotak: KotakCetakan[]
      bahr: KodeBahr
      /** Fase E: sasaran makna baris (tugas "isi sesuai makna"). */
      makna?: string
      /** Fase E: arti baris wajib ditulis sebelum disimpan. */
      arti?: true
      /** Laci hanya menampilkan kata bertema ini. */
      tema?: string
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
      /** Mu'aradhah: bait model yang dipinjam bahr dan qafiyahnya. Isian bisa dimulai dari bait ini. */
      pola?: { bait: string[]; sumber: string }
      /** Fase E: arti bait wajib ditulis sebelum salin ke Diwan. */
      arti?: true
      /** Fase E: syarh singkat (i'rab dan makna) wajib sebelum salin ke Diwan. */
      syarh?: true
      /** Fase E: tombol "Salin untuk diperiksa" (ustadz atau Claude). */
      periksa?: true
      /** Laci hanya menampilkan kata bertema ini. */
      tema?: string
      /** Boss (spec 077): bantuan yang masih diberikan dan yang dicabut di sini. */
      bantuan?: { diberi: string[]; dicabut: string[] }
      /** Daftar periksa tashih i'rab sebelum salin ke Diwan; mesin tidak memeriksa lughah. */
      tashih?: true
      /** Tangga latihan bertahap, ditampilkan berurutan. Butir bercalon: pilih sendiri mana yang sewazan dengan `ganti`. */
      tangga?: (string | { teks: string; ganti: string; calon: string[] })[]
    }
  /** Lurus tapi salah (Fase E): semua baris lurus; tandai mana yang salah i'rab, rusak makna, atau keluar tema. */
  | { jenis: 'salah'; petunjuk: string; bahr: KodeBahr; baris: { bait: string[]; salah: JenisSalah | null; alasan: string }[] }
  /** Tebak bahr (spec 077): bait asing tanpa petunjuk; pilih bahrnya, mesin menunjukkan timbangannya. */
  | { jenis: 'tebak'; petunjuk: string; pilihan: KodeBahr[]; baris: { bait: string[]; bahr: KodeBahr; sumber: string }[] }
  /** Panen laci: pilih kata berurutan dari bait yang pas mengisi satu taf'ilah, beri arti, simpan ke Laci saya (spec 077). */
  | {
      jenis: 'panen'
      petunjuk: string
      bait: string[]
      bahr: KodeBahr
      /** Berapa potongan satu taf'ilah utuh yang harus dipanen. */
      jumlah: number
      /** Tampilkan kotak taf'ilah sebagai bantuan (Jilid 1); disembunyikan di jilid berikutnya. */
      kotak: boolean
      sumber: string
    }

export type JenisSalah = "i'rab" | 'makna' | 'tema'

export type Harakat = 'u' | 'a' | 'i' | 'sukun'

export interface KotakCetakan {
  petunjuk: string
  pola: string
  contoh: string[]
  /** Fase E: jenis kata yang diminta, mis. "isim nakirah bertanwin". */
  jenis?: string
  /** Fase E: peran i'rab kotak ini; pelajar memilih peran dan harakat akhirnya diperiksa. */
  peran?: string
  /** Harakat akhir yang semestinya (u = dhammah/marfu', a = fathah/manshub, i = kasrah/majrur). */
  harakat?: Harakat
  /** Tampilkan pilihan tertutup (terima + tolak) sebagai tombol. */
  pilih?: true
  /** Jawaban yang diterima; kata lain ditolak walau lurus. */
  terima?: string[]
  /** Kata yang lurus tetapi salah tempat, dengan alasannya. */
  tolak?: { kata: string; alasan: string }[]
}

export interface Pelajaran {
  nomor: number
  /** Naik bila isi pelajaran ditulis ulang; tanda selesai lama tidak berlaku lagi. */
  versi?: number
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
  /** Jilid 1 (spec 077): semua bait rajaz utuh, dan checker menolak taf'ilah yang berubah. */
  salim?: true
  /** Jilid 2 (spec 077): pelajaran 1 membuka bahr baru dengan bait salim saja (bentuk baku dihitung utuh). */
  salimP1?: true
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
  /** Jilid 1 (salim), 2 (perubahan bertahap), atau 3 (yang sulit), spec 077. */
  jilid?: 1 | 2 | 3
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
  /** Slot yang bisa diisi, mis. "satu مُسْتَفْعِلُنْ utuh" atau "ujung bait". */
  cocok?: string
  /** Modul asal (diisi saat laci digabung); laci hanya menampilkan modul yang sudah dibuka. */
  modul?: number
  /** Medan makna, mis. ["sabar"], untuk laci per tema. */
  tema?: string[]
  /** Bahr asal; kata umum tanpa bahr tampil di semua bahr. */
  bahr?: KodeBahr
}

export interface Istilah {
  istilah: string
  ar: string
  arti: string
  jembatan: string
}
