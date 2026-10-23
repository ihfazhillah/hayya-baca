/** Bentuk data dari /api/penerbit/ (lihat backend/penerbit/views). */

export type Peran = 'penulis' | 'pemeriksa' | 'tamu'
export type Tingkat = 'perunggu' | 'perak' | 'emas'
export type TahapMisi = 'bersama' | 'petunjuk' | 'mandiri' | 'dunia_nyata' | 'bonus'
export type JenisMisi = 'tandai' | 'klik' | 'gunting' | 'kembar' | 'cetak' | 'log' | 'perasaan'
export type StatusMisi = 'selesai' | 'menunggu' | 'coba_lagi' | null
export type TahapMentor = 'tanpa' | 'contoh' | 'isian' | 'mandiri'
export type TahapNaskah = 'peta' | 'draf_nol' | 'laci' | 'revisi' | 'terbit'

export interface ProfilRingkas {
  id: number
  nama: string
}

export interface Me {
  peran: Peran[]
  penulis: ProfilRingkas | null
  pemeriksa: ProfilRingkas[]
  bisa_diaktifkan: { child_id: number; nama: string }[]
  tamu: boolean
  /** Orang tua boleh "Lihat sebagai anak" (profil simulasi, tidak menyentuh data anak). */
  bisa_simulasi: boolean
  sedang_simulasi: boolean
}

/** Satu token teks dari tokenizer server. j: kata | spasi | tanda */
export interface Token {
  i: number
  t: string
  j: 'kata' | 'spasi' | 'tanda'
}

export interface Target {
  token: number[]
  celah: number | null
}

export interface HadiahBaru {
  jenis: 'poin' | 'stiker' | 'pangkat'
  jumlah?: number
  alat?: string
  tingkat?: Tingkat
  nama?: string
  emoji?: string
}

export interface Kemajuan {
  sekarang: number
  target: number
}

export interface Slot {
  tingkat: Tingkat
  punya: boolean
  tanggal: string | null
  syarat_teks: string
  oleh_pemeriksa: boolean
  kemajuan: Kemajuan | null
  diberikan_oleh?: string | null
}

export interface Alat {
  kode: string
  nama: string
  emoji: string
  pertanyaan: string
  cara_pakai: string
  contoh_sebelum: string
  contoh_sesudah: string
  /** Token CSS ("--color-actor-1") atau hex. Pakai warnaCss(). */
  warna: string
  pola_cetak: 'gelombang' | 'putus' | 'lingkaran' | 'tebal' | 'titik'
  modul_belajar: number
  terbuka: boolean
  slot: Slot[]
}

export interface AlatRingkas {
  kode: string
  nama: string
  emoji: string
  warna: string
  pertanyaan?: string
}

export interface Beranda {
  nama: string
  lanjutkan: {
    modul: { nomor: number; judul: string; emoji: string }
    misi: { id: number; urutan: number; judul: string } | null
    pertama_kali: boolean
    perkiraan_menit: number
  } | null
  pemanasan: { alat: string[]; ada: boolean }
  peta: { nomor: number; judul: string; level: number; emoji: string; status: 'selesai' | 'aktif' | 'terbuka' | 'terkunci' }[]
  alat: { kode: string; nama: string; emoji: string; warna: string; stiker: Tingkat[] }[]
  pangkat: string | null
  poin: number
  kabar: { tanggal: string; jenis: string; emoji: string; teks: string; catatan: string; oleh: string | null }[]
  coba_lagi: { misi: number; judul: string; modul: number; catatan: string }[]
  menunggu: number
}

export interface MisiRingkas {
  id: number
  urutan: number
  judul: string
  tahap: TahapMisi
  tahap_label: string
  jenis: JenisMisi
  jenis_label: string
  status: StatusMisi
  tautan: string | null
}

export interface Mentor {
  tahap: TahapMentor
  kartu_prompt: string
  pembuka: string
  isian_awal?: string[]
}

export interface ModulTerkunci {
  nomor: number
  judul: string
  emoji: string
  level: number
  terkunci: true
  pesan: string
  modul_sebelumnya: number
}

