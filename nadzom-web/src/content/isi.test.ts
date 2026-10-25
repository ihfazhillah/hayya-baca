/** Test isi: setiap bait di data course ditimbang ulang oleh mesin. Isi dan mesin tidak boleh berbeda. */
import { describe, expect, it } from 'vitest'
import { kitabahBait } from '@/lib/kitabah'
import { timbangBait } from '@/lib/timbang'
import { cariBahr } from '@/lib/bahr'
import { BABAK, BANK_KATA, MODUL } from '.'
import type { KodeBahr } from './jenis'

function timbang(bait: string[], kode: KodeBahr) {
  const k = kitabahBait(bait)
  if (!k.ok) throw new Error(`${bait.join(' / ')}: ${k.galat}`)
  return timbangBait(k.syathr, cariBahr(kode)!)
}

const berubah = (bait: string[], kode: KodeBahr) => timbang(bait, kode).syathr.flatMap((s) => s.potongan).filter((p) => p.status === 'berubah').length
const pola = (teks: string) => {
  const k = kitabahBait([teks], { tanpaAkhir: true })
  return k.ok ? k.syathr[0].map((h) => h.bit).join('') : ''
}
/** Potongan kata berurutan yang tepat satu taf'ilah utuh (bahan panen). */
function potonganUtuh(bait: string[], kode: KodeBahr): string[] {
  const utuh = new Set(cariBahr(kode)!.slot.flat(2).filter((b) => !b.zihaf).map((b) => b.bit))
  const hasil: string[] = []
  for (const s of bait) {
    const kata = s.split(/\s+/)
    for (let i = 0; i < kata.length; i++) for (let j = i + 1; j <= kata.length; j++) {
      const t = kata.slice(i, j).join(' ')
      if (utuh.has(pola(t))) hasil.push(t)
    }
  }
  return hasil
}

