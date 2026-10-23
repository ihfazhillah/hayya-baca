/**
 * Kitabah 'arudhiyyah: yang diucapkan ditulis, yang tidak diucapkan tidak ditulis.
 * Masukan teks berharakat per syathr; keluaran daftar huruf ber-bit (1 hidup, 0 mati).
 */
import type { Huruf } from './jenis'
import { DHAMMAH, FATHAH, KASRAH, MAD_DARI, SUKUN, TANDA, kerangka, pecahKata, tandaiKhanjariyah, type Harakat, type HurufAsli } from './huruf'

/** Aturan yang bisa dimatikan untuk membuat bacaan pengecoh di latihan. */
export type Aturan = 'syaddah' | 'tanwin' | 'hamzahWashal' | 'lamSyamsiyah' | 'isyba'

export interface OpsiKitabah {
  matikan?: Aturan[]
  /** Kata lepas (bank kata): tanpa aturan akhir syathr (isyba', tanwin akhir bait). */
  tanpaAkhir?: boolean
}

export type HasilKitabah =
  | { ok: true; syathr: Huruf[][] }
  | { ok: false; galat: string; kata?: string }

interface Unit extends HurufAsli {
  kata: number
  pos: number
  panjang: number
  teksKata: string
  kerangkaKata: string
}

interface Kerja extends Huruf {
  vokal?: 'a' | 'i' | 'u'
  mad?: boolean
  dasar?: string
  /** Kerangka kata asal, untuk harakat penyambung sebelum hamzah washal (مِنَ، عَلَيْكُمُ). */
  kr?: string
}

