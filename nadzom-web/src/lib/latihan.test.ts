import { describe, expect, it } from 'vitest'
import { kitabahBait } from './kitabah'
import { BAHR } from './bahr'
import { timbangBait } from './timbang'
import { diwanMarkdown, periksaPotong, periksaTanda, pilihanKitabah, teksKitabah } from './latihan'

const syathr = (teks: string, akhir = true) => {
  const k = kitabahBait(akhir ? [teks] : [teks, 'لَا'])
  if (!k.ok) throw new Error(k.galat)
  return k.syathr[0]
}

describe('pilihan kitabah (latihan langkah 1)', () => {
  it('satu benar + pengecoh dari aturan yang dimatikan, tanpa duplikat', () => {
    const p = pilihanKitabah(['دَارٌ لِسَلْمَى إِذْ سُلَيْمَى جَارَةٌ', 'قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ'], 1)
    expect(p.pilihan[p.benar]).toBe('قَفْرُنْ تَرَى ءَايَاتِهَا مِثْلَ زْزُبُرْ')
    expect(p.pilihan.length).toBeGreaterThanOrEqual(3)
    expect(new Set(p.pilihan).size).toBe(p.pilihan.length)
  })
})

describe('periksa tanda dan potongan', () => {
  const s = syathr('دَارٌ لِسَلْمَى إِذْ سُلَيْمَى جَارَةٌ', false)

  it('tanda: benar per huruf', () => {
    const jawab = s.map((h) => h.bit as 0 | 1 | null)
    jawab[1] = 1
    const r = periksaTanda(s, jawab)
    expect(r.filter((x) => !x)).toHaveLength(1)
    expect(r[1]).toBe(false)
  })

  it('potongan: sah bila setiap potongan cocok dengan bentuk yang dikenal', () => {
    expect(periksaPotong(s, [7, 14], BAHR.rajaz.slot[0]).benar).toBe(true)
    const salah = periksaPotong(s, [6, 14], BAHR.rajaz.slot[0])
    expect(salah.benar).toBe(false)
    expect(salah.segmen[0].cocok).toBeUndefined()
  })
})

describe('Diwan', () => {
  it('Markdown berisi bait, bahr, pola, dan jumlah patah', () => {
    const k = kitabahBait(['بَدَأْتُ نَظْمِي حَامِدًا لِلْأَوَّلِ', 'وَصَلَّيْتُ عَلَى النَّبِيِّ الْمُرْسَلِ'])
    if (!k.ok) throw new Error()
    const md = diwanMarkdown('Bait #1 v1', ['بَدَأْتُ نَظْمِي حَامِدًا لِلْأَوَّلِ', 'وَصَلَّيْتُ عَلَى النَّبِيِّ الْمُرْسَلِ'], timbangBait(k.syathr, BAHR.rajaz), new Date('2026-10-23'))
    expect(md).toContain('### Bait #1 v1')
    expect(md).toContain('بَدَأْتُ نَظْمِي حَامِدًا لِلْأَوَّلِ')
    expect(md).toContain('Bahr: Rajaz')
    expect(md).toContain('Patah: 1')
    expect(md).toContain('2026-10-23')
  })

  it('teks kitabah dipisah per kata', () => {
    expect(teksKitabah(syathr('دَارٌ لِسَلْمَى', false))).toBe('دَارُنْ لِسَلْمَى')
  })
})
