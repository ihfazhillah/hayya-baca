/** Menimbang bit syathr terhadap slot taf'ilah sebuah bahr. */
import type { Bahr, Bentuk, HasilBait, HasilSyathr, Huruf, Potongan, Status } from './jenis'
import { DAFTAR_BAHR } from './bahr'

const BIAYA = { utuh: 0, berubah: 0.1, patah: 1 } as const
const MAKS_OPSIONAL = 6

export interface Cocok {
  bentuk: Bentuk
  status: Status
  biaya: number
}

export function cocokkan(seg: string, bentuk: Bentuk[]): Cocok {
  const cocok = bentuk.find((x) => x.bit === seg)
  if (cocok) {
    return cocok.zihaf
      ? { bentuk: cocok, status: 'berubah', biaya: BIAYA.berubah }
      : { bentuk: cocok, status: 'utuh', biaya: BIAYA.utuh }
  }
  let terdekat = bentuk[0]
  let jarak = Infinity
  for (const x of bentuk) {
    const d = levenshtein(seg, x.bit)
    if (d < jarak) [terdekat, jarak] = [x, d]
  }
  // Selisih panjang kecil saja sebagai pemecah seri: potongan yang wajar lebih dipilih.
  return { bentuk: terdekat, status: 'patah', biaya: BIAYA.patah + jarak * 0.01 }
}

/** DP: posisi bit × slot. Setiap slot mengambil potongan 1..12 bit; slot terakhir mengambil sisanya. */
export function timbangSyathr(huruf: Huruf[], slot: Bentuk[][]): Omit<HasilSyathr, 'bacaanPilihan'> {
  const bit = huruf.map((h) => h.bit).join('')
  const n = bit.length
  const S = slot.length
  if (n < S) {
    const potongan: Potongan[] = [{
      mulai: 0, akhir: n, bit, status: 'patah', bentuk: slot[0][0], salah: [],
      catatan: `Terlalu pendek: ${n} huruf untuk ${S} taf'ilah.`,
    }]
    return { huruf, potongan, patah: S }
  }
  const terbaik: number[][] = Array.from({ length: S + 1 }, () => Array(n + 1).fill(Infinity))
  const jejak: { dari: number; cocok: Cocok }[][] = Array.from({ length: S + 1 }, () => Array(n + 1))
  terbaik[0][0] = 0
  for (let s = 0; s < S; s++) {
    for (let p = 0; p <= n; p++) {
      if (terbaik[s][p] === Infinity) continue
      const sisaSlot = S - s - 1
      const maks = s === S - 1 ? n - p : Math.min(12, n - p - sisaSlot)
      const min = s === S - 1 ? n - p : 1
      for (let L = min; L <= maks; L++) {
        if (L < 1) continue
        const c = cocokkan(bit.slice(p, p + L), slot[s])
        const total = terbaik[s][p] + c.biaya
        if (total < terbaik[s + 1][p + L]) {
          terbaik[s + 1][p + L] = total
          jejak[s + 1][p + L] = { dari: p, cocok: c }
        }
      }
    }
  }
  const potongan: Potongan[] = []
  let p = n
  for (let s = S; s > 0; s--) {
    const j = jejak[s][p]
    const seg = bit.slice(j.dari, p)
    potongan.unshift(buatPotongan(j.dari, p, seg, j.cocok))
    p = j.dari
  }
  return { huruf, potongan, patah: potongan.filter((x) => x.status === 'patah').length }
}

function buatPotongan(mulai: number, akhir: number, seg: string, c: Cocok): Potongan {
  if (c.status === 'utuh') return { mulai, akhir, bit: seg, status: 'utuh', bentuk: c.bentuk, salah: [], catatan: '' }
  if (c.status === 'berubah') {
    return {
      mulai, akhir, bit: seg, status: 'berubah', bentuk: c.bentuk, salah: [],
      catatan: `${c.bentuk.nama}${c.bentuk.namaLain ? ` (${c.bentuk.namaLain})` : ''}: bentuk berubah yang sah, ${c.bentuk.illah ? "'illah" : 'zihaf'} ${c.bentuk.zihaf}${c.bentuk.nilai === 'qabih' ? ', jarang dan dinilai kurang baik' : ''}.`,
    }
  }
  const salah = posisiBeda(seg, c.bentuk.bit).map((i) => mulai + i)
  const selisih = seg.length - c.bentuk.bit.length
  const catatan =
    selisih > 0 ? `Kelebihan ${selisih} huruf: ${seg}, seharusnya ${c.bentuk.bit} (${c.bentuk.nama}).`
      : selisih < 0 ? `Kurang ${-selisih} huruf: ${seg}, seharusnya ${c.bentuk.bit} (${c.bentuk.nama}).`
        : `Tertulis ${seg}, seharusnya ${c.bentuk.bit} (${c.bentuk.nama}).`
  return { mulai, akhir, bit: seg, status: 'patah', bentuk: c.bentuk, salah, catatan }
}

