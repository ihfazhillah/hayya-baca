import { describe, expect, it } from 'vitest'
import { kitabahBait } from './kitabah'
import { latinKeHuruf } from './latin'
import { timbangBait, tebakBahr } from './timbang'
import { BAHR } from './bahr'
import type { Huruf } from './jenis'

const bits = (h: Huruf[]) => h.map((x) => x.bit).join('')
const tampil = (h: Huruf[]) => h.map((x) => x.h).join('')

function kitabahOk(bait: string[]) {
  const k = kitabahBait(bait)
  if (!k.ok) throw new Error(k.galat)
  return k.syathr
}

describe('kitabah \'arudhiyyah: syahid rajaz tam (al-\'Uyun al-Ghamizah)', () => {
  const bait = ['دَارٌ لِسَلْمَى إِذْ سُلَيْمَى جَارَةٌ', 'قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ']

  it('tanwin menjadi nun sakinah; tanwin di akhir syathr pertama tetap نْ («ما جارتن»)', () => {
    const [s1] = kitabahOk(bait)
    expect(bits(s1)).toBe('1010110'.repeat(3))
    expect(tampil(s1.slice(0, 4))).toBe('دَارُنْ')
    expect(tampil(s1.slice(-5))).toBe('جَارَتُنْ')
  })

  it('hamzah washal gugur dan lam syamsiyah lebur («مثل ززبر»), آ = ءَا', () => {
    const [, s2] = kitabahOk(bait)
    expect(bits(s2)).toBe('1010110'.repeat(3))
    expect(tampil(s2.slice(-7))).toBe('مِثْلَزْزُبُرْ')
    expect(tampil(s2.slice(7, 14))).toBe('ءَايَاتِهَا')
  })

  it('enam taf\'ilah utuh, tanpa patah', () => {
    const h = timbangBait(kitabahOk(bait), BAHR.rajaz)
    expect(h.patah).toBe(0)
    expect(h.syathr.flatMap((s) => s.potongan.map((p) => p.status))).toEqual(Array(6).fill('utuh'))
    expect(h.syathr[0].potongan.map((p) => tampil(h.syathr[0].huruf.slice(p.mulai, p.akhir))))
      .toEqual(['دَارُنْلِسَلْ', 'مَىإِذْسُلَيْ', 'مَىجَارَتُنْ'])
  })

  it('tebak bahr: rajaz', () => {
    expect(tebakBahr(kitabahOk(bait)).bahr.kode).toBe('rajaz')
  })
})

describe('contoh Abu Qudamah (at-Talkhishat asy-Syafiyah, درس 11)', () => {
  const bait = ['لِلّٰهِ دَرُّ حَافِظِ بْنِ أَحْمَدَا', 'ابْنِ عَلِيِّ الْحَكَمِيِّ مَحْتِدَا']

  it('مستفعلن متفعلن متفعلن / مستعلن مستعلن متفعلن, tanpa patah', () => {
    const h = timbangBait(kitabahOk(bait), BAHR.rajaz)
    expect(h.patah).toBe(0)
    expect(h.syathr[0].potongan.map((p) => p.bit)).toEqual(['1010110', '110110', '110110'])
    expect(h.syathr[1].potongan.map((p) => p.bit)).toEqual(['101110', '101110', '110110'])
    expect(h.syathr[0].potongan.map((p) => p.status)).toEqual(['utuh', 'berubah', 'berubah'])
    expect(h.syathr[1].potongan[0].bentuk.zihaf).toBe('thayy')
  })

  it('alif washal di awal syathr dibaca hamzah berharakat (ابْنِ → إِبْنِ)', () => {
    const [, s2] = kitabahOk(bait)
    expect(s2[0]).toMatchObject({ h: 'إِ', bit: 1 })
  })
})

describe('Alfiyah bait 1: mad gugur sebelum hamzah washal, lafzh Allah', () => {
  const bait = ['قَالَ مُحَمَّدٌ هُوَ ابْنُ مَالِكِ', 'أَحْمَدُ رَبِّي اللَّهَ خَيْرَ مَالِكِ']

  it('رَبِّي اللَّهَ → بِلْلَاهَ; isyba\' di akhir syathr (مَالِكِي)', () => {
    const [s1, s2] = kitabahOk(bait)
    expect(bits(s1)).toBe('101110' + '110110' + '110110')
    expect(bits(s2)).toBe('101110' + '1010110' + '110110')
    expect(tampil(s2.slice(6, 11))).toBe('بِلْلَاهَ')
    expect(s1.at(-1)).toMatchObject({ h: 'ي', bit: 0, tambahan: 'isyba' })
  })

  it('rajaz, semua taf\'ilah sah', () => {
    expect(timbangBait(kitabahOk(bait), BAHR.rajaz).patah).toBe(0)
  })
})