/** Pisahkan bait menjadi syathr: baris baru, `|`, `/`, `*`, `…`, atau `...`. */
export function pisahBait(teks: string): string[] {
  return teks
    .split(/\n|\||\/|\*|…|\.{3}/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function kitabahBait(bait: string[], opsi: OpsiKitabah = {}): HasilKitabah {
  const mati = new Set(opsi.matikan ?? [])
  const syathr: Huruf[][] = []
  for (let i = 0; i < bait.length; i++) {
    const h = kitabahSyathr(bait[i], i === bait.length - 1, mati, opsi.tanpaAkhir ?? false)
    if ('galat' in h) return { ok: false, ...h }
    syathr.push(h)
  }
  return { ok: true, syathr }
}

function kitabahSyathr(teks: string, akhirBait: boolean, mati: Set<Aturan>, tanpaAkhir: boolean): Huruf[] | { galat: string; kata?: string } {
  const kataKata = teks.trim().split(/\s+/).filter(Boolean)
  const units: Unit[] = []
  kataKata.forEach((w, k) => {
    const huruf = pecahKata(w)
    tandaiKhanjariyah(huruf)
    const kr = kerangka(huruf)
    huruf.forEach((h, pos) => units.push({ ...h, kata: k, pos, panjang: huruf.length, teksKata: w, kerangkaKata: kr }))
  })
  if (units.length === 0) return { galat: 'Syathr kosong.' }

  const out: Kerja[] = []
  let sebelumnyaWashal = false

  for (let idx = 0; idx < units.length; idx++) {
    const u = units[idx]
    const prev = units[idx - 1]
    const next = units[idx + 1]
    const akhirKata = u.pos === u.panjang - 1
    const isAlif = u.dasar === 'ا'

    // 1. Hamzah washal: alif tak berharakat di awal kata; setelah awalan (و ف ب ك ل) sebelum lam ta'rif
    //    (وَالْ، بِالْ، بِالِاسْمِ); atau di dalam kata sebelum huruf sukun (وَاصْبِرْ، لِلِاسْمِ).
    //    Alif mad hanya diikuti huruf sukun di akhir kata (الشَّمَالْ), jadi itu tetap mad; بَابٌ juga mad.
    const lamTarif =
      next?.dasar === 'ل' &&
      (next.harakat === null || next.harakat === 'sukun' || next.syaddah ||
        (next.harakat === 'i' && units[idx + 2]?.dasar === 'ا' && units[idx + 2].kata === u.kata))
    const sebelumSukunDalamKata =
      next?.harakat === 'sukun' && next.kata === u.kata && next.pos !== next.panjang - 1
    const washal =
      isAlif && u.harakat === null && !u.syaddah && !akhirKata &&
      (u.pos === 0 ||
        (prev.kata === u.kata && prev.harakat !== null && prev.harakat !== 'sukun' &&
          ((u.pos === 1 && 'وفبكل'.includes(prev.dasar) && lamTarif) || sebelumSukunDalamKata)))
    if (washal) {
      sebelumnyaWashal = true
      if (mati.has('hamzahWashal')) {
        out.push({ h: 'أَ', bit: 1, kata: u.kata, vokal: 'a' })
      } else if (out.length === 0) {
        const v = next?.dasar === 'ل' ? 'a' : 'i'
        out.push({ h: v === 'a' ? 'أَ' : 'إِ', bit: 1, kata: u.kata, vokal: v })
      } else {
        sambungSebelumWashal(out)
      }
      continue
    }
    const setelahWashal = sebelumnyaWashal
    sebelumnyaWashal = false

    // 2. Lam ta'rif (setelah hamzah washal, atau setelah لِ: لِلنَّاسِ): lebur ke huruf syamsiyah
    //    bersyaddah walau ditulis bersukun; selain itu sukun (qamariyah).
    const lamSetelahLi = u.pos === 1 && prev?.dasar === 'ل' && prev.harakat === 'i' && prev.kata === u.kata
    if (u.dasar === 'ل' && (u.harakat === null || u.harakat === 'sukun') && !u.syaddah && (setelahWashal || lamSetelahLi)) {
      if (next?.syaddah && next.kata === u.kata && !mati.has('lamSyamsiyah')) continue
      out.push({ h: 'ل' + SUKUN, bit: 0, kata: u.kata })
      continue
    }

    // 3. Huruf mad dan huruf yang tidak dibaca.
    if ((isAlif || u.dasar === 'ى') && u.harakat === null && !u.syaddah) {
      if (prev?.kata === u.kata && prev.tanwin) continue // كِتَابًا، هُدًى
      const wawJamaah =
        isAlif && akhirKata && prev?.kata === u.kata && prev.dasar === 'و' &&
        (prev.harakat === null || prev.harakat === 'sukun') &&
        (units[idx - 2]?.harakat === 'u' || units[idx - 2]?.harakat === 'a') // كَتَبُوا، سَعَوْا
      if (wawJamaah) continue
      out.push({ h: u.dasar, bit: 0, kata: u.kata, mad: true })
      continue
    }
    if ((u.dasar === 'و' || u.dasar === 'ي') && u.harakat === null && !u.syaddah) {
      // Waw yang tidak dibaca dalam أُولَئِكَ، أُولُو، أُولِي، أُولَاتُ
      if (u.dasar === 'و' && u.pos === 1 && prev.dasar === 'أ' && u.kerangkaKata.startsWith('أول')) continue
      const sebelum = out.at(-1)
      const cocok = sebelum?.vokal === (u.dasar === 'و' ? 'u' : 'i')
      out.push({ h: u.dasar, bit: 0, kata: u.kata, mad: cocok })
      continue
    }
    if (u.dasar === 'آ') {
      out.push({ h: 'ءَ', bit: 1, kata: u.kata, vokal: 'a' })
      out.push({ h: 'ا', bit: 0, kata: u.kata, mad: true })
      continue
    }

    // 4. Huruf biasa.
    let harakat: Harakat = u.harakat
    if (harakat === null && u.dasar === 'إ') harakat = 'i'
    if (harakat === null && u.khanjariyah) harakat = 'a'
    if (harakat === null) {
      return { galat: `Beri harakat pada kata «${u.teksKata}»: huruf «${u.dasar}» belum berharakat atau bersukun.`, kata: u.teksKata }
    }
    const dasar = u.dasar === 'ة' ? 'ت' : u.dasar
    if (u.syaddah && harakat !== 'sukun' && !mati.has('syaddah')) {
      out.push({ h: dasar + SUKUN, bit: 0, kata: u.kata, tambahan: 'syaddah' })
    }
    if (harakat === 'sukun') {
      out.push({ h: dasar + SUKUN, bit: 0, kata: u.kata, dasar, kr: u.kerangkaKata })
      continue
    }
    out.push({ h: dasar + TANDA[harakat], bit: 1, kata: u.kata, vokal: harakat, dasar })
    if (u.khanjariyah) out.push({ h: 'ا', bit: 0, kata: u.kata, tambahan: 'khanjariyah', mad: true })
    if (u.tanwin && !mati.has('tanwin')) out.push({ h: 'ن' + SUKUN, bit: 0, kata: u.kata, tambahan: 'tanwin', dasar: 'ن' })

    // 5. Bacaan pilihan: isyba' ha' dhamir dan mim jama' sebelum huruf hidup.
    const kataBerikut = units.find((x) => x.kata === u.kata + 1)
    const berikutHidup = kataBerikut && kataBerikut.harakat !== null && kataBerikut.harakat !== 'sukun'
    if (akhirKata && berikutHidup && !u.tanwin && (harakat === 'u' || harakat === 'i')) {
      const sebelumHidup = out.at(-2)?.bit === 1
      const haDhamir = u.dasar === 'ه' && sebelumHidup && u.panjang > 1
      const mimJamaah = u.dasar === 'م' && harakat === 'u' && /(هم|كم|تم)$/.test(u.kerangkaKata)
      if (haDhamir || mimJamaah) {
        out.push({ h: MAD_DARI[harakat], bit: 0, kata: u.kata, tambahan: 'isyba', opsional: true })
      }
    }
  }

  // 6. Akhir syathr: tanwin di akhir bait tidak dibaca nun; harakat terakhir dipanjangkan (isyba').
  if (tanpaAkhir) return out.map(bersih)
  // Tanwin kata terakhir (juga أَبَدًا yang alifnya tidak dibaca) tidak dibaca nun di akhir bait.
  const kataTerakhir = units.at(-1)!.kata
  if (akhirBait && out.at(-1)?.tambahan === 'tanwin' && out.at(-1)?.kata === kataTerakhir && !mati.has('tanwin')) out.pop()
  const ujung = out.at(-1)
  if (ujung?.bit === 1 && ujung.vokal && !mati.has('isyba')) {
    out.push({ h: MAD_DARI[ujung.vokal], bit: 0, kata: ujung.kata, tambahan: 'isyba' })
  }

  return out.map(bersih)
}

function bersih({ h, bit, kata, tambahan, opsional }: Kerja): Huruf {
  return { h, bit, kata, ...(tambahan ? { tambahan } : {}), ...(opsional ? { opsional } : {}) }
}

/** Hamzah washal gugur di tengah kalam; huruf sebelumnya menyesuaikan (bertemunya dua sukun). */
function sambungSebelumWashal(out: Kerja[]): void {
  const sebelum = out.at(-1)
  if (!sebelum) return
  if (sebelum.mad) {
    out.pop() // فِي الْ → فِلْ، عَلَى الْ → عَلَلْ
    return
  }
  if (sebelum.bit === 0) {
    // Tanwin atau huruf sukun bertemu sukun: diberi kasrah (مَنِ), kecuali مِنَ dan mim jama' (عَلَيْكُمُ).
    const v = sebelum.kr === 'من' ? 'a' : sebelum.dasar === 'م' && /(هم|كم|تم)$/.test(sebelum.kr ?? '') ? 'u' : 'i'
    sebelum.bit = 1
    sebelum.vokal = v
    sebelum.h = sebelum.h.replace(SUKUN, '') + ({ a: FATHAH, i: KASRAH, u: DHAMMAH } as const)[v]
  }
}
