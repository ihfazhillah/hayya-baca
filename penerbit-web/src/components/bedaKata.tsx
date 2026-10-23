/** Beda per kata antara dua teks (LCS), untuk menandai yang dibuang dan yang baru. */
function bagi(teks: string) {
  return teks.split(/(\s+)/).filter((x) => x !== '')
}

function sama(a: string[], b: string[]) {
  const n = a.length
  const m = b.length
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])
    }
  }
  const kiri = new Set<number>()
  const kanan = new Set<number>()
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { kiri.add(i); kanan.add(j); i++; j++ } else if (t[i + 1][j] >= t[i][j + 1]) i++
    else j++
  }
  return { kiri, kanan }
}

export function BedaKata({ teks, banding, jenis }: { teks: string; banding: string; jenis: 'sebelum' | 'sesudah' }) {
  const bagian = bagi(teks)
  const kata = bagian.filter((x) => !/^\s+$/.test(x))
  const lain = bagi(banding).filter((x) => !/^\s+$/.test(x))
  const tetap = jenis === 'sebelum' ? sama(kata, lain).kiri : sama(lain, kata).kanan
  let k = -1
  return (
    <>
      {bagian.map((x, i) => {
        if (/^\s+$/.test(x)) return x
        k++
        if (tetap.has(k)) return <span key={i}>{x}</span>
        return jenis === 'sebelum' ? <del key={i} className="beda-buang">{x}</del> : <ins key={i} className="beda-baru">{x}</ins>
      })}
    </>
  )
}