describe('rajaz Khandaq: zihaf tidak dicap patah', () => {
  const bait = ['نَحْنُ الَّذِينَ بَايَعُوا مُحَمَّدَا', 'عَلَى الْجِهَادِ مَا بَقِينَا أَبَدَا']

  it('alif setelah waw jama\'ah tidak dibaca; khabn = berubah', () => {
    const k = kitabahOk(bait)
    expect(bits(k[0])).toBe('1010110' + '110110' + '110110')
    expect(bits(k[1])).toBe('110110' + '110110' + '101110')
    const h = timbangBait(k, BAHR.rajaz)
    expect(h.patah).toBe(0)
    expect(h.syathr[0].potongan[1]).toMatchObject({ status: 'berubah', bentuk: { zihaf: 'khabn' } })
  })
})

describe('ramal majzu\': cetakan لَمْ يَزَلْ فِي الْـ…', () => {
  it('فِي الْقَلْبِ → فِلْقَلْبِ; dua فَاعِلَاتُنْ utuh per syathr; tanwin akhir bait → isyba\'', () => {
    const k = kitabahOk(['لَمْ يَزَلْ فِي الْقَلْبِ نُورٌ', 'لَمْ يَزَلْ فِي الْعَيْشِ خَيْرٌ'])
    expect(bits(k[0])).toBe('1011010'.repeat(2))
    expect(bits(k[1])).toBe('1011010'.repeat(2))
    expect(tampil(k[1].slice(-4))).toBe('خَيْرُو')
    const h = timbangBait(k, BAHR.ramalMajzu)
    expect(h.patah).toBe(0)
    expect(tebakBahr(k).bahr.kode).toBe('ramalMajzu')
  })
})

describe('galat dan pincang', () => {
  it('kata tanpa harakat ditolak, tidak ditebak', () => {
    const k = kitabahBait(['دار لِسَلْمَى'])
    expect(k.ok).toBe(false)
    if (!k.ok) expect(k.kata).toBe('دار')
  })

  it('bait pincang: taf\'ilah yang benar tetap utuh, yang rusak ditandai dengan letak hurufnya', () => {
    const k = kitabahOk(['دَارٌ لِسَلْمَى إِذَا سُلَيْمَى جَارَةٌ', 'قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ'])
    const h = timbangBait(k, BAHR.rajaz)
    expect(h.patah).toBeGreaterThanOrEqual(1)
    expect(h.syathr[0].potongan[0].status).toBe('utuh')
    expect(h.syathr[1].patah).toBe(0)
    const rusak = h.syathr[0].potongan.find((p) => p.status === 'patah')!
    expect(rusak.catatan.length).toBeGreaterThan(0)
  })
})

describe('kunci bahr ditimbang dengan bahrnya sendiri', () => {
  it('kunci rajaz: enam مُسْتَفْعِلُنْ utuh', () => {
    const h = timbangBait(kitabahOk(BAHR.rajaz.kunci), BAHR.rajaz)
    expect(h.syathr.flatMap((s) => s.potongan.map((p) => p.status))).toEqual(Array(6).fill('utuh'))
  })

  it('kunci ramal: فَاعِلَاتُنْ utuh di akhir syathr tetap "utuh", bukan "berubah"', () => {
    const h = timbangBait(kitabahOk(BAHR.ramal.kunci), BAHR.ramal)
    expect(h.patah).toBe(0)
    expect(h.syathr[1].potongan.map((p) => p.status)).toEqual(['utuh', 'utuh', 'utuh'])
  })
})

describe('hamzah washal setelah awalan', () => {
  it('وَاصْبِرْ → وَصْبِرْ (fi\'il amr), bukan alif mad', () => {
    const [s] = kitabahOk(['وَاصْبِرْ عَلَى الدَّرْسِ'])
    expect(tampil(s.slice(0, 4))).toBe('وَصْبِرْ')
  })

  it('بَابٌ: alif setelah huruf berfathah tetap mad', () => {
    const [s] = kitabahOk(['بَابٌ كَبِيرٌ'])
    expect(tampil(s.slice(0, 2))).toBe('بَا')
  })
})

describe('aturan bisa dimatikan (untuk pilihan pengecoh)', () => {
  it('tanpa aturan hamzah washal, hasilnya berbeda', () => {
    const benar = kitabahBait(['مِثْلَ الزُّبُرْ'])
    const salah = kitabahBait(['مِثْلَ الزُّبُرْ'], { matikan: ['hamzahWashal'] })
    expect(benar.ok && salah.ok).toBe(true)
    if (benar.ok && salah.ok) expect(bits(salah.syathr[0])).not.toBe(bits(benar.syathr[0]))
  })
})

describe('suku kata Latin', () => {
  it('daa-run-li-sal … = tiga مُسْتَفْعِلُنْ', () => {
    const s = latinKeHuruf('daa-run-li-sal-maa-idz-su-lai-maa-jaa-ra-tun')
    expect(bits(s)).toBe('1010110'.repeat(3))
  })
})
