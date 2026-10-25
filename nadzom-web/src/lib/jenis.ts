/** Satu huruf dalam kitabah 'arudhiyyah. `bit` 1 = hidup (berharakat), 0 = mati (sukun/mad). */
export interface Huruf {
  /** Huruf beserta tandanya, untuk ditampilkan. */
  h: string
  bit: 0 | 1
  /** Indeks kata asal dalam syathr (dipakai untuk jarak antar kata di papan). */
  kata: number
  /** Huruf yang tidak tertulis di teks asli tetapi diucapkan. */
  tambahan?: 'tanwin' | 'isyba' | 'khanjariyah' | 'syaddah' | 'mad'
  /** Bacaan pilihan (isyba' ha' dhamir, mim jama'): penimbang mencoba dengan dan tanpa huruf ini. */
  opsional?: boolean
}

export type Status = 'utuh' | 'berubah' | 'patah'

export interface Bentuk {
  /** Nama taf'ilah dengan harakat, mis. مُسْتَفْعِلُنْ */
  nama: string
  bit: string
  /** Nama perubahan (zihaf atau 'illah) dalam transliterasi; kosong = bentuk utuh. */
  zihaf?: string
  /** Perubahan berupa 'illah: hanya di 'arudh/dharb dan, sekali dipakai, tetap. */
  illah?: boolean
  /** Nama yang lazim di kitab, mis. مُتَفْعِلُنْ → مَفَاعِلُنْ. */
  namaLain?: string
  /** Penilaian ulama untuk zihaf: hasan, shalih, qabih (kurang baik). */
  nilai?: 'hasan' | 'shalih' | 'qabih'
  /** Bentuk baku: perubahan yang wajib di posisi ini (mis. 'arudh basith فَعِلُنْ). Dihitung utuh, juga di Jilid 1. */
  baku?: true
  /** Lagu tanghim per juz, dipisah spasi: لا = 10, نعم = 110, لَ = 1. Lihat `lib/lagu.ts`. */
  lagu?: string
}

/** Nagham bahr dari pengajar 'arudh, diputar lewat embed YouTube. */
export interface DengarBahr {
  /** ID video YouTube. */
  youtube: string
  judul: string
  sumber: string
}

export interface Bahr {
  kode: 'rajaz' | 'ramalMajzu' | 'ramal' | 'kamil' | 'basith' | 'thawil' | 'wafir' | 'mujtats' | 'mutaqarib' | 'khafif' | 'rajazMajzu' | 'kamilMajzu' | 'wafirMajzu' | 'basithMajzu' | 'hazaj'
  nama: string
  namaAr: string
  /** Kunci bahr (miftah al-buhur), dua syathr. */
  kunci: [string, string]
  /** Makna kunci, disesuaikan: kunci menyebut nama bahr sekaligus mengikuti wazannya. */
  kunciMakna: string
  /** Slot taf'ilah: syathr pertama (hasyw + 'arudh) dan kedua (hasyw + dharb). Bentuk tanpa `zihaf` = utuh. */
  slot: [Bentuk[][], Bentuk[][]]
  dengar?: DengarBahr
}

export interface Potongan {
  /** Rentang huruf [mulai, akhir) dalam syathr. */
  mulai: number
  akhir: number
  bit: string
  status: Status
  /** Bentuk yang cocok, atau yang paling dekat bila patah. */
  bentuk: Bentuk
  /** Indeks huruf yang bit-nya tidak sesuai bentuk terdekat. */
  salah: number[]
  catatan: string
}

export interface HasilSyathr {
  huruf: Huruf[]
  potongan: Potongan[]
  patah: number
  /** Bacaan pilihan yang dipakai agar wazannya lurus. */
  bacaanPilihan: string[]
}

export interface HasilBait {
  bahr: Bahr
  syathr: HasilSyathr[]
  patah: number
}
