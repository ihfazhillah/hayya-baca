import { useEffect, useId, useState, type FormEvent } from 'react'
import { kirimPertanyaan, listPertanyaanSaya } from '../api'
import type { Pertanyaan } from '../types'
import { Galat } from './ui'

const BATAS = 300

/** Tombol "Aku mau tanya Ayah atau Ummah" di halaman misi (Spec 075 K2).
 *  Anak menulis satu kalimat, lalu boleh lanjut. Jawabannya lisan; catatan Ayah muncul di sini. */
export default function TanyaAyah({ misi }: { misi: number }) {
  const [daftar, setDaftar] = useState<Pertanyaan[]>([])
  const [buka, setBuka] = useState(false)
  const [teks, setTeks] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [terkirim, setTerkirim] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const id = useId()

  useEffect(() => {
    let aktif = true
    listPertanyaanSaya(misi).then((d) => aktif && setDaftar(d)).catch(() => { /* tidak penting */ })
    return () => { aktif = false }
  }, [misi])

  async function kirim(e: FormEvent) {
    e.preventDefault()
    if (!teks.trim()) return
    setSibuk(true)
    setGalat(null)
    try {
      const p = await kirimPertanyaan(teks.trim(), misi)
      setDaftar((d) => [p, ...d])
      setTeks('')
      setBuka(false)
      setTerkirim(true)
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err))
    } finally {
      setSibuk(false)
    }
  }

  return (
    <section className="ph-tanya tidak-dicetak" aria-label="Tanya Ayah atau Ummah">
      {terkirim && (
        <p className="callout callout-info" role="status">Pertanyaanmu sudah dikirim. Kamu boleh lanjut dulu.</p>
      )}
      {buka ? (
        <form className="ph-tanya-form" onSubmit={kirim}>
          <label htmlFor={id}>Pertanyaanmu</label>
          <div className="baris">
            <input id={id} type="text" value={teks} maxLength={BATAS} autoFocus
              placeholder="Tulis satu kalimat saja."
              onChange={(e) => setTeks(e.target.value)} />
            <button type="submit" className="btn btn-primary" disabled={sibuk || !teks.trim()}>Kirim</button>
            <button type="button" className="btn btn-ghost" onClick={() => setBuka(false)}>Batal</button>
          </div>
          <Galat pesan={galat} />
        </form>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={() => { setBuka(true); setTerkirim(false) }}>
          <span aria-hidden="true">🙋</span> Aku mau tanya Ayah atau Ummah
        </button>
      )}
      {daftar.length > 0 && (
        <ul className="ph-tanya-daftar" aria-label="Pertanyaanmu di misi ini">
          {daftar.map((p) => (
            <li key={p.id}>
              <span>{p.teks}</span>
              {p.dijawab ? (
                p.catatan
                  ? <p className="ph-kutip">{p.dijawab_oleh ?? 'Ayah atau Ummah'}: “{p.catatan}”</p>
                  : <p className="kecil">Sudah dijawab.</p>
              ) : (
                <p className="kecil">Belum dijawab. Kamu boleh lanjut dulu.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
