import { describe, expect, it } from 'vitest'
import { kitabahBait } from './kitabah'
import { latinKeHuruf } from './latin'
import { slotSyathr, timbangBait, tebakBahr } from './timbang'
import { BAHR } from './bahr'
import { bitLagu, juzBentuk, laguBahr } from './lagu'
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

describe('review \'arudh (2026-10-23)', () => {
  const bitLepas = (teks: string) => {
    const k = kitabahBait([teks], { tanpaAkhir: true })
    if (!k.ok) throw new Error(k.galat)
    return bits(k.syathr[0])
  }

  it('tasri\'/muzdawij: \'arudh boleh memakai bentuk dharb (Alfiyah bait 2, مَفْعُولُنْ di kedua ujung)', () => {
    const h = timbangBait(kitabahOk(['وَأَسْتَعِينُ اللَّهَ فِي أَلْفِيَّهْ', 'مَقَاصِدُ النَّحْوِ بِهَا مَحْوِيَّهْ']), BAHR.rajaz)
    expect(h.patah).toBe(0)
    expect(h.syathr[0].potongan[2].bit).toBe('101010')
  })

  it('tanpa tasri\', \'arudh tetap tidak menerima \'illah dharb', () => {
    const h = timbangBait(kitabahOk(['وَأَسْتَعِينُ اللَّهَ فِي أَلْفِيَّهْ', 'قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ']), BAHR.rajaz)
    expect(h.syathr[0].patah).toBe(1)
  })

  it('lam ta\'rif setelah لِ lebur ke huruf syamsiyah (لِلنَّاسِ → لِنْنَاسِ), bertulis sukun pun sama', () => {
    expect(bitLepas('لِلنَّاسِ')).toBe('10101')
    expect(bitLepas('لِلْنَّاسِ')).toBe('10101')
    expect(bitLepas('لِلْعِلْمِ')).toBe('10101')
  })

  it('lam ta\'rif setelah وَلِ / فَلِ juga lebur (Tuhfat al-Athfal bait 6: وَلِلتَّنْوِينِ)', () => {
    const k = kitabahBait(['لِلنُّونِ إِنْ تَسْكُنْ وَلِلتَّنْوِينِ', 'أَرْبَعُ أَحْكَامٍ فَخُذْ تَبْيِينِي'])
    if (!k.ok) throw new Error(k.galat)
    expect(tampil(k.syathr[0].slice(-9))).toBe('وَلِتْتَنْوِينِي')
    expect(timbangBait(k.syathr, BAHR.rajaz).patah).toBe(0)
  })

  it('hamzah washal sebelum huruf bersyaddah setelah وَ/فَ (وَاتَّخِذْ → وَتْتَخِذْ)', () => {
    const k = kitabahBait(['وَاتَّخِذْ لِلْعِلْمِ دَارَا'], { tanpaAkhir: true })
    if (!k.ok) throw new Error(k.galat)
    expect(tampil(k.syathr[0].slice(0, 5))).toBe('وَتْتَخِذْ')
  })

  it('isyba\' ha dhamir setelah huruf mati boleh dipakai bila meluruskan wazan (وَجَاوِزْهُو, \'Amr bin Ma\'dikarib)', () => {
    const h = timbangBait(kitabahOk(['إِذَا لَمْ تَسْتَطِعْ شَيْئًا فَدَعْهُ', 'وَجَاوِزْهُ إِلَى مَا تَسْتَطِيعُ']), BAHR.wafir)
    expect(h.patah).toBe(0)
    expect(h.syathr[1].potongan[0].bit).toBe('1101010')
    expect(h.syathr[1].potongan[0].bentuk.zihaf).toBe("'ashb")
  })

  it('ha lafzh al-jalalah bukan ha dhamir: tidak diberi isyba\' di tengah syathr («وَالْحَمْدُ لِلَّهِ مَدَى الدَّوَامِ», \'Imrithi)', () => {
    const k = kitabahBait(['وَالْحَمْدُ لِلَّهِ مَدَى الدَّوَامِ'])
    if (!k.ok) throw new Error(k.galat)
    expect(k.syathr[0].some((h) => h.opsional)).toBe(false)
    expect(timbangBait(k.syathr, BAHR.rajaz).syathr[0].potongan.map((p) => p.bit)).toEqual(['1010110', '101110', '11010'])
  })

  it('alif khanjariyah pada kata berakhiran dhamir atau ber-ال', () => {
    expect(bitLepas('لَكِنَّهُ')).toBe('101011')
    expect(bitLepas('إِلَهَكَ')).toBe('11011')
    expect(bitLepas('الْإِلَهِ')).toBe('101101')
    expect(bitLepas('أُولَئِكَ')).toBe('11011')
    expect(bitLepas('كَذَلِكَ')).toBe('11011')
  })

  it('alif setelah waw jama\'ah yang didahului fathah tidak dibaca (سَعَوْا)', () => {
    expect(bitLepas('سَعَوْا لَهُ')).toBe('11011')
  })

  it('hamzah washal di tengah kata setelah awalan (لِلِاسْمِ، بِالِاسْمِ)', () => {
    expect(bitLepas('لِلِاسْمِ')).toBe('1101')
    expect(bitLepas('بِالِاسْمِ')).toBe('1101')
  })

  it('alif mad sebelum huruf sukun di akhir kata tetap mad (الشَّمَالْ)', () => {
    expect(bitLepas('الشَّمَالْ')).toBe('101100')
  })

  it('ramal tam: dharb maqshur فَاعِلَانْ dan \'arudh mahdzufah فَاعِلُنْ', () => {
    const s1 = latinKeHuruf('faa-i-laa-tun-faa-i-laa-tun-faa-i-lun')
    const s2 = latinKeHuruf('faa-i-laa-tun-faa-i-laa-tun-faa-i-laan')
    expect(timbangBait([s1, s2], BAHR.ramal).patah).toBe(0)
  })

  it('ramal majzu\': dharb mahdzuf فَاعِلُنْ', () => {
    const s1 = latinKeHuruf('faa-i-laa-tun-faa-i-laa-tun')
    const s2 = latinKeHuruf('faa-i-laa-tun-faa-i-lun')
    expect(timbangBait([s1, s2], BAHR.ramalMajzu).patah).toBe(0)
  })

  it('tampilan: tanwin fathah di akhir bait menjadi alif (أَبَدًا → أَبَدَا)', () => {
    const [, s2] = kitabahOk(['نَحْنُ الَّذِينَ بَايَعُوا مُحَمَّدَا', 'عَلَى الْجِهَادِ مَا بَقِينَا أَبَدًا'])
    expect(tampil(s2.slice(-4))).toBe('أَبَدَا')
    expect(bits(s2)).toBe('110110' + '110110' + '101110')
  })

  it('mim jama\' bertemu hamzah washal diberi dhammah', () => {
    const k = kitabahBait(['عَلَيْكُمْ السَّلَامُ'], { tanpaAkhir: true })
    if (!k.ok) throw new Error(k.galat)
    expect(tampil(k.syathr[0].slice(0, 5))).toBe('عَلَيْكُمُ')
  })

  it('khabl diberi nilai qabih; nama lazim di kitab tersedia', () => {
    expect(BAHR.rajaz.slot[0][0].find((b) => b.zihaf === 'khabl')?.nilai).toBe('qabih')
    expect(BAHR.rajaz.slot[0][0].find((b) => b.zihaf === 'khabn')?.namaLain).toBe('مَفَاعِلُنْ')
    expect(BAHR.rajaz.slot[1][2].find((b) => b.zihaf === "qath'")?.illah).toBe(true)
  })
})

