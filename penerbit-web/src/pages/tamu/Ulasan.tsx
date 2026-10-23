import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getUlasan, kirimUlasan } from '../../api'
import { Galat, Memuat } from '../../components/ui'
import { paragraf, pesanGalat, tgl, useMuat } from '../ortu/umum'
import '../../styles/ortu-halaman.css'

const KOSONG = { favorit: '', membingungkan: '', pertanyaan: '' }

export default function Ulasan() {
  const id = Number(useParams().id)
  const { data, error, muat } = useMuat(() => getUlasan(id), [id])
  const [isi, setIsi] = useState(KOSONG)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [terkirim, setTerkirim] = useState(false)

  const kirim = async (e: FormEvent) => {
    e.preventDefault()
    setTerkirim(false)
    if (!isi.favorit.trim() || !isi.membingungkan.trim() || !isi.pertanyaan.trim())
      return setGalat('Isi ketiga bagian Kartu Ulasan dulu.')
    setSibuk(true)
    setGalat(null)
    try {
      await kirimUlasan(id, { favorit: isi.favorit.trim(), membingungkan: isi.membingungkan.trim(), pertanyaan: isi.pertanyaan.trim() })
      setIsi(KOSONG)
      setTerkirim(true)
      await muat()
    } catch (e) {
      setGalat(pesanGalat(e))
    } finally {
      setSibuk(false)
    }
  }
  const ubah = (k: keyof typeof KOSONG) => (e: { target: { value: string } }) => setIsi({ ...isi, [k]: e.target.value })

  return (
    <main className="page">
      <div className="layar tumpuk">
        <Link className="kembali" to="/ulasan">← Semua cerita</Link>
        <Galat pesan={error} />
        {!data && !error && <Memuat />}
        {data && (
          <>
            <header>
              <h1 className="page-title">{data.judul}</h1>
              <p className="kecil">oleh {data.penulis} · Versi {data.versi}</p>
            </header>
            <article className="teks-naskah teks-baca" aria-label="Teks cerita">
              {paragraf(data.teks).map((p, i) => <p key={i}>{p}</p>)}
            </article>

            <form className="kartu formulir" onSubmit={kirim} noValidate>
              <h2 className="judul-bagian">Kartu Ulasan</h2>
              <label>Bagian favoritku<textarea value={isi.favorit} onChange={ubah('favorit')} required /></label>
              <label>Bagian yang membuatku bingung<textarea value={isi.membingungkan} onChange={ubah('membingungkan')} required /></label>
              <label>Satu pertanyaan untuk penulis<input type="text" value={isi.pertanyaan} onChange={ubah('pertanyaan')} required /></label>
              <Galat pesan={galat} />
              {terkirim && <p className="pesan-ok" role="status">Terima kasih, ulasanmu sudah terkirim ke penulis.</p>}
              <div><button className="btn btn-primary" disabled={sibuk}>Kirim ulasan</button></div>
            </form>

            {data.ulasan_saya.length > 0 && (
              <section>
                <h2 className="judul-bagian">Ulasanmu sebelumnya</h2>
                {data.ulasan_saya.map((u, i) => (
                  <div key={i} className="kartu kecil" style={{ marginBottom: 'var(--space-3)' }}>
                    <div>{tgl(u.tanggal)}</div>
                    <div><b>Favorit:</b> {u.favorit}</div>
                    <div><b>Bingung:</b> {u.membingungkan}</div>
                    <div><b>Pertanyaan:</b> {u.pertanyaan}</div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
