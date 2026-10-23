import { useState } from 'react'
import { Link } from 'react-router-dom'
import { catatanPrompt, listPromptAnak } from '../../api'
import { Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import type { PromptAnak as Prompt } from '../../types'
import { ButuhPenulis, NAMA_TAHAP_MENTOR, pesanGalat, RUMUS_BERTANYA, tglJam, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

const NAMA_BANTU = { ya: 'Ya', sedikit: 'Sedikit', tidak: 'Tidak' } as const

function KartuPrompt({ p }: { p: Prompt }) {
  const [catatan, setCatatan] = useState(p.catatan_ortu)
  const [tersimpan, setTersimpan] = useState(p.catatan_ortu)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const contohLengkap = p.tahap === 'contoh' && p.bagian.length === 0

  const simpan = async () => {
    setSibuk(true)
    setGalat(null)
    try {
      const r = await catatanPrompt(p.id, catatan.trim())
      setTersimpan(r.catatan_ortu)
      setCatatan(r.catatan_ortu)
    } catch (e) {
      setGalat(pesanGalat(e))
    } finally {
      setSibuk(false)
    }
  }

  return (
    <article className="kartu bagian-ortu" aria-label={`Prompt ${tglJam(p.tanggal)}`}>
      <p className="kecil">
        {tglJam(p.tanggal)} · Modul {p.modul} · tahap <b>{NAMA_TAHAP_MENTOR[p.tahap] ?? p.tahap}</b>
      </p>
      {contohLengkap ? (
        <p className="kecil">Prompt contoh lengkap disalin apa adanya (tahap Contoh).</p>
      ) : (
        <ul className="bagian-rumus">
          {RUMUS_BERTANYA.map((label, i) => {
            const isi = (p.bagian[i] ?? '').trim()
            return (
              <li key={label} className={isi ? 'ada' : 'kosong'}>
                <b>{isi ? '✓' : '○'} {label}</b>
                <div>{isi || 'kosong'}</div>
              </li>
            )
          })}
        </ul>
      )}
      <blockquote className="teks-naskah" style={{ fontSize: 'var(--text-base)', margin: 0 }}>{p.teks}</blockquote>
      <p className="kecil">
        Refleksi anak: membantu? <b>{p.refleksi_bantu ? NAMA_BANTU[p.refleksi_bantu] : 'belum diisi'}</b>
        {p.refleksi_ubah && <> · yang diubah sendiri: “{p.refleksi_ubah}”</>}
      </p>
      <div className="formulir">
        <label>
          Catatan orang tua
          <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)}
            placeholder="Bahan obrolan, bukan penilaian." />
        </label>
        <div className="baris">
          <button type="button" className="btn btn-ghost btn-kecil" disabled={sibuk || catatan.trim() === tersimpan}
            onClick={() => void simpan()}>Simpan catatan</button>
          {tersimpan && catatan.trim() === tersimpan && <span className="pesan-ok">Tersimpan</span>}
        </div>
        <Galat pesan={galat} />
      </div>
    </article>
  )
}

function IsiPromptAnak() {
  const { penulisDipilih } = useMe()
  const { data, error } = useMuat(listPromptAnak, [penulisDipilih])
  const daftar = [...(data ?? [])].sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  return (
    <main className="page">
      <Link className="kembali" to="/ortu">← Dasbor</Link>
      <h1 className="page-title">Prompt anak</h1>
      <p className="kecil">Prompt yang disusun anak untuk Mentor AI. Catatan di sini bahan obrolan, bukan penilaian.</p>
      <Galat pesan={error} />
      {!data && !error && <Memuat />}
      {data && daftar.length === 0 && <p className="kecil bagian-ortu">Belum ada prompt.</p>}
      {daftar.map((p) => <KartuPrompt key={p.id} p={p} />)}
    </main>
  )
}

export default function PromptAnak() {
  return <ButuhPenulis judul="Prompt anak"><IsiPromptAnak /></ButuhPenulis>
}
