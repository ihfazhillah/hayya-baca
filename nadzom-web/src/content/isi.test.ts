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
            if (l.tampil === 'timbang') expect(timbang(l.bait!, p.bahts.bahr).patah, l.bait!.join(' / ')).toBe(l.patah ?? 0)
            if (l.tampil === 'teks') expect(l.papan).toBeTruthy()
          }
          expect(p.bahts.giliran.syathr).toBeLessThan(p.bahts.bait.length)
        })

        it('latihan: jawaban dalam rentang, bait taqthi\' lurus, contoh cetakan lurus', () => {
          for (const t of p.tamarin) {
            if (t.jenis === 'pilih') expect(t.jawaban).toBeLessThan(t.pilihan.length)
            if (t.jenis === 'taqthi' || t.jenis === 'irama') expect(timbang(t.bait, t.bahr).patah, t.bait.join(' / ')).toBe(0)
            if (t.jenis === 'susun' && t.rancangan) expect(t.rancangan.length).toBe(t.jumlah ?? 1)
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