export interface ModulDetail {
  nomor: number
  judul: string
  emoji: string
  level: number
  terkunci: false
  tujuan: string
  kenapa: string
  langkah: string[]
  resep: string[]
  mengapa: string
  kamus: { istilah: string; arti: string }[]
  lapis: string
  petunjuk_lihat: string
  mentor: Mentor
  bertanya: { a: string; b: string } | null
  misi: MisiRingkas[]
  ujian: { id: number; soal: string; a: string; b: string }[]
  lembar: { kode: string; judul: string }[]
  alat: Alat | null
}

export interface Percobaan {
  diklik: number[]
  meleset: number
  pakai_petunjuk: boolean
}

/** Jawaban yang dibuka setelah selesai. */
export interface Jawaban {
  versi_benar?: string
  /** Misi perasaan: kunci semua soal setelah selesai. */
  soal_jawaban?: KunciPerasaan[]
  kunci?: Target[][]
  potong?: number[][]
  kata?: string[]
  pengganti?: string[]
}

/** Satu langkah Contoh dari Oren: token yang disorot + gelembung pikiran (spec 075 K1). */
export interface LangkahContoh {
  sorot: number[]
  pikir: string
  /** Misi perasaan: perasaan yang dipilih Oren di langkah ini. */
  pilih?: string | null
}

/** Kamera (spec 075 Fase B): satu soal "pilih perasaan + klik bukti". Kunci hanya ada di soal
 *  contoh Oren (`contoh: true`); soal lain dibuka server setelah selesai. */
export interface SoalPerasaan {
  tokens: Token[]
  pilihan: string[]
  jumlah_bukti: number
  contoh?: boolean
  jawaban?: string
  bukti?: number[][]
  alasan?: string
}

export interface KunciPerasaan {
  jawaban: string
  bukti: number[][]
  alasan: string
}

export type BantuanPerasaan =
  | { tingkat: 'tunjuk'; soal: number; token: number[] }
  | { tingkat: 'letak'; soal: number; kalimat: [number, number] | null }
  | null

export interface PercobaanPerasaan {
  /** Soal yang sedang dikerjakan; null bila semua selesai. */
  soal: number | null
  perasaan: string | null
  diklik: number[]
  ditemukan: number
  meleset: number
  selesai_soal: (KunciPerasaan & { soal: number; salah: number })[]
}

export interface HasilPerasaan extends Jawaban, Partial<KunciPerasaan> {
  hasil: 'benar' | 'belum' | 'sudah' | 'ketemu' | 'meleset'
  soal: number | null
  ditemukan: number
  total: number
  meleset: number
  butir_selesai: boolean
  selesai: boolean
  bantuan?: BantuanPerasaan
  hadiah_baru?: HadiahBaru[]
}

/** Bantuan memudar dari server: kesalahan pertama ditunjukkan, kedua letaknya, sisanya tidak ada. */
export type Bantuan =
  | { tingkat: 'tunjuk'; token: number[]; celah: number | null; alasan: string }
  | { tingkat: 'letak'; kalimat: [number, number] }
  /** Detektor Kembar tahap petunjuk: hanya berapa kali kata kembarnya muncul. */
  | { tingkat: 'hitung'; jumlah: number }
  | null

export interface MisiDetail extends Jawaban {
  id: number
  modul: { nomor: number; judul: string; alat: string | null }
  urutan: number
  jumlah_misi: number
  berikutnya: number | null
  judul: string
  tahap: TahapMisi
  tahap_label: string
  jenis: JenisMisi
  petunjuk: string
  petunjuk_ortu?: string
  status: StatusMisi
  tokens?: Token[]
  celah?: boolean
  jumlah?: number
  kata_umum?: string[]
  pertanyaan?: string
  tautan?: string
  kenapa?: string
  langkah?: string[]
  /** Misi LOG: contoh jawaban. Misi klik: langkah Contoh dari Oren. */
  contoh?: string | LangkahContoh[]
  bantuan_memudar?: boolean
  /** Misi perasaan: bentuknya BantuanPerasaan (lihat PilihPerasaan). */
  bantuan?: Bantuan
  /** Misi perasaan (Kamera): soal pilih perasaan + klik bukti. */
  soal?: SoalPerasaan[]
  /** Tampilkan tombol 🔊 (suara perangkat). */
  suara?: boolean
  /** Hanya untuk misi rekam: versi benar misi Si Ceroboh yang sudah selesai. */
  teks_rekam?: { judul: string; teks: string }[]
  lembar?: { kode: string; judul: string }
  percobaan?: Percobaan
}