describe('bahr Babak 2–3 dan bonus: bait model ditimbang lurus dan ditebak benar', () => {
  const kasus: { nama: string; kode: keyof typeof BAHR; bait: string[]; pola: string[][] }[] = [
    {
      nama: 'kamil: Nuniyah Ibnul Qayyim bait 1 (idhmar, tasri\' dengan dharb maqthu\')',
      kode: 'kamil',
      bait: ['حُكْمُ الْمَحَبَّةِ ثَابِتُ الْأَرْكَانِ', 'مَا لِلصُّدُودِ بِفَسْخِ ذَاكَ يَدَانِ'],
      pola: [['1010110', '1110110', '101010'], ['1010110', '1110110', '111010']],
    },
    {
      nama: 'basith: Nuniyah al-Busti bait 1 (khabn, dharb maqthu\')',
      kode: 'basith',
      bait: ['زِيَادَةُ الْمَرْءِ فِي دُنْيَاهُ نُقْصَانُ', 'وَرِبْحُهُ غَيْرَ مَحْضِ الْخَيْرِ خُسْرَانُ'],
      pola: [['110110', '10110', '1010110', '1010'], ['110110', '10110', '1010110', '1010']],
    },
    {
      nama: 'thawil: Ta\'lim al-Muta\'allim, enam syarat (\'arudh maqbudhah, dharb mahdzuf)',
      kode: 'thawil',
      bait: ['أَلَا لَا تَنَالُ الْعِلْمَ إِلَّا بِسِتَّةٍ', 'سَأُنْبِيكَ عَنْ مَجْمُوعِهَا بِبَيَانِ'],
      pola: [['11010', '1101010', '11010', '110110'], ['11010', '1101010', '1101', '11010']],
    },
    {
      nama: 'wafir: شَكَوْتُ إِلَى وَكِيعٍ (\'ashb, \'arudh dan dharb maqthufah)',
      kode: 'wafir',
      bait: ['شَكَوْتُ إِلَى وَكِيعٍ سُوءَ حِفْظِي', 'فَأَرْشَدَنِي إِلَى تَرْكِ الْمَعَاصِي'],
      pola: [['1101110', '1101010', '11010'], ['1101110', '1101010', '11010']],
    },
    {
      nama: 'mujtats: syahid الْبَطْنُ مِنْهَا خَمِيصٌ',
      kode: 'mujtats',
      bait: ['الْبَطْنُ مِنْهَا خَمِيصٌ', 'وَالْوَجْهُ مِثْلُ الْهِلَالِ'],
      pola: [['1010110', '1011010'], ['1010110', '1011010']],
    },
  ]
  for (const k of kasus) {
    it(k.nama, () => {
      const s = kitabahOk(k.bait)
      const h = timbangBait(s, BAHR[k.kode])
      expect(h.patah).toBe(0)
      expect(h.syathr.map((x) => x.potongan.map((p) => p.bit))).toEqual(k.pola)
      expect(tebakBahr(s).bahr.kode).toBe(k.kode)
    })
  }

  it('kunci setiap bahr ditimbang lurus dengan bahrnya sendiri', () => {
    for (const kode of ['kamil', 'basith', 'thawil', 'wafir', 'mujtats'] as const) {
      expect(timbangBait(kitabahOk(BAHR[kode].kunci), BAHR[kode]).patah, kode).toBe(0)
    }
  })

  it('basith: \'arudh tanpa tasri\' hanya فَعِلُنْ; dharb فَعِلُنْ atau فَعْلُنْ, bukan فَاعِلُنْ', () => {
    const s = kitabahOk(['زِيَادَةُ الْمَرْءِ فِي دُنْيَاهُ نُقْصَانُ', 'قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ'])
    expect(slotSyathr(BAHR.basith, s, 0).at(-1)!.map((b) => b.bit)).toEqual(['1110'])
    expect(slotSyathr(BAHR.basith, s, 1).at(-1)!.map((b) => b.bit)).toEqual(['1110', '1010'])
  })

  it('rajaz tetap ditebak rajaz walaupun polanya sama dengan kamil mudhmar', () => {
    expect(tebakBahr(kitabahOk(['دَارٌ لِسَلْمَى إِذْ سُلَيْمَى جَارَةٌ', 'قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ'])).bahr.kode).toBe('rajaz')
  })
})

