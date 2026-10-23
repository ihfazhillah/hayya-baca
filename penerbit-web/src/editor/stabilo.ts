/** Stabilo per alat sebagai format inline Quill sendiri (bukan warna bebas).
 *  - `stabilo`: sorotan anak, kelas `stabilo-<alat>` (blok warna penuh)
 *  - `sistem`: sorotan sistem, kelas `sistem-<alat>` (garis tepi putus-putus)
 *  Nilai berakhiran `_ok` berarti "sudah diperbaiki" (pudar dengan ✓ kecil).
 *  Format hanya dipakai untuk tampilan; sumber kebenaran tetap daftar Sorotan[]. */
import Quill, { Parchment } from 'quill'
import type { Sorotan } from '../types'
import { warnaCss, warnaStabilo } from '../components/ui'
import type { OpUbah } from './sorotan'

export const FORMAT_STABILO = 'stabilo'
export const FORMAT_SISTEM = 'sistem'

let terdaftar = false
export function daftarkanStabilo() {
  if (terdaftar) return
  terdaftar = true
  const opsi = { scope: Parchment.Scope.INLINE }
  Quill.register(
    {
      'formats/stabilo': new Parchment.ClassAttributor(FORMAT_STABILO, 'stabilo', opsi),
      'formats/sistem': new Parchment.ClassAttributor(FORMAT_SISTEM, 'sistem', opsi),
    },
    true,
  )
}

export function nilaiFormat(s: Sorotan): string {
  return s.diperbaiki ? `${s.alat}_ok` : s.alat
}

export function namaFormat(s: Sorotan): string {
  return s.sumber === 'anak' ? FORMAT_STABILO : FORMAT_SISTEM
}

/** Gambar ulang semua sorotan di editor (sumber "silent": tidak masuk riwayat). */
export function gambarSorotan(quill: Quill, daftar: Sorotan[]) {
  const panjang = quill.getLength()
  quill.formatText(0, panjang, { [FORMAT_STABILO]: false, [FORMAT_SISTEM]: false }, 'silent')
  for (const s of daftar) {
    if (s.length <= 0 || s.index >= panjang) continue
    quill.formatText(s.index, Math.min(s.length, panjang - s.index), { [namaFormat(s)]: nilaiFormat(s) }, 'silent')
  }
}

/** Buang atribut stabilo dari Delta yang disimpan (sorotan disimpan terpisah). */
export function tanpaStabilo(ops: OpUbah[]): OpUbah[] {
  return ops.map((op) => {
    if (!op.attributes) return op
    const { [FORMAT_STABILO]: _a, [FORMAT_SISTEM]: _b, ...sisa } = op.attributes
    void _a
    void _b
    const out: OpUbah = { ...op }
    if (Object.keys(sisa).length) out.attributes = sisa
    else delete out.attributes
    return out
  })
}

/** Sisipan membawa atribut stabilo (Quill mewarisi format huruf sebelumnya). */
export function sisipanBerstabilo(ops: OpUbah[]): boolean {
  return ops.some((op) => op.insert !== undefined && !!op.attributes && (FORMAT_STABILO in op.attributes || FORMAT_SISTEM in op.attributes))
}

export interface WarnaAlat {
  kode: string
  warna: string
}

/** CSS warna per alat untuk kelas stabilo-<alat> dan sistem-<alat>. */
export function cssWarna(alat: WarnaAlat[]): string {
  const aman = (k: string) => k.replace(/[^a-z0-9_-]/gi, '')
  return alat
    .map(({ kode, warna }) => {
      const k = aman(kode)
      return [
        `.editor-tulis .stabilo-${k},.editor-tulis .stabilo-${k}_ok{background:${warnaStabilo(warna, 32)};}`,
        `.editor-tulis .sistem-${k},.editor-tulis .sistem-${k}_ok{outline:2px dashed ${warnaCss(warna)};outline-offset:1px;}`,
        `.sorot-${k}{background:${warnaStabilo(warna, 32)};}`,
        `.sorot-sistem-${k}{outline:2px dashed ${warnaCss(warna)};outline-offset:1px;}`,
      ].join('\n')
    })
    .join('\n')
}