export interface HasilKlik extends Jawaban {
  hasil: 'ketemu' | 'sudah' | 'meleset'
  ditemukan: number
  total: number
  meleset: number
  boleh_petunjuk: boolean
  selesai: boolean
  hadiah_baru?: HadiahBaru[]
  /** Hanya di misi bantuan_memudar. */
  bantuan?: Bantuan
}

export interface HasilGunting extends Jawaban {
  tepat: number[]
  tidak_perlu: number[]
  kurang: number
  benar: number
  total: number
  selesai: true
  hadiah_baru: HadiahBaru[]
}

export interface HasilKembar extends Jawaban {
  hasil: 'benar' | 'belum'
  meleset?: number
  selesai: boolean
  hadiah_baru?: HadiahBaru[]
}

export interface KartuLatihan {
  id: number
  jenis: JenisMisi
  alat: AlatRingkas | null
  pilihan_alat: AlatRingkas[]
  selesai: boolean
  kata_umum: string[]
  tokens?: Token[]
  celah?: boolean
  jumlah?: number
}

export interface Ide {
  id: number
  teks: string
  sumur: '' | 'kenangan' | 'bagaimana' | 'acak'
  bintang: boolean[]
  tanggal: string
}

export interface Peta4 {
  siapa?: string
  mau_apa?: string
  masalah?: string
  akhir?: string
}

export interface Laci {
  buka: string
  terkunci: boolean
  sisa_detik: number
  dibuka: boolean
}

export interface StempelSlot {
  lapis: 'peta' | 'kamera' | 'gunting' | 'kaca' | 'pembaca'
  nama: string
  punya: boolean
  tanggal: string | null
  catatan: string
}

export interface Sorotan {
  alat: string
  index: number
  length: number
  sumber: 'anak' | 'sistem'
  diperbaiki: boolean
}

/** Quill Delta (JSON). */
export interface Delta {
  ops?: { insert?: unknown; attributes?: Record<string, unknown>; retain?: number; delete?: number }[]
}

export interface NaskahRingkas {
  id: number
  judul: string
  tahap: TahapNaskah
  tahap_label: string
  laci: Laci | null
  stempel: string[]
  nomor_terbitan: string
  stempel_diminta: string
  jumlah_versi: number
  jumlah_kata: number
  created_at: string
}

export interface VersiRingkas {
  nomor: number
  lapis: string
  tanggal: string
  jumlah_kata: number
}

/** Nama tokoh yang tidak dihitung sebagai kata kembar. nama = chip; kata = huruf kecil per kata. */
export interface TokohNaskah {
  nama: string[]
  otomatis: string[]
  tambah: string[]
  abaikan: string[]
  kata: string[]
}

export interface NaskahDetail extends Omit<NaskahRingkas, 'stempel'> {
  peta: Peta4
  tokoh: TokohNaskah
  kartu_tebakan: string
  stempel: StempelSlot[]
  stempel_diminta: string
  lapis_berikutnya: string | null
  versi: VersiRingkas[]
  jumlah_kata_v1: number | null
  draf: {
    isi: Delta
    teks: string
    sorotan: Sorotan[]
    lapis: string
    waktu_klien: number
    menulis_tambahan_dari: number | null
  } | null
  catatan: { teks: string; oleh: string; tanggal: string }[]
  ulasan: { favorit: string; membingungkan: string; pertanyaan: string; versi: number; oleh: string; tanggal: string }[]
  paragraf_favorit: { sebelum?: string; sesudah?: string }
  sampul: string | null
  tentang_penulis: string
}

