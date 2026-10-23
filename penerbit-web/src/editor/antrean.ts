/** Penyimpanan naskah: simpan otomatis tiap 10 detik dan saat pindah halaman, dengan
 *  antrean offline di localStorage (kunci `penerbit.draf.<id>`). */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, simpanNaskah, type IsiSimpan } from '../api'

export const KUNCI_ANTREAN = (id: number) => `penerbit.draf.${id}`

export function simpanLokal(id: number, isi: IsiSimpan) {
  try {
    localStorage.setItem(KUNCI_ANTREAN(id), JSON.stringify(isi))
  } catch {
    /* penyimpanan penuh atau diblokir */
  }
}

export function ambilLokal(id: number): IsiSimpan | null {
  try {
    const s = localStorage.getItem(KUNCI_ANTREAN(id))
    return s ? (JSON.parse(s) as IsiSimpan) : null
  } catch {
    return null
  }
}

export function hapusLokal(id: number, sampaiWaktu?: number) {
  try {
    const ada = ambilLokal(id)
    if (ada && sampaiWaktu !== undefined && ada.waktu_klien > sampaiWaktu) return
    localStorage.removeItem(KUNCI_ANTREAN(id))
  } catch {
    /* abaikan */
  }
}

/** Pilih isi yang lebih baru: draf server atau salinan di perangkat. */
export function pilihTerbaru<T extends { waktu_klien: number }>(server: T | null, id: number): T | IsiSimpan | null {
  const lokal = ambilLokal(id)
  if (lokal && lokal.waktu_klien > (server?.waktu_klien ?? 0)) return lokal
  return server
}

export type HasilKirim = 'tersimpan' | 'antre' | 'kalah' | 'galat'
type Kirim = (id: number, isi: IsiSimpan) => Promise<unknown>

function gagalJaringan(e: unknown): boolean {
  if (e instanceof ApiError) return e.status >= 500
  return true
}

/** Kirim satu isi. Gagal jaringan → masuk antrean; 409 → server punya yang lebih baru,
 *  antrean dibuang. */
export async function kirimIsi(id: number, isi: IsiSimpan, kirim: Kirim = simpanNaskah): Promise<HasilKirim> {
  try {
    await kirim(id, isi)
    hapusLokal(id, isi.waktu_klien)
    return 'tersimpan'
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      hapusLokal(id, isi.waktu_klien)
      return 'kalah'
    }
    if (gagalJaringan(e)) {
      const ada = ambilLokal(id)
      if (!ada || ada.waktu_klien <= isi.waktu_klien) simpanLokal(id, isi)
      return 'antre'
    }
    return 'galat'
  }
}

/** Kirim ulang isi antrean (dipanggil saat `online`). */
export async function kirimUlang(id: number, kirim: Kirim = simpanNaskah): Promise<HasilKirim | null> {
  const ada = ambilLokal(id)
  if (!ada) return null
  return kirimIsi(id, ada, kirim)
}

export type StatusSimpan = 'tersimpan' | 'menyimpan' | 'antre' | 'kalah' | 'galat'

export const LABEL_STATUS: Record<StatusSimpan, string> = {
  tersimpan: 'Tersimpan',
  menyimpan: 'Menyimpan…',
  antre: 'Belum tersimpan ke server, tulisanmu aman di perangkat ini',
  kalah: 'Ada tulisan yang lebih baru di server. Muat ulang halaman ini, ya.',
  galat: 'Belum bisa menyimpan. Tulisanmu masih ada di layar.',
}

export type IsiTanpaWaktu = Omit<IsiSimpan, 'waktu_klien'>

export interface OpsiSimpan {
  jeda?: number
  kirim?: Kirim
  /** false = jangan simpan otomatis (mis. mode Baca) */
  aktif?: boolean
}

/** Simpan otomatis. `catat()` setiap kali isi berubah; `simpanSekarang()` sebelum
 *  menyimpan versi. */
export function useSimpanOtomatis(id: number | null, opsi: OpsiSimpan = {}) {
  const { jeda = 10_000, kirim = simpanNaskah, aktif = true } = opsi
  const [status, setStatus] = useState<StatusSimpan>('tersimpan')
  const tertunda = useRef<IsiSimpan | null>(null)
  const jalan = useRef<Promise<StatusSimpan> | null>(null)
  const hidup = useRef(true)
  const kirimRef = useRef(kirim)
  kirimRef.current = kirim

  const atur = (s: StatusSimpan) => {
    if (hidup.current) setStatus(s)
  }

  const catat = useCallback((isi: IsiTanpaWaktu) => {
    tertunda.current = { ...isi, waktu_klien: Date.now() }
    atur('menyimpan')
  }, [])

  const simpanSekarang = useCallback(async (): Promise<StatusSimpan> => {
    if (id === null) return 'tersimpan'
    while (jalan.current) await jalan.current
    const isi = tertunda.current
    if (!isi) {
      const ulang = await kirimUlang(id, kirimRef.current)
      if (ulang) atur(ulang)
      return ulang ?? 'tersimpan'
    }
    tertunda.current = null
    const p = kirimIsi(id, isi, kirimRef.current).then((h) => {
      // perubahan baru selama mengirim: tetap "Menyimpan…"
      const s: StatusSimpan = tertunda.current && h === 'tersimpan' ? 'menyimpan' : h
      atur(s)
      return h as StatusSimpan
    })
    jalan.current = p
    try {
      return await p
    } finally {
      jalan.current = null
    }
  }, [id])

  useEffect(() => {
    hidup.current = true
    if (id === null || !aktif) return
    const t = setInterval(() => {
      // isi baru, atau antrean di perangkat yang belum terkirim (server sempat mati
      // tanpa event `online`)
      if (tertunda.current || ambilLokal(id)) void simpanSekarang()
    }, jeda)
    const online = () => void simpanSekarang()
    const pergi = () => {
      if (tertunda.current) {
        simpanLokal(id, tertunda.current)
        void simpanSekarang()
      }
    }
    window.addEventListener('online', online)
    window.addEventListener('pagehide', pergi)
    window.addEventListener('beforeunload', pergi)
    // kirim antrean yang tertinggal dari kunjungan sebelumnya
    if (ambilLokal(id)) void simpanSekarang()
    return () => {
      clearInterval(t)
      window.removeEventListener('online', online)
      window.removeEventListener('pagehide', pergi)
      window.removeEventListener('beforeunload', pergi)
      // pindah halaman di dalam aplikasi
      if (tertunda.current) {
        const isi = tertunda.current
        tertunda.current = null
        simpanLokal(id, isi)
        void kirimIsi(id, isi, kirimRef.current)
      }
      hidup.current = false
    }
  }, [id, aktif, jeda, simpanSekarang])

  return { status, label: LABEL_STATUS[status], catat, simpanSekarang }
}