describe('lagu لا/نعم (tanghim): لا = 10, نعم = 110, لَ = 1', () => {
  it('setiap bentuk yang punya lagu: bit lagunya sama dengan bit bentuknya', () => {
    for (const bahr of Object.values(BAHR)) {
      for (const syathr of bahr.slot) for (const slot of syathr) for (const b of slot) {
        if (b.lagu) expect(bitLagu(b.lagu), `${bahr.kode} ${b.nama}`).toBe(b.bit)
      }
    }
  })

  it('bahr yang sudah dilagukan: semua bentuknya punya lagu dan video nagham', () => {
    for (const kode of ['rajaz', 'kamil', 'basith', 'thawil', 'wafir'] as const) {
      for (const syathr of BAHR[kode].slot) for (const slot of syathr) for (const b of slot) expect(b.lagu, `${kode} ${b.nama}`).toBeTruthy()
      expect(BAHR[kode].dengar?.youtube, kode).toBeTruthy()
    }
  })

  it("kunci dilagukan seperti lembar ringkasan Lisan Mubin: satu baris per bahr", () => {
    // Kunci = satu syathr, jadi lagunya satu baris: syathr pertama dengan 'arudh-nya.
    expect(laguBahr(BAHR.rajaz)).toBe('لا لا نعم لا لا نعم لا لا نعم')
    expect(laguBahr(BAHR.kamil)).toBe('لَ لَ لا نعم لَ لَ لا نعم لَ لَ لا نعم')
    expect(laguBahr(BAHR.basith)).toBe('لا لا نعم لا نعم لا لا نعم لَ نعم')
    expect(laguBahr(BAHR.thawil)).toBe('نعم لا نعم لا لا نعم لا نعم لَ لا')
    expect(laguBahr(BAHR.wafir)).toBe('نعم لَ لَ لا نعم لَ لَ لا نعم لا')
  })

  it('مُتَفَاعِلُنْ = sabab tsaqil (لَ لَ) · sabab · watad, bukan لَ + dua watad', () => {
    const utuh = BAHR.kamil.slot[0][0][0]
    expect(juzBentuk(utuh.bit, utuh).map((j) => j.lagu).join(' ')).toBe('لَ لَ لا نعم')
  })

  it('juz mengikuti lagu: مُتَفْعِلُنْ = لَ · sabab · watad, bukan dua watad', () => {
    const khabn = BAHR.rajaz.slot[0][0].find((b) => b.zihaf === 'khabn')!
    expect(juzBentuk(khabn.bit, khabn).map((j) => [j.jenis, j.lagu])).toEqual([['tunggal', 'لَ'], ['sabab', 'لا'], ['watad', 'نعم']])
  })

  it('taf\'ilah patah (bit tidak sama dengan bentuk terdekat) tetap dipecah dari bitnya sendiri', () => {
    const utuh = BAHR.rajaz.slot[0][0][0]
    expect(juzBentuk('10110', utuh).map((j) => j.bit).join('')).toBe('10110')
  })
})
