import { useState, type FormEvent } from 'react'
import { ubahTokoh } from '../api'
import type { HadiahBaru, TokohNaskah } from '../types'
import '../editor/editor.css'

/**
 * Chip nama tokoh sebuah naskah. Nama tokoh tidak dihitung sebagai kata kembar
 * (Jejak dan tanda sistem Lapis 3). Anak bisa menghapus nama atau menambah nama.
 */
export default function NamaTokoh({ naskahId, nama, label = 'Nama tokoh', onUbah }: {
  naskahId: number
  nama: string[]
  label?: string
  onUbah: (tokoh: TokohNaskah, hadiahBaru: HadiahBaru[]) => void
}) {
  const [baru, setBaru] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  const kirim = async (body: { tambah: string } | { hapus: string }) => {
    setSibuk(true)
    setGalat(null)
    try {
      const r = await ubahTokoh(naskahId, body)
      if ('tambah' in body) setBaru('')
      onUbah(r.tokoh, r.hadiah_baru)
    } catch (e) {
      setGalat((e as Error).message)
    } finally {
      setSibuk(false)
    }
  }

  const tambah = (e: FormEvent) => {
    e.preventDefault()
    if (baru.trim()) kirim({ tambah: baru.trim() })
  }

  return (
    <div className="nama-tokoh" role="group" aria-label={label}>
      <p className="kecil">Nama tokoh tidak dihitung sebagai kata kembar.</p>
      <ul className="nama-tokoh-daftar">
        {nama.map((n) => (
          <li key={n} className="nama-tokoh-chip">
            <span>{n}</span>
            <button type="button" aria-label={`Hapus nama ${n}`} disabled={sibuk} onClick={() => kirim({ hapus: n })}>×</button>
          </li>
        ))}
        {nama.length === 0 && <li className="kecil">Belum ada nama tokoh.</li>}
      </ul>
      <form className="nama-tokoh-form" onSubmit={tambah}>
        <input className="isian" aria-label="Tambah nama tokoh" placeholder="Nama tokoh lain…" maxLength={60}
          value={baru} onChange={(e) => setBaru(e.target.value)} />
        <button type="submit" className="tombol-kecil" disabled={sibuk || !baru.trim()}>+ Tambah nama</button>
      </form>
      {galat && <p className="kecil" role="alert">{galat}</p>}
    </div>
  )
}
