import { describe, expect, it } from 'vitest'
import type { Sorotan } from '../types'
import {
  bawaKeVersiBaru, geserSorotan, gantiSorotanSistem, hapusRentang, hitungSorotan, opsDariTeks, pecahParagraf,
  potongSegmen, tambahSorotan, tandaiDiperbaiki, teksPenghitung,
} from './sorotan'

const TEKS = 'Rak sandalnya kosong. Fatih sedih. Dia mencari di rak atas.'
const iFatih = TEKS.indexOf('Fatih sedih.')
const iRak = TEKS.indexOf('rak atas')

function anak(alat: string, kata: string, teks = TEKS): Sorotan {
  return { alat, index: teks.indexOf(kata), length: kata.length, sumber: 'anak', diperbaiki: false }
}

function isi(teks: string, s: Sorotan) {
  return teks.slice(s.index, s.index + s.length)
}

describe('sorotan: contoh "Fatih sedih."', () => {
  const fatih = anak('kamera', 'Fatih sedih.')
  const rak = anak('kaca', 'rak atas')

  it('tambah sorotan dari pilihan anak', () => {
    const d = tambahSorotan([], 'kamera', iFatih, 'Fatih sedih.'.length)
    expect(d).toEqual([{ alat: 'kamera', index: iFatih, length: 12, sumber: 'anak', diperbaiki: false }])
  })

  it('teks di dalam sorotan diubah → sudah diperbaiki, rentang ikut berubah', () => {
    const baru = TEKS.replace('Fatih sedih.', 'Mata Fatih mulai panas.')
    const [f, r] = tandaiDiperbaiki([fatih, rak], TEKS, baru)
    expect(f.diperbaiki).toBe(true)
    expect(isi(baru, f)).toBe('Mata Fatih mulai panas.')
    // sorotan sesudahnya hanya bergeser
    expect(r.diperbaiki).toBe(false)
    expect(isi(baru, r)).toBe('rak atas')
  })

  it('mengetik tepat sesudah sorotan tidak memperbaikinya dan tidak memperpanjangnya', () => {
    const baru = TEKS.replace('Fatih sedih.', 'Fatih sedih. Lalu dia duduk.')
    const [f] = tandaiDiperbaiki([fatih], TEKS, baru)
    expect(f.diperbaiki).toBe(false)
    expect(isi(baru, f)).toBe('Fatih sedih.')
  })

  it('mengetik tepat sebelum sorotan hanya menggesernya', () => {
    const ops = [{ retain: iFatih }, { insert: 'Aduh. ' }]
    const [f] = geserSorotan([fatih], ops)
    expect(f).toMatchObject({ index: iFatih + 6, length: 12, diperbaiki: false })
  })

  it('menghapus seluruh kalimat yang disorot = sudah diperbaiki, panjang 0', () => {
    const baru = TEKS.replace('Fatih sedih. ', '')
    const [f, r] = tandaiDiperbaiki([fatih, rak], TEKS, baru)
    expect(f.diperbaiki).toBe(true)
    expect(f.length).toBe(0)
    expect(isi(baru, r)).toBe('rak atas')
  })

  it('sisipan di tengah sorotan memperpanjangnya', () => {
    const ops = [{ retain: iFatih + 'Fatih '.length }, { insert: 'sangat ' }]
    const [f] = geserSorotan([fatih], ops)
    const baru = TEKS.replace('Fatih sedih', 'Fatih sangat sedih')
    expect(isi(baru, f)).toBe('Fatih sangat sedih.')
    expect(f.diperbaiki).toBe(true)
  })

  it('status diperbaiki tidak kembali menjadi belum', () => {
    const sudah = { ...fatih, diperbaiki: true }
    const [f] = geserSorotan([sudah], [{ insert: 'X' }])
    expect(f.diperbaiki).toBe(true)
    expect(f.index).toBe(iFatih + 1)
  })

  it('dibawa ke versi baru: sorotan anak ikut, sorotan sistem dibuang', () => {
    const sistem: Sorotan = { alat: 'kembar', index: 0, length: 3, sumber: 'sistem', diperbaiki: false }
    const dibawa = bawaKeVersiBaru([{ ...fatih, diperbaiki: true }, rak, sistem])
    expect(dibawa).toHaveLength(2)
    expect(dibawa[0].diperbaiki).toBe(true)
    expect(dibawa.every((s) => s.sumber === 'anak')).toBe(true)
  })
})

describe('sorotan: menghapus dan menghitung', () => {
  it('hapus sorotan di tengah membelah sorotan anak, sorotan sistem tetap', () => {
    const s: Sorotan = { alat: 'gunting', index: 0, length: 20, sumber: 'anak', diperbaiki: false }
    const sis: Sorotan = { alat: 'kembar', index: 5, length: 3, sumber: 'sistem', diperbaiki: false }
    const d = hapusRentang([s, sis], 5, 5)
    expect(d.filter((x) => x.sumber === 'anak').map((x) => [x.index, x.length])).toEqual([[0, 5], [10, 10]])
    expect(d.some((x) => x.sumber === 'sistem')).toBe(true)
  })

  it('sorotan baru menimpa sorotan anak di tempat yang sama', () => {
    const d = tambahSorotan([anak('kamera', 'Fatih sedih.')], 'pengeras', iFatih, 5)
    expect(d.map((x) => [x.alat, x.index, x.length])).toEqual([
      ['pengeras', iFatih, 5],
      ['kamera', iFatih + 5, 7],
    ])
  })

  it('penghitung: "5 sorotan, 3 sudah diperbaiki"', () => {
    const d: Sorotan[] = [0, 1, 2, 3, 4].map((i) => ({ alat: 'kamera', index: i * 10, length: 3, sumber: 'anak', diperbaiki: i < 3 }))
    const sis = gantiSorotanSistem(d, [{ alat: 'kembar', index: 60, length: 4, sumber: 'sistem', diperbaiki: false }])
    expect(hitungSorotan(sis)).toEqual({ total: 5, diperbaiki: 3, sistem: 1 })
    expect(teksPenghitung(d)).toBe('5 sorotan, 3 sudah diperbaiki')
  })

  it('gantiSorotanSistem mengganti sorotan sistem lama', () => {
    const lama: Sorotan[] = [{ alat: 'kembar', index: 0, length: 3, sumber: 'sistem', diperbaiki: false }, anak('kaca', 'rak atas')]
    const d = gantiSorotanSistem(lama, [{ alat: 'gunting', index: 10, length: 4, sumber: 'sistem', diperbaiki: false }])
    expect(d.map((x) => x.alat)).toEqual(['gunting', 'kaca'])
  })
})

describe('segmen dan paragraf', () => {
  it('potongSegmen membelah teks di tepi sorotan', () => {
    const seg = potongSegmen(TEKS, [anak('kamera', 'Fatih sedih.')])
    expect(seg.map((s) => s.teks).join('')).toBe(TEKS)
    const sorot = seg.find((s) => s.sorotan.length)
    expect(sorot?.teks).toBe('Fatih sedih.')
    expect(iRak).toBeGreaterThan(0)
  })

  it('pecahParagraf memberi posisi awal tiap baris', () => {
    const p = pecahParagraf('Satu.\n\nDua.')
    expect(p).toEqual([{ teks: 'Satu.', index: 0 }, { teks: 'Dua.', index: 7 }])
  })

  it('opsDariTeks: satu daerah berubah', () => {
    expect(opsDariTeks('abcdef', 'abXYef')).toEqual([{ retain: 2 }, { delete: 2 }, { insert: 'XY' }])
  })
})
