/** Model sorotan stabilo: daftar Sorotan[] (index/length di teks polos) yang disimpan
 *  di samping Delta. Semua fungsi di sini murni, tanpa Quill. */
import type { Sorotan } from '../types'

/** Satu op Delta (cukup bagian yang dipakai untuk menggeser posisi). */
export interface OpUbah {
  insert?: unknown
  retain?: number | Record<string, unknown>
  delete?: number
  attributes?: Record<string, unknown>
}

interface Suntingan {
  /** posisi di teks lama */
  p: number
  hapus: number
  sisip: number
}

function panjangSisip(insert: unknown): number {
  return typeof insert === 'string' ? insert.length : 1
}

/** Ubah ops Delta menjadi daftar suntingan berurutan dalam koordinat teks lama. */
function keSuntingan(ops: OpUbah[]): Suntingan[] {
  const out: Suntingan[] = []
  let pos = 0
  for (const op of ops) {
    if (op.retain !== undefined) {
      pos += typeof op.retain === 'number' ? op.retain : 1
    } else if (op.delete) {
      const akhir = out[out.length - 1]
      if (akhir && akhir.p + akhir.hapus === pos) akhir.hapus += op.delete
      else out.push({ p: pos, hapus: op.delete, sisip: 0 })
      pos += op.delete
    } else if (op.insert !== undefined) {
      const m = panjangSisip(op.insert)
      const akhir = out[out.length - 1]
      if (akhir && akhir.p + akhir.hapus === pos) akhir.sisip += m
      else out.push({ p: pos, hapus: 0, sisip: m })
    }
  }
  return out
}

/** Petakan posisi lama ke posisi baru. `awal` = tepi kiri sorotan (sisipan tepat di
 *  tepi kiri berada di luar sorotan), selain itu tepi kanan. */
function petakan(x: number, sunting: Suntingan[], awal: boolean): number {
  let geser = 0
  for (const s of sunting) {
    if (x < s.p) break
    if (x === s.p) {
      return x + geser + (awal && s.hapus === 0 ? s.sisip : 0)
    }
    if (x < s.p + s.hapus) {
      return s.p + geser + (awal ? 0 : s.sisip)
    }
    geser += s.sisip - s.hapus
  }
  return x + geser
}

function tersentuh(a: number, b: number, sunting: Suntingan[]): boolean {
  return sunting.some((s) => {
    if (s.hapus > 0 && s.p < b && s.p + s.hapus > a) return true
    return s.sisip > 0 && s.p > a && s.p < b
  })
}

/** Geser sorotan mengikuti perubahan teks. Sorotan yang isinya berubah menjadi
 *  "sudah diperbaiki" (tidak pernah kembali ke belum). Sorotan yang teksnya dihapus
 *  seluruhnya tetap tercatat dengan panjang 0. */
export function geserSorotan(daftar: Sorotan[], ops: OpUbah[]): Sorotan[] {
  const sunting = keSuntingan(ops)
  if (!sunting.length) return daftar
  return daftar.map((s) => {
    const a = s.index
    const b = s.index + s.length
    const a2 = petakan(a, sunting, true)
    const b2 = Math.max(a2, petakan(b, sunting, false))
    const ubah = s.length > 0 && tersentuh(a, b, sunting)
    return { ...s, index: a2, length: b2 - a2, diperbaiki: s.diperbaiki || ubah }
  })
}

/** Ops dari dua teks: satu daerah berubah (awalan dan akhiran yang sama dilewati). */
export function opsDariTeks(lama: string, baru: string): OpUbah[] {
  let p = 0
  const maks = Math.min(lama.length, baru.length)
  while (p < maks && lama[p] === baru[p]) p++
  let s = 0
  while (s < maks - p && lama[lama.length - 1 - s] === baru[baru.length - 1 - s]) s++
  const ops: OpUbah[] = []
  if (p) ops.push({ retain: p })
  const hapus = lama.length - p - s
  const sisip = baru.slice(p, baru.length - s)
  if (hapus) ops.push({ delete: hapus })
  if (sisip) ops.push({ insert: sisip })
  return ops
}

/** Tandai sorotan yang sudah diperbaiki dengan membandingkan teks lama dan baru. */
export function tandaiDiperbaiki(daftar: Sorotan[], lama: string, baru: string): Sorotan[] {
  return geserSorotan(daftar, opsDariTeks(lama, baru))
}

