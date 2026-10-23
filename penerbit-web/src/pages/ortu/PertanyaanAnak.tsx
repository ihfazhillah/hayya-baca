import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listPertanyaanAnak, tandaiDijawab } from '../../api'
import { Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import type { Pertanyaan } from '../../types'
import { ButuhPenulis, pesanGalat, tglJam, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

function konteks(p: Pertanyaan): string {
  const bagian = []
  if (p.modul) bagian.push(`Modul ${p.modul.nomor}`)
  if (p.misi) bagian.push(`Misi ${p.misi.urutan}`, p.misi.judul)
  else if (p.modul) bagian.push(p.modul.judul)
  return bagian.join(' · ')
}

function KartuPertanyaan({ p, onDijawab }: { p: Pertanyaan; onDijawab: (p: Pertanyaan) => void }) {
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const jawab = async () => {
    setSibuk(true)
    setGalat(null)
    try {
      onDijawab(await tandaiDijawab(p.id, catatan.trim()))
    } catch (e) {
      setGalat(pesanGalat(e))
      setSibuk(false)
    }
  }
  return (
    <article className="kartu bagian-ortu">
      <p className="kecil">{tglJam(p.dibuat)}{konteks(p) && <> · {konteks(p)}</>}</p>
      <p style={{ fontSize: 'var(--text-lg)' }}>{p.teks}</p>
      {p.dijawab ? (
        <p className="kecil">
          Dijawab {p.dijawab_oleh ? `oleh ${p.dijawab_oleh} ` : ''}{tglJam(p.dijawab_pada)}
          {p.catatan && <> · “{p.catatan}”</>}
        </p>
      ) : (
        <div className="formulir">
          <label>
            Catatan untuk anak (opsional)
            <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)}
              placeholder="Jawab lisan dulu. Catatan ini muncul di Beranda anak." />
          </label>
          <div className="baris">
            <button type="button" className="btn btn-primary btn-kecil" disabled={sibuk} onClick={() => void jawab()}>
              Sudah dijawab
            </button>
          </div>
          <Galat pesan={galat} />
        </div>
      )}
    </article>
  )
}

function IsiPertanyaan() {
  const { penulisDipilih } = useMe()
  const [simulasi, setSimulasi] = useState(false)
  const { data, setData, error } = useMuat(() => listPertanyaanAnak(simulasi), [penulisDipilih, simulasi])
  const terbuka = (data ?? []).filter((p) => !p.dijawab)
  const sudah = (data ?? []).filter((p) => p.dijawab)
  const dijawab = (baru: Pertanyaan) =>
    setData((d) => (d ? d.map((p) => (p.id === baru.id ? baru : p)) : d))
  return (
    <main className="page">
      <Link className="kembali" to="/ortu">← Dasbor</Link>
      <h1 className="page-title">Pertanyaan anak</h1>
      <p className="kecil">
        Anak menulis pertanyaan dari halaman misi lalu lanjut belajar. Jawab secara lisan saat sempat, lalu tekan
        Sudah dijawab.
      </p>
      <PilihSimulasi nilai={simulasi} onUbah={setSimulasi} />
      <Galat pesan={error} />
      {!data && !error && <Memuat />}
      {data && (
        <>
          <section className="bagian-ortu" aria-labelledby="judul-terbuka">
            <h2 id="judul-terbuka" className="judul-bagian">Belum dijawab</h2>
            {terbuka.length === 0 && <p className="kecil">Semua pertanyaan sudah dijawab.</p>}
            {terbuka.map((p) => <KartuPertanyaan key={p.id} p={p} onDijawab={dijawab} />)}
          </section>
          {sudah.length > 0 && (
            <section className="bagian-ortu" aria-labelledby="judul-sudah">
              <h2 id="judul-sudah" className="judul-bagian">Sudah dijawab</h2>
              {sudah.map((p) => <KartuPertanyaan key={p.id} p={p} onDijawab={dijawab} />)}
            </section>
          )}
        </>
      )}
    </main>
  )
}

/** Orang tua yang memakai "Lihat sebagai anak" bisa mencoba sisi ini dengan data simulasinya. */
export function PilihSimulasi({ nilai, onUbah }: { nilai: boolean; onUbah: (v: boolean) => void }) {
  const { me } = useMe()
  if (!me?.bisa_simulasi) return null
  return (
    <label className="kecil" style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <input type="checkbox" checked={nilai} onChange={(e) => onUbah(e.target.checked)} />
      Tampilkan milik simulasi saya
    </label>
  )
}

export default function PertanyaanAnak() {
  return <ButuhPenulis judul="Pertanyaan anak"><IsiPertanyaan /></ButuhPenulis>
}
