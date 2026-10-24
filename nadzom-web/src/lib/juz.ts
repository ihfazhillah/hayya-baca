/** Pecah bit taf'ilah menjadi sabab (10) dan watad (110) untuk ditampilkan. */
export interface Juz {
  jenis: 'sabab' | 'watad' | 'tunggal'
  bit: string
  /** Kata lagu tanghim (لا, نعم, لَ …), bila bentuknya berlagu. */
  lagu?: string
}

export function pecahJuz(bit: string): Juz[] {
  const out: Juz[] = []
  let i = 0
  while (i < bit.length) {
    if (bit.startsWith('110', i)) {
      out.push({ jenis: 'watad', bit: '110' })
      i += 3
    } else if (bit.startsWith('10', i)) {
      out.push({ jenis: 'sabab', bit: '10' })
      i += 2
    } else {
      out.push({ jenis: 'tunggal', bit: bit[i] })
      i += 1
    }
  }
  return out
}