/** Sorotan dibawa ke versi baru: sorotan anak ikut (beserta status diperbaiki),
 *  sorotan sistem dibuang karena dihitung ulang untuk lapis berikutnya. */
export function bawaKeVersiBaru(daftar: Sorotan[]): Sorotan[] {
  return daftar.filter((s) => s.sumber === 'anak').map((s) => ({ ...s }))
}

function urut(daftar: Sorotan[]): Sorotan[] {
  return [...daftar].sort((x, y) => x.index - y.index || x.length - y.length)
}

/** Potong rentang dari sorotan anak (bisa membelah satu sorotan jadi dua). */
export function hapusRentang(daftar: Sorotan[], index: number, length: number): Sorotan[] {
  const akhir = index + length
  const out: Sorotan[] = []
  for (const s of daftar) {
    const b = s.index + s.length
    if (s.sumber !== 'anak' || b <= index || s.index >= akhir) {
      out.push(s)
      continue
    }
    if (s.index < index) out.push({ ...s, length: index - s.index })
    if (b > akhir) out.push({ ...s, index: akhir, length: b - akhir })
  }
  return urut(out)
}

/** Tambah sorotan anak baru; sorotan anak lain di rentang yang sama ditimpa. */
export function tambahSorotan(daftar: Sorotan[], alat: string, index: number, length: number): Sorotan[] {
  if (length <= 0) return daftar
  const sisa = hapusRentang(daftar, index, length)
  return urut([...sisa, { alat, index, length, sumber: 'anak', diperbaiki: false }])
}

/** Ganti seluruh sorotan sistem dengan daftar baru dari server. */
export function gantiSorotanSistem(daftar: Sorotan[], sistem: Sorotan[]): Sorotan[] {
  return urut([...daftar.filter((s) => s.sumber === 'anak'), ...sistem.map((s) => ({ ...s, sumber: 'sistem' as const }))])
}

/** Penghitung di atas editor: "5 sorotan, 3 sudah diperbaiki" (sorotan anak). */
export function hitungSorotan(daftar: Sorotan[]) {
  const anak = daftar.filter((s) => s.sumber === 'anak')
  return {
    total: anak.length,
    diperbaiki: anak.filter((s) => s.diperbaiki).length,
    sistem: daftar.filter((s) => s.sumber === 'sistem').length,
  }
}

export function teksPenghitung(daftar: Sorotan[]): string {
  const h = hitungSorotan(daftar)
  const bagian = [`${h.total} sorotan, ${h.diperbaiki} sudah diperbaiki`]
  if (h.sistem) bagian.push(`${h.sistem} tanda dari sistem`)
  return bagian.join(' · ')
}

export interface Segmen {
  teks: string
  /** posisi awal di teks */
  index: number
  sorotan: Sorotan[]
}

/** Belah teks menjadi potongan dengan sorotan yang aktif di tiap potongan
 *  (untuk tampilan cetak dan Sebelum-Sesudah tanpa Quill). */
export function potongSegmen(teks: string, daftar: Sorotan[], mulai = 0, selesai = teks.length): Segmen[] {
  const batas = new Set<number>([mulai, selesai])
  for (const s of daftar) {
    if (s.length <= 0) continue
    const a = Math.max(mulai, s.index)
    const b = Math.min(selesai, s.index + s.length)
    if (a < b) {
      batas.add(a)
      batas.add(b)
    }
  }
  const titik = [...batas].sort((x, y) => x - y)
  const out: Segmen[] = []
  for (let i = 0; i < titik.length - 1; i++) {
    const a = titik[i]
    const b = titik[i + 1]
    out.push({
      teks: teks.slice(a, b),
      index: a,
      sorotan: daftar.filter((s) => s.length > 0 && s.index <= a && s.index + s.length >= b),
    })
  }
  return out
}

export interface Paragraf {
  teks: string
  index: number
}

/** Paragraf (baris) beserta posisi awalnya di teks. Baris kosong dilewati. */
export function pecahParagraf(teks: string): Paragraf[] {
  const out: Paragraf[] = []
  let pos = 0
  for (const baris of teks.split('\n')) {
    if (baris.trim()) out.push({ teks: baris, index: pos })
    pos += baris.length + 1
  }
  return out
}
