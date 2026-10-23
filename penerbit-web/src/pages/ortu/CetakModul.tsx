import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCetakModul, getStikerOrtu } from '../../api'
import LembarA4 from '../../components/LembarA4'
import { Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import type { Alat } from '../../types'
import { pesanGalat, TINGKAT, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

const JUMLAH_MODUL = 16

/** Kartu Alat untuk ditempel di dinding: lima alat, tiga lingkaran stiker kosong. */
function KartuAlatDinding({ alat, nama }: { alat: Alat[]; nama: string }) {
  return (
    <article className="lembar-cetak kartu-dinding" aria-label="Kartu Alat">
      <header className="kepala">
        <div>
          <div className="logo">Penerbit Rumah</div>
          <h1>Kartu Alat{nama ? ` · ${nama}` : ''}</h1>
        </div>
      </header>
      {alat.map((a) => (
        <div key={a.kode} className="baris-alat">
          <div className="nama">
            <b>{a.emoji} {a.nama}</b>
            <div style={{ fontSize: '12pt' }}>{a.pertanyaan}</div>
          </div>
          {TINGKAT.map((t) => <span key={t.kode} className="lingkaran-stiker">{t.nama}</span>)}
        </div>
      ))}
    </article>
  )
}

export default function CetakModul() {
  const { me, penulisDipilih } = useMe()
  const [params, setParams] = useSearchParams()
  const modul = Math.min(JUMLAH_MODUL, Math.max(1, Number(params.get('modul')) || 1))
  const { data, error } = useMuat(() => getCetakModul(modul), [modul])
  const [dipilih, setDipilih] = useState<Set<string>>(new Set())
  const [kartuAlat, setKartuAlat] = useState(false)
  const [alat, setAlat] = useState<Alat[] | null>(null)
  const [cetak, setCetak] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    setDipilih(new Set(data?.lembar.map((l) => l.kode) ?? []))
    setCetak(false)
  }, [data])
  useEffect(() => setAlat(null), [penulisDipilih])

  useEffect(() => {
    if (cetak) window.print()
  }, [cetak])

  const ganti = (kode: string) => {
    const s = new Set(dipilih)
    if (s.has(kode)) s.delete(kode)
    else s.add(kode)
    setDipilih(s)
    setCetak(false)
  }

  const mulaiCetak = async () => {
    setGalat(null)
    if (kartuAlat && !alat) {
      try {
        setAlat((await getStikerOrtu()).alat)
      } catch (e) {
        return setGalat(pesanGalat(e))
      }
    }
    setCetak(false)
    // Render dulu, baru buka dialog cetak.
    setTimeout(() => setCetak(true), 0)
  }

  const lembarDipilih = data?.lembar.filter((l) => dipilih.has(l.kode)) ?? []
  const namaPenulis = me?.pemeriksa.find((p) => p.id === penulisDipilih)?.nama ?? ''
  const jumlah = lembarDipilih.length + (kartuAlat ? 1 : 0)

  return (
    <main className="page">
      <div className="tidak-dicetak tumpuk-ortu">
        <h1 className="page-title">Cetak per modul</h1>
        <div className="saringan">
          <label>
            Modul
            <select className="isian" value={modul} onChange={(e) => setParams({ modul: e.target.value }, { replace: true })}>
              {Array.from({ length: JUMLAH_MODUL }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Modul {n}</option>
              ))}
            </select>
          </label>
          {data && <b className="judul-modul-cetak">{data.modul.judul}</b>}
        </div>
        <Galat pesan={error ?? galat} />
        {!data && !error && <Memuat />}
        {data && (
          <section className="bagian-ortu" aria-label="Lembar modul">
            {data.lembar.length === 0 && <p className="kecil">Modul ini tidak punya lembar cetak.</p>}
            <ul className="pilih-lembar">
              {data.lembar.map((l) => (
                <li key={l.kode}>
                  <label className="baris">
                    <input type="checkbox" checked={dipilih.has(l.kode)} onChange={() => ganti(l.kode)} />
                    <span className="mono"><b>{l.kode}</b></span> {l.judul}
                  </label>
                </li>
              ))}
            </ul>
            <label className="baris pilih-kartu">
              <input type="checkbox" checked={kartuAlat} onChange={(e) => { setKartuAlat(e.target.checked); setCetak(false) }} />
              Kartu Alat untuk ditempel di dinding
            </label>
            <div className="baris">
              <button type="button" className="btn btn-primary" disabled={jumlah === 0} onClick={() => void mulaiCetak()}>
                Cetak yang dipilih ({jumlah})
              </button>
              {cetak && <button type="button" className="btn btn-ghost" onClick={() => setCetak(false)}>Tutup pratinjau</button>}
            </div>
            <p className="kecil">Satu lembar per halaman A4. Pilih "Tanpa header dan footer" di dialog cetak.</p>
          </section>
        )}
      </div>
      {cetak && (
        <div className="area-cetak" aria-label="Pratinjau cetak">
          {lembarDipilih.map((l) => <LembarA4 key={l.kode} lembar={l} />)}
          {kartuAlat && alat && <KartuAlatDinding alat={alat} nama={namaPenulis} />}
        </div>
      )}
    </main>
  )
}
