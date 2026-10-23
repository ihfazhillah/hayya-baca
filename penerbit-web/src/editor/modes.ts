/** Aturan per mode editor (Rancangan Situs §Editor tulisan › Mode editor).
 *  Fungsi murni supaya bisa diuji tanpa Quill. */
import type { OpUbah } from './sorotan'

export type Mode = 'draf_nol' | 'stabilo' | 'revisi' | 'baca'

export interface Kebijakan {
  /** teks bisa diketik/diubah */
  ketik: boolean
  hapus: boolean
  /** judul bab dan dialog */
  format: boolean
  stabilo: boolean
  urungkan: boolean
  /** tempel dari luar editor selalu ditolak di mode menulis */
  tempelLuar: boolean
}

export function kebijakan(mode: Mode, timerBerjalan = false): Kebijakan {
  switch (mode) {
    case 'draf_nol':
      return { ketik: true, hapus: !timerBerjalan, format: false, stabilo: false, urungkan: !timerBerjalan, tempelLuar: false }
    case 'stabilo':
      return { ketik: false, hapus: false, format: false, stabilo: true, urungkan: true, tempelLuar: false }
    case 'revisi':
      return { ketik: true, hapus: true, format: true, stabilo: true, urungkan: true, tempelLuar: false }
    case 'baca':
      return { ketik: false, hapus: false, format: false, stabilo: false, urungkan: false, tempelLuar: false }
  }
}

export const PESAN_HAPUS = 'Boleh jelek, dilarang menghapus.'
export const PESAN_TEMPEL = 'Tulisanmu harus kamu ketik sendiri, ya.'

/** Jenis beforeinput yang menghapus teks. */
export function inputMenghapus(inputType: string): boolean {
  return inputType.startsWith('delete')
}

/** Jenis beforeinput yang memasukkan teks dari luar ketikan. */
export function inputTempel(inputType: string): boolean {
  return inputType === 'insertFromPaste' || inputType === 'insertFromDrop' || inputType === 'insertFromPasteAsQuotation'
}

/** Tombol yang menghapus. */
export function tombolMenghapus(key: string): boolean {
  return key === 'Backspace' || key === 'Delete'
}

function rapikan(t: string): string {
  return t.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
}

/** Tempel hanya boleh untuk teks yang barusan disalin/dipotong dari editor ini sendiri. */
export function bolehTempel(mode: Mode, teksPapan: string, salinanInternal: string | null): boolean {
  const k = kebijakan(mode)
  if (!k.ketik) return false
  if (k.tempelLuar) return true
  if (salinanInternal === null) return false
  const t = rapikan(teksPapan)
  return t.length > 0 && t === rapikan(salinanInternal)
}

/** Potong (cut) = menghapus; diblokir saat menghapus tidak boleh. */
export function bolehPotong(mode: Mode, timerBerjalan: boolean): boolean {
  const k = kebijakan(mode, timerBerjalan)
  return k.ketik && k.hapus
}

export function adaHapusan(ops: OpUbah[]): boolean {
  return ops.some((op) => !!op.delete)
}

/** Delta pemulih: diterapkan ke dokumen BARU supaya semua bagian yang terhapus
 *  kembali, sementara sisipan tetap. `hapusan(i, n)` mengembalikan ops dokumen lama. */
export function opsPemulih(ops: OpUbah[], hapusan: (index: number, length: number) => OpUbah[]): OpUbah[] {
  const out: OpUbah[] = []
  let lama = 0
  let tunda = 0
  const dorongRetain = () => {
    if (tunda) out.push({ retain: tunda })
    tunda = 0
  }
  for (const op of ops) {
    if (op.retain !== undefined) {
      const n = typeof op.retain === 'number' ? op.retain : 1
      tunda += n
      lama += n
    } else if (op.insert !== undefined) {
      tunda += typeof op.insert === 'string' ? op.insert.length : 1
    } else if (op.delete) {
      dorongRetain()
      out.push(...hapusan(lama, op.delete))
      lama += op.delete
    }
  }
  return out
}

/** Ops yang efektif setelah hapusan dipulihkan: delete berubah menjadi retain. */
export function opsTanpaHapus(ops: OpUbah[]): OpUbah[] {
  return ops.map((op) => (op.delete ? { retain: op.delete } : op))
}

export function hitungKata(teks: string): number {
  return teks.split(/\s+/).filter(Boolean).length
}
