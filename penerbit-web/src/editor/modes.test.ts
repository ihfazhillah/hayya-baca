import { describe, expect, it } from 'vitest'
import { bolehPotong, bolehTempel, hitungKata, inputMenghapus, kebijakan, opsPemulih, opsTanpaHapus } from './modes'
import { geserSorotan } from './sorotan'

describe('kebijakan mode', () => {
  it('Draf Nol: menghapus dimatikan hanya saat timer berjalan, tanpa format dan stabilo', () => {
    expect(kebijakan('draf_nol', true)).toMatchObject({ ketik: true, hapus: false, format: false, stabilo: false })
    expect(kebijakan('draf_nol', false).hapus).toBe(true)
  })
  it('Stabilo: teks tidak bisa diubah, stabilo boleh', () => {
    expect(kebijakan('stabilo')).toMatchObject({ ketik: false, stabilo: true })
  })
  it('Revisi: mengetik, menghapus, format, stabilo', () => {
    expect(kebijakan('revisi')).toMatchObject({ ketik: true, hapus: true, format: true, stabilo: true, urungkan: true })
  })
  it('Baca: tidak ada perubahan', () => {
    expect(kebijakan('baca')).toMatchObject({ ketik: false, stabilo: false, urungkan: false })
  })
  it('beforeinput penghapus dikenali', () => {
    expect(inputMenghapus('deleteContentBackward')).toBe(true)
    expect(inputMenghapus('deleteByCut')).toBe(true)
    expect(inputMenghapus('insertText')).toBe(false)
  })
})

describe('tempel dan potong', () => {
  it('tempel dari luar ditolak di Draf Nol dan Revisi', () => {
    expect(bolehTempel('draf_nol', 'Teks dari Gemini', null)).toBe(false)
    expect(bolehTempel('revisi', 'Teks dari Gemini', 'kalimatku sendiri')).toBe(false)
  })
  it('memindah teks di naskah yang sama boleh', () => {
    expect(bolehTempel('revisi', 'Fatih sedih.', 'Fatih sedih.')).toBe(true)
    expect(bolehTempel('revisi', 'Satu.\r\nDua.\n', 'Satu.\nDua.')).toBe(true)
  })
  it('tempel di mode baca dan stabilo tidak pernah boleh', () => {
    expect(bolehTempel('baca', 'x', 'x')).toBe(false)
    expect(bolehTempel('stabilo', 'x', 'x')).toBe(false)
  })
  it('potong (cut) = menghapus, jadi ditolak saat timer Draf Nol berjalan', () => {
    expect(bolehPotong('draf_nol', true)).toBe(false)
    expect(bolehPotong('draf_nol', false)).toBe(true)
    expect(bolehPotong('revisi', false)).toBe(true)
  })
})

describe('memulihkan hapusan di Draf Nol', () => {
  // dokumen lama "abcdef"; pengguna memilih "cd" lalu mengetik "X"
  const ops = [{ retain: 2 }, { insert: 'X' }, { delete: 2 }]
  const lama = 'abcdef'

  it('ops pemulih mengembalikan teks yang terhapus, sisipan tetap', () => {
    const pemulih = opsPemulih(ops, (i, n) => [{ insert: lama.slice(i, i + n) }])
    expect(pemulih).toEqual([{ retain: 3 }, { insert: 'cd' }])
    // terapkan: dokumen baru "abXef" → "abXcdef"
    const baru = 'abXef'
    expect(baru.slice(0, 3) + 'cd' + baru.slice(3)).toBe('abXcdef')
  })

  it('sorotan digeser dengan ops tanpa hapus', () => {
    const [s] = geserSorotan([{ alat: 'kaca', index: 4, length: 2, sumber: 'anak', diperbaiki: false }], opsTanpaHapus(ops))
    expect(s).toMatchObject({ index: 5, length: 2, diperbaiki: false })
  })
})

it('hitungKata sama dengan split() di server', () => {
  expect(hitungKata('  Fatih  sedih.\nDia [???] lari. ')).toBe(5)
  expect(hitungKata('')).toBe(0)
})