export interface VersiDetail extends VersiRingkas {
  isi: Delta
  teks: string
  sorotan: Sorotan[]
}

export interface JejakCerita {
  naskah: number
  judul: string
  tanggal: string
  jumlah_kata: number
  kalimat_terpanjang: number
  kata_kembar: string
  kata_kembar_jumlah: number
  kalimat_perasaan: number
  kesalahan_ejaan: number
  ejaan_per_100: number
  /** nama tokoh naskah ini (tidak dihitung sebagai kata kembar) */
  tokoh?: string[]
}

export interface Lembar {
  kode: string
  judul: string
  petunjuk: string
  soal: string
  baris_tulis: number
  pertanyaan_bantu: string
  cek_sendiri: string[]
  kriteria: string
  contoh_jawaban: string
  saran_stiker: string
  modul: { nomor: number; judul: string }
}

export interface Buku {
  id: number
  judul: string
  nomor_terbitan: string
  sampul: string | null
  tanggal_terbit: string | null
  penulis?: string
  teks?: string
  isi?: Delta
  tentang_penulis?: string
  paragraf_favorit?: { sebelum?: string; sesudah?: string }
}

// ---- Pemeriksa ----

export interface Dasbor {
  penulis: ProfilRingkas
  perlu_tindakan: { lembar: number; stempel: number; penukaran: number; pertanyaan?: number; kartu_pamer?: number }
  minggu_ini: { sesi: number; misi_selesai: number; kata_draf_nol: number; alat: string | null }
  persiapan: { modul: { nomor: number; judul: string; petunjuk_lihat: string; lembar: string[] } | null }
  aktivitas: { tanggal: string; teks: string }[]
}

export interface PemeriksaanRingkas {
  id: number
  kode: string
  judul: string
  modul: number
  status: 'menunggu' | 'bagus' | 'coba_lagi'
  catatan: string
  tanggal_cetak: string
  diperiksa_oleh: string | null
}

export interface PemeriksaanDetail extends PemeriksaanRingkas {
  lembar: Lembar
  misi: string | null
  alat: string | null
}

export interface NaskahOrtu extends NaskahDetail {
  versi_terakhir: { nomor: number; teks: string; isi: Delta; sorotan: Sorotan[]; lapis: string } | null
  dibagikan: string[]
  jejak: { kesalahan_ejaan: number; kesalahan_ejaan_ortu: number | null } | null
}

export interface HadiahItem {
  id: number
  nama: string
  harga: number
  aktif?: boolean
}

export interface PenukaranItem {
  id: number
  hadiah: string
  harga?: number
  status: 'diajukan' | 'disetujui' | 'ditunda'
  tanggal: string
}

export interface PromptAnak {
  id: number
  modul: number
  tahap: TahapMentor
  bagian: string[]
  teks: string
  refleksi_bantu: '' | 'ya' | 'sedikit' | 'tidak'
  refleksi_ubah: string
  catatan_ortu: string
  tanggal: string
}

// ---- Belajar mandiri (Spec 075 K2, K3) ----
export interface Pertanyaan {
  id: number
  teks: string
  dibuat?: string
  modul?: { nomor: number; judul: string } | null
  misi?: { id: number; urutan: number; judul: string } | null
  dijawab: boolean
  dijawab_pada?: string | null
  dijawab_oleh?: string | null
  catatan: string
}

/** Sebelum/sesudah teks Si Ceroboh yang sudah dibetulkan anak (dihitung server). */
export interface HasilPamer { misi: number; judul: string; sebelum: string; sesudah: string }

export interface KartuPamer {
  id: number
  pelajaran: string
  reaksi_emoji: string
  reaksi: string
  reaksi_oleh: string | null
  reaksi_pada?: string | null
}

export interface KartuPamerModul { tersedia: boolean; hasil: HasilPamer | null; kartu: KartuPamer | null }

export interface KartuPamerOrtu extends KartuPamer {
  dibuat: string
  diubah: string
  modul: { nomor: number; judul: string; emoji: string }
  hasil: HasilPamer | null
  alat: { kode: string; nama: string; emoji: string; stiker: Tingkat[] } | null
}
