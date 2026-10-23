/** Suku kata irama: setiap huruf hidup membuka suku; huruf mati sesudahnya memanjangkannya. */
import type { HasilSyathr } from './jenis'
import { teksKitabah } from './latihan'

export interface Suku {
  teks: string
  panjang: boolean
  /** Suku pertama sebuah taf'ilah: diberi tekanan saat diputar. */
  awalKaki: boolean
  /** Indeks taf'ilah. */
  kaki: number
}

export function sukuKata(s: HasilSyathr): Suku[] {
  const suku: Suku[] = []
  s.potongan.forEach((p, kaki) => {
    let mulai = p.mulai
    for (let i = p.mulai; i < p.akhir; i++) {
      const akhirSuku = i + 1 === p.akhir || s.huruf[i + 1].bit === 1
      if (!akhirSuku) continue
      suku.push({ teks: teksKitabah(s.huruf.slice(mulai, i + 1)).replace(/ /g, ''), panjang: i > mulai, awalKaki: mulai === p.mulai, kaki })
      mulai = i + 1
    }
  })
  return suku
}