for (const modul of MODUL) {
  describe(`Modul ${modul.nomor}`, () => {
    for (const p of modul.pelajaran) {
      describe(`Pelajaran ${p.nomor}: ${p.judul}`, () => {
        it('setiap contoh (الأمثلة) sesuai jumlah patah yang tertulis, bersumber, dan bermakna', () => {
          expect(p.amtsilah.length).toBeGreaterThan(0)
          for (const c of p.amtsilah) {
            expect(timbang(c.bait, c.bahr).patah, c.bait.join(' / ')).toBe(c.patah ?? 0)
            expect(c.makna?.trim(), `makna: ${c.bait[0]}`).toBeTruthy()
            expect(c.sumber?.trim(), `sumber: ${c.bait[0]}`).toBeTruthy()
          }
          for (const d of p.dengar ?? []) expect(d.url).toMatch(/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//)
        })

        it('bait peragaan lurus, dan setiap langkah timbang sesuai harapannya', () => {
          expect(timbang(p.bahts.bait, p.bahts.bahr).patah).toBe(0)
          for (const l of p.bahts.langkah) {
            if (l.tampil === 'timbang') expect(timbang(l.bait ?? p.bahts.bait, p.bahts.bahr).patah, (l.bait ?? p.bahts.bait).join(' / ')).toBe(l.patah ?? 0)
            if (l.tampil === 'teks') expect(l.papan).toBeTruthy()
          }
          expect(p.bahts.giliran.syathr).toBeLessThan(p.bahts.bait.length)
        })

        it('penjelasan dan tamrinat cukup: uraian, yang sering keliru, minimal lima tamrin bertingkat', () => {
          expect(p.syarh?.length ?? 0, 'syarh').toBeGreaterThanOrEqual(3)
          expect(p.keliru?.length ?? 0, 'keliru').toBeGreaterThanOrEqual(2)
          expect(p.tamarin.length, 'tamarin').toBeGreaterThanOrEqual(5)
          const jenis = new Set(p.tamarin.map((t) => t.jenis))
          expect(jenis.size, 'ragam tamrin').toBeGreaterThanOrEqual(3)
        })

        if (modul.salim) {
          it('Jilid 1 (salim): setiap bait rajaz yang dipakai, ditanyakan, atau dijadikan pola utuh semua', () => {
            const cek = (bait: string[], kode: KodeBahr, asal: string) => {
              if (kode !== 'rajaz') return
              expect(berubah(bait, kode), `${asal}: ${bait.join(' / ')}`).toBe(0)
            }
            for (const c of p.amtsilah) if (!c.patah) cek(c.bait, c.bahr, 'amtsilah')
            cek(p.bahts.bait, p.bahts.bahr, 'bahts')
            for (const l of p.bahts.langkah) if (l.tampil === 'timbang' && l.bait && !l.patah) cek(l.bait, p.bahts.bahr, 'langkah')
            for (const t of p.tamarin) {
              if (t.jenis === 'taqthi' || t.jenis === 'irama' || t.jenis === 'panen') cek(t.bait, t.bahr, t.jenis)
              if (t.jenis === 'pincang') for (const b of t.baris) if (timbang(b.bait, t.bahr).patah === 0) cek(b.bait, t.bahr, 'pincang lurus')
              if (t.jenis === 'susun' && t.pola) cek(t.pola.bait, t.bahr, 'pola')
              if (t.jenis === 'cetakan') {
                for (let i = 0; i < Math.max(...t.kotak.map((k) => k.contoh.length)); i++) {
                  let baris = t.cetakan
                  t.kotak.forEach((k, j) => { baris = baris.replace(`{${j + 1}}`, k.contoh[i % k.contoh.length]) })
                  cek([baris], t.bahr, 'cetakan')
                }
              }
            }
          })
        }

        it('latihan: jawaban dalam rentang, bait taqthi\' lurus, contoh cetakan lurus', () => {
          for (const t of p.tamarin) {
            if (t.jenis === 'pilih') expect(t.jawaban).toBeLessThan(t.pilihan.length)
            if (t.jenis === 'kenali') {
              expect(t.soal.length).toBeGreaterThanOrEqual(3)
              for (const q of t.soal) expect(q.jawaban, q.soal).toBeLessThan(q.pilihan.length)
            }
            if (t.jenis === 'tandai') {
              expect(t.butir.length).toBeGreaterThanOrEqual(5)
              for (const b of t.butir) expect(kitabahBait([b], { tanpaAkhir: true }).ok, b).toBe(true)
            }
            if (t.jenis === 'pincang') {
              const patah = t.baris.map((b) => timbang(b.bait, t.bahr).patah)
              expect(patah.some((x) => x === 0), 'ada yang lurus').toBe(true)
              expect(patah.some((x) => x > 0), 'ada yang pincang').toBe(true)
            }
            if (t.jenis === 'taqthi' || t.jenis === 'irama') expect(timbang(t.bait, t.bahr).patah, t.bait.join(' / ')).toBe(0)
            if (t.jenis === 'susun' && t.rancangan) expect(t.rancangan.length).toBe(t.jumlah ?? 1)
            if (t.jenis === 'susun' && t.pola) expect(timbang(t.pola.bait, t.bahr).patah, "pola mu'aradhah lurus").toBe(0)
            if (t.jenis === 'susun') for (const g of t.tangga ?? []) {
              if (typeof g === 'string') continue
              const pg = pola(g.ganti)
              expect(g.calon.some((c) => pola(c) === pg), `ada calon sewazan dengan ${g.ganti}`).toBe(true)
              expect(g.calon.some((c) => pola(c) !== pg), `ada calon pengecoh untuk ${g.ganti}`).toBe(true)
            }
            if (t.jenis === 'panen') {
              expect(timbang(t.bait, t.bahr).patah, 'bait panen lurus').toBe(0)
              expect(new Set(potonganUtuh(t.bait, t.bahr)).size, "cukup potongan satu taf'ilah utuh").toBeGreaterThanOrEqual(t.jumlah)
            }
            if (t.jenis === 'cetakan') {
              for (let i = 0; i < Math.max(...t.kotak.map((k) => k.contoh.length)); i++) {
                let baris = t.cetakan
                t.kotak.forEach((k, j) => { baris = baris.replace(`{${j + 1}}`, k.contoh[i % k.contoh.length]) })
                expect(timbang([baris], t.bahr).patah, baris).toBe(0)
              }
            }
          }
        })
      })
    }
  })
}

describe('laci kata', () => {
  it('setiap kata berharakat lengkap dan berarti', () => {
    for (const k of BANK_KATA) {
      expect(kitabahBait([k.teks], { tanpaAkhir: true }).ok, k.teks).toBe(true)
      expect(k.arti.trim(), k.teks).toBeTruthy()
    }
  })
})

describe('peta', () => {
  it('setiap modul yang ada tercantum di peta dengan nomor yang sama', () => {
    const diPeta = BABAK.flatMap((b) => b.modul.map((m) => m.nomor))
    for (const m of MODUL) expect(diPeta, `Modul ${m.nomor}`).toContain(m.nomor)
  })
})