/** Huruf rawiy: huruf terakhir yang diucapkan, tanpa isyba', nun tanwin, atau huruf mad di ujung. */
export function rawiy(huruf: Huruf[]): string {
  for (let i = huruf.length - 1; i >= 0; i--) {
    const h = huruf[i]
    if (h.tambahan === 'isyba' || h.tambahan === 'tanwin') continue
    if (h.bit === 0 && 'اويى'.includes(h.h) && i > 0) continue
    return h.h[0]
  }
  return ''
}

/**
 * Slot taf'ilah untuk syathr ke-i. Syathr terakhir memakai dharb. Bila dua syathr berqafiyah sama
 * (tasri', muzdawij seperti Alfiyah), 'arudh mengikuti dharb. Satu baris saja (masythur) = dharb.
 */
export function slotSyathr(bahr: Bahr, syathr: Huruf[][], i: number): Bentuk[][] {
  const [awal, akhir] = bahr.slot
  if (syathr.length === 1 || i === syathr.length - 1) return akhir
  if (syathr.length === 2 && rawiy(syathr[0]) !== '' && rawiy(syathr[0]) === rawiy(syathr[1])) {
    const dharb = akhir.at(-1)!
    const arudh = awal.at(-1)!
    return [...awal.slice(0, -1), [...arudh, ...dharb.filter((d) => !arudh.some((a) => a.bit === d.bit))]]
  }
  return awal
}

/** Timbang bait; bacaan pilihan (opsional) dicoba dengan dan tanpa, diambil yang paling lurus. */
export function timbangBait(syathr: Huruf[][], bahr: Bahr): HasilBait {
  const hasil = syathr.map((huruf, i) => timbangDenganPilihan(huruf, slotSyathr(bahr, syathr, i)))
  return { bahr, syathr: hasil, patah: hasil.reduce((a, s) => a + s.patah, 0) }
}

function timbangDenganPilihan(huruf: Huruf[], slot: Bentuk[][]): HasilSyathr {
  const opsional = huruf.flatMap((h, i) => (h.opsional ? [i] : [])).slice(0, MAKS_OPSIONAL)
  let terbaik: HasilSyathr | null = null
  let skorTerbaik = Infinity
  for (let mask = 0; mask < 1 << opsional.length; mask++) {
    const buang = new Set(opsional.filter((_, k) => !(mask & (1 << k))))
    const pakai = huruf.filter((_, i) => !buang.has(i)).map(({ opsional: _o, ...h }) => h)
    const r = timbangSyathr(pakai, slot)
    const skor = r.patah * 10 + r.potongan.filter((x) => x.status === 'berubah').length + buang.size * 0.001
    if (skor < skorTerbaik) {
      skorTerbaik = skor
      const dipakai = opsional.filter((i) => !buang.has(i)).map((i) => `isyba' setelah ${huruf[i - 1]?.h ?? ''}`)
      terbaik = { ...r, bacaanPilihan: dipakai }
    }
  }
  return terbaik!
}

/** Coba semua bahr yang dikenal; ambil yang paling sedikit patah, lalu paling sedikit berubah. */
export function tebakBahr(syathr: Huruf[][]): HasilBait {
  let terbaik: HasilBait | null = null
  let skor = Infinity
  for (const bahr of DAFTAR_BAHR) {
    const h = timbangBait(syathr, bahr)
    const s = h.patah * 10 + h.syathr.flatMap((x) => x.potongan).filter((x) => x.status === 'berubah').length
    if (s < skor) [terbaik, skor] = [h, s]
  }
  return terbaik!
}

export function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

/** Indeks di `a` yang diganti atau berlebih bila diselaraskan dengan `b`. */
function posisiBeda(a: string, b: string): number[] {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  const beda: number[] = []
  let i = a.length
  let j = b.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] !== b[j - 1]) beda.push(i - 1)
      i--; j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      beda.push(i - 1); i--
    } else {
      // Huruf yang kurang: tandai huruf di sekitarnya.
      if (i > 0) beda.push(i - 1)
      j--
    }
  }
  return [...new Set(beda)].sort((x, y) => x - y)
}
