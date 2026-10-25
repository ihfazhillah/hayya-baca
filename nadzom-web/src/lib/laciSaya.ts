/** Laci saya: kata yang dipanen pelajar sendiri (spec 077). Disimpan di browser, bisa diekspor/impor sebagai Markdown. */
const KUNCI = 'nadzom.laci.v1'
/** Dikirim setiap laci berubah, supaya laci yang sedang tampil ikut segar. */
export const PERISTIWA = 'nadzom-laci'

export interface KataSaya {
  teks: string
  arti: string
  pola: string
  cocok?: string
  /** Bait atau kitab asal; satu kata bisa dipanen dari beberapa sumber. */
  sumber: string[]
}

export function bacaLaci(): KataSaya[] {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI) ?? '[]')
    return Array.isArray(v) ? v.filter((k) => k && typeof k.teks === 'string' && typeof k.arti === 'string') : []
  } catch {
    return []
  }
}

function tulis(daftar: KataSaya[]): boolean {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(daftar))
    window.dispatchEvent(new Event(PERISTIWA))
    return true
  } catch {
    // Mode privat: laci hanya bertahan selama halaman terbuka; ekspor tetap bisa.
    return false
  }
}

/** Simpan atau gabungkan: kata yang sama dari sumber lain menambah sumbernya. Mengembalikan jumlah kata di laci. */
export function simpanKata(k: KataSaya): number {
  const daftar = bacaLaci()
  const ada = daftar.find((x) => x.teks === k.teks)
  if (ada) {
    ada.arti = k.arti || ada.arti
    ada.cocok = k.cocok ?? ada.cocok
    for (const s of k.sumber) if (!ada.sumber.includes(s)) ada.sumber.push(s)
  } else daftar.push(k)
  tulis(daftar)
  return daftar.length
}

export function hapusKata(teks: string): void {
  tulis(bacaLaci().filter((k) => k.teks !== teks))
}

const sel = (s: string) => s.replace(/\|/g, '/').trim()

export function keMarkdown(daftar: KataSaya[]): string {
  return [
    '# Laci saya',
    '',
    '| Kata | Pola | Arti | Cocok untuk | Sumber |',
    '|---|---|---|---|---|',
    ...daftar.map((k) => `| ${sel(k.teks)} | ${k.pola} | ${sel(k.arti)} | ${sel(k.cocok ?? '')} | ${sel(k.sumber.join('; '))} |`),
    '',
  ].join('\n')
}

/** Impor dari tabel Markdown hasil ekspor. Mengembalikan jumlah baris kata yang terbaca. */
export function imporMarkdown(md: string): number {
  let n = 0
  for (const baris of md.split('\n')) {
    const kol = baris.split('|').slice(1, -1).map((s) => s.trim())
    if (kol.length < 3 || kol[0] === 'Kata' || /^-+$/.test(kol[0]) || !kol[0]) continue
    simpanKata({ teks: kol[0], pola: kol[1], arti: kol[2], cocok: kol[3] || undefined, sumber: (kol[4] ?? '').split(';').map((s) => s.trim()).filter(Boolean) })
    n++
  }
  return n
}
