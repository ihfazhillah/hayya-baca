/** Centang "selesai" per pelajaran, hanya di perangkat ini. Hilang pun tidak masalah (spec 076 K1). */
const KUNCI = 'nadzom.selesai.v1'

function baca(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function kodePelajaran(modul: number, pelajaran: number): string {
  return `${modul}-${pelajaran}`
}

export function sudahSelesai(kode: string): boolean {
  return baca().includes(kode)
}

export function aturSelesai(kode: string, selesai: boolean): void {
  const set = new Set(baca())
  if (selesai) set.add(kode)
  else set.delete(kode)
  try {
    localStorage.setItem(KUNCI, JSON.stringify([...set]))
  } catch {
    // Penyimpanan tidak tersedia (mode privat): centang hanya bertahan selama halaman terbuka.
  }
}
