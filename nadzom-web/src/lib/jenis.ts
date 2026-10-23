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
  /** Nama zihaf/'illah dalam transliterasi; kosong = bentuk utuh. */
  zihaf?: string
}

export interface Bahr {
  kode: 'rajaz' | 'ramalMajzu' | 'ramal'
  nama: string
  namaAr: string
  /** Kunci bahr (miftah al-buhur), dua syathr. */
  kunci: [string, string]
  /** Slot taf'ilah: syathr pertama (hasyw + 'arudh) dan kedua (hasyw + dharb). Bentuk tanpa `zihaf` = utuh. */
  slot: [Bentuk[][], Bentuk[][]]
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
