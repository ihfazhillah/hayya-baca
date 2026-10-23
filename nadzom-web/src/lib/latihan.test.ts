import { describe, expect, it } from 'vitest'
import { kitabahBait } from './kitabah'
import { BAHR } from './bahr'
import { timbangBait } from './timbang'
import { diwanMarkdown, periksaPotong, periksaTanda, pilihanKitabah, pisahQasidah, teksKitabah } from './latihan'
import { periksaQafiyah, qafiyah } from './qafiyah'

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

describe('qafiyah: rawiy, harakatnya, dan ridf', () => {
  const k = (bait: string[]) => {
    const r = kitabahBait(bait)
    if (!r.ok) throw new Error(r.galat)
    return r.syathr
  }

  it('ـانِ: rawiy nun, majra kasrah, ridf alif (Nuniyah Ibnul Qayyim)', () => {
    const [s1, s2] = k(['حُكْمُ الْمَحَبَّةِ ثَابِتُ الْأَرْكَانِ', 'مَا لِلصُّدُودِ بِفَسْخِ ذَاكَ يَدَانِ'])
    expect(qafiyah(s2)).toEqual({ rawiy: 'ن', harakat: 'kasrah', ridf: 'ا' })
    expect(qafiyah(s1)).toEqual(qafiyah(s2))
  })

  it('ha di ujung setelah huruf hidup adalah wasl; rawiy huruf sebelumnya (Dzat al-Amtsal, Alfiyah)', () => {
    const [a, b] = k(['الْحَمْدُ لِلَّهِ عَلَى تَقْدِيرِهِ', 'وَحُسْنِ مَا صَرَّفَ مِنْ أُمُورِهِ'])
    expect(qafiyah(a)).toEqual({ rawiy: 'ر', harakat: 'kasrah', ridf: 'ي' })
    expect(qafiyah(b)).toMatchObject({ rawiy: 'ر', harakat: 'kasrah', ridf: 'و' })
    const [c, d] = k(['وَأَسْتَعِينُ اللَّهَ فِي أَلْفِيَّهْ', 'مَقَاصِدُ النَّحْوِ بِهَا مَحْوِيَّهْ'])
    expect(qafiyah(c)).toEqual({ rawiy: 'ي', harakat: 'fathah' })
    expect(qafiyah(d)).toEqual(qafiyah(c))
    const [e] = k(['وَاللَّهُ يَقْضِي بِهِبَاتٍ وَافِرَهْ', 'لِي وَلَهُ فِي دَرَجَاتِ الْآخِرَهْ'])
    expect(periksaQafiyah([[e, d]], 'muzdawij').map((m) => m.bait)).toEqual([1])
  })

  it('qafiyah muqayyadah: rawiy bersukun (الزُّبُرْ)', () => {
    const [, s2] = k(['دَارٌ لِسَلْمَى إِذْ سُلَيْمَى جَارَةٌ', 'قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ'])
    expect(qafiyah(s2)).toEqual({ rawiy: 'ر', harakat: 'sukun' })
  })

  it('muzdawij: setiap bait berqafiyah sendiri, dua syathrnya harus sama', () => {
    const baik = [
      k(['قَالَ مُحَمَّدٌ هُوَ ابْنُ مَالِكِ', 'أَحْمَدُ رَبِّي اللَّهَ خَيْرَ مَالِكِ']),
      k(['وَأَسْتَعِينُ اللَّهَ فِي أَلْفِيَّهْ', 'مَقَاصِدُ النَّحْوِ بِهَا مَحْوِيَّهْ']),
    ]
    expect(periksaQafiyah(baik, 'muzdawij')).toEqual([])
    const pincang = [baik[0], k(['وَأَسْتَعِينُ اللَّهَ فِي أَلْفِيَّهْ', 'قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ'])]
    expect(periksaQafiyah(pincang, 'muzdawij').map((m) => m.bait)).toEqual([2])
  })

  it('satu qafiyah: ujung setiap bait mengikuti bait pertama, termasuk harakat rawiy', () => {
    const b1 = k(['حُكْمُ الْمَحَبَّةِ ثَابِتُ الْأَرْكَانِ', 'مَا لِلصُّدُودِ بِفَسْخِ ذَاكَ يَدَانِ'])
    const b2 = k(['زِيَادَةُ الْمَرْءِ فِي دُنْيَاهُ نُقْصَانُ', 'وَرِبْحُهُ غَيْرَ مَحْضِ الْخَيْرِ خُسْرَانُ'])
    const m = periksaQafiyah([b1, b2], 'satu')
    expect(m.map((x) => x.bait)).toEqual([2])
    expect(m[0].pesan).toMatch(/kasrah/)
  })
})

describe('pisah qasidah: teks banyak bait', () => {
  it('satu bait per baris dengan |, atau dua baris berurutan per bait', () => {
    expect(pisahQasidah('أ ب | ج د\nهـ و\nز ح\n\nط ي | ك ل')).toEqual([['أ ب', 'ج د'], ['هـ و', 'ز ح'], ['ط ي', 'ك ل']])
  })
  it('syathr yang belum berpasangan tetap menjadi bait sendiri', () => {
    expect(pisahQasidah('أ ب | ج د\nهـ و')).toEqual([['أ ب', 'ج د'], ['هـ و']])
  })
})
