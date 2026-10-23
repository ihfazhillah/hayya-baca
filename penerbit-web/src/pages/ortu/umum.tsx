/** Bantuan kecil untuk halaman Pemeriksa, Tamu, Rak, dan Cetak. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMe } from '../../me'
import type { TahapMentor, Tingkat } from '../../types'

export function pesanGalat(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Ambil data saat dipasang dan setiap kali `deps` berubah (mis. penulis dipilih). */
export function useMuat<T>(ambil: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const muat = useCallback(async () => {
    try {
      setError(null)
      setData(await ambil())
    } catch (e) {
      setError(pesanGalat(e))
    }
  }, deps)
  useEffect(() => {
    void muat()
  }, [muat])
  return { data, setData, error, setError, muat }
}

/** Halaman detail (satu lembar / satu naskah) milik satu penulis: bila penulis lain dipilih di nav,
 *  kembali ke daftar supaya isi halaman tidak berbeda dengan nama di pilihan penulis. */
export function useKeDaftarSaatGantiPenulis(daftar: string) {
  const { penulisDipilih } = useMe()
  const navigate = useNavigate()
  const awal = useRef(penulisDipilih)
  useEffect(() => {
    if (awal.current !== null && penulisDipilih !== awal.current) navigate(daftar)
  }, [penulisDipilih, daftar, navigate])
}

export function tgl(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export function tglJam(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return `${tgl(s)} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
}

/** Kode minggu ISO dari backend ("2026-W43") menjadi rentang yang mudah dibaca ("19–25 Okt"). */
export function labelMinggu(kode: string): string {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(kode)
  if (!m) return kode
  const tahun = Number(m[1])
  const jan4 = new Date(Date.UTC(tahun, 0, 4))
  const senin = new Date(jan4)
  senin.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (Number(m[2]) - 1) * 7)
  const ahad = new Date(senin)
  ahad.setUTCDate(senin.getUTCDate() + 6)
  const f = (d: Date, bulan: boolean) =>
    d.toLocaleDateString('id-ID', { day: 'numeric', ...(bulan ? { month: 'short' } : {}), timeZone: 'UTC' })
  const samaBulan = senin.getUTCMonth() === ahad.getUTCMonth()
  return `${f(senin, !samaBulan)}–${f(ahad, true)}`
}

export const TINGKAT: { kode: Tingkat; nama: string }[] = [
  { kode: 'perunggu', nama: 'Perunggu' },
  { kode: 'perak', nama: 'Perak' },
  { kode: 'emas', nama: 'Emas' },
]

export const NAMA_TAHAP_MENTOR: Record<TahapMentor, string> = {
  tanpa: 'Tanpa kotak prompt',
  contoh: 'Contoh',
  isian: 'Isian',
  mandiri: 'Mandiri',
}

export const RUMUS_BERTANYA = ['Aku sedang…', 'Aku bingung…', 'Tolong…, jangan…', 'Setelah itu aku akan…']

/** Lima lapis stempel, urut. */
export const LAPIS = [
  { kode: 'peta', nama: 'Peta' },
  { kode: 'kamera', nama: 'Kamera' },
  { kode: 'gunting', nama: 'Gunting' },
  { kode: 'kaca', nama: 'Kaca' },
  { kode: 'pembaca', nama: 'Pembaca' },
] as const

export const STATUS_LEMBAR: Record<string, string> = {
  menunggu: 'Menunggu',
  bagus: 'Sudah bagus',
  coba_lagi: 'Coba lagi',
}

/** Paragraf dari teks polos. */
export function paragraf(teks: string): string[] {
  return teks.split(/\n+/).map((p) => p.trim()).filter(Boolean)
}

/** Tautan pulang di halaman tanpa nav: penulis ke Beranda, orang tua ke Pojok Orang Tua. */
export function TautanPulang() {
  const { me } = useMe()
  if (me?.penulis) return <Link className="kembali tidak-dicetak" to="/">← Beranda</Link>
  if (me && (me.pemeriksa.length || me.bisa_diaktifkan.length))
    return <Link className="kembali tidak-dicetak" to="/ortu">← Pojok Orang Tua</Link>
  if (me?.tamu) return <Link className="kembali tidak-dicetak" to="/ulasan">← Ulasan</Link>
  return null
}

/** Halaman Pemeriksa butuh penulis aktif. Orang tua yang anaknya belum diaktifkan diarahkan ke Dasbor,
 *  bukan melihat galat "Not found." dari server. */
export function ButuhPenulis({ judul, children }: { judul: string; children: ReactNode }) {
  const { me } = useMe()
  if (!me) return null
  if (me.pemeriksa.length === 0) {
    return (
      <main className="page">
        <h1 className="page-title">{judul}</h1>
        <p className="kecil">
          Belum ada penulis yang aktif. <Link to="/ortu">Aktifkan Penerbit Rumah untuk anak di Dasbor</Link>.
        </p>
      </main>
    )
  }
  return <>{children}</>
}
