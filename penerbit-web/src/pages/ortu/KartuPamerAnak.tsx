import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../../styles/penulis-halaman.css'
import { beriStiker, listKartuPamerAnak, reaksiKartuPamer } from '../../api'
import { PilihSimulasi } from './PertanyaanAnak'
import { BedaKata } from '../../components/bedaKata'
import { Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import type { KartuPamerOrtu } from '../../types'
import { ButuhPenulis, pesanGalat, TINGKAT, tglJam, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

function KartuAnak({ k, emoji }: { k: KartuPamerOrtu; emoji: string[] }) {
  const [pilih, setPilih] = useState(k.reaksi_emoji)
  const [kalimat, setKalimat] = useState(k.reaksi)
  const [stiker, setStiker] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [terkirim, setTerkirim] = useState(false)
  const [dimiliki, setDimiliki] = useState(k.alat?.stiker ?? [])
  const bisaStiker = TINGKAT.filter((t) => !dimiliki.includes(t.kode))

  const kirim = async () => {
    setSibuk(true)
    setGalat(null)
    setTerkirim(false)
    try {
      await reaksiKartuPamer(k.id, pilih, kalimat.trim())
      if (stiker && k.alat) {
        // Jalur stiker yang sama dengan halaman Stiker.
        await beriStiker(k.alat.kode, stiker, kalimat.trim() || `Kartu Pamer Modul ${k.modul.nomor}`)
        setDimiliki((d) => [...d, stiker as (typeof d)[number]])
        setStiker('')
      }
      setTerkirim(true)
    } catch (e) {
      setGalat(pesanGalat(e))
    } finally {
      setSibuk(false)
    }
  }

  return (
    <article className="kartu bagian-ortu" aria-label={`Modul ${k.modul.nomor} · ${k.modul.judul}`}>
      <p className="kecil">{k.modul.emoji} Modul {k.modul.nomor} · {k.modul.judul} · {tglJam(k.diubah)}</p>
      <p className="kecil">Yang aku pelajari:</p>
      <p style={{ fontSize: 'var(--text-lg)' }}>{k.pelajaran}</p>
      {k.hasil && (
        <div className="baris" style={{ alignItems: 'stretch' }}>
          <blockquote className="teks-naskah" style={{ flex: 1, margin: 0 }}>
            <b className="kecil">Sebelum</b>
            <p><BedaKata teks={k.hasil.sebelum} banding={k.hasil.sesudah} jenis="sebelum" /></p>
          </blockquote>
          <blockquote className="teks-naskah" style={{ flex: 1, margin: 0 }}>
            <b className="kecil">Sesudah</b>
            <p><BedaKata teks={k.hasil.sesudah} banding={k.hasil.sebelum} jenis="sesudah" /></p>
          </blockquote>
        </div>
      )}
      <p className="kecil">Rekaman suara anak (bila ada) hanya ada di tablet. Dengarkan bersama saat ia menunjukkannya.</p>
      <div className="formulir">
        <div className="baris" role="group" aria-label="Reaksi">
          {emoji.map((e) => (
            <button key={e} type="button" aria-pressed={pilih === e}
              className={`btn btn-kecil ${pilih === e ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPilih(pilih === e ? '' : e)}>{e}</button>
          ))}
        </div>
        <label>
          Satu kalimat (opsional)
          <input type="text" value={kalimat} maxLength={200} onChange={(e) => setKalimat(e.target.value)} />
        </label>
        {k.alat && bisaStiker.length > 0 && (
          <label>
            Beri stiker (opsional)
            <select value={stiker} onChange={(e) => setStiker(e.target.value)}>
              <option value="">Tanpa stiker</option>
              {bisaStiker.map((t) => (
                <option key={t.kode} value={t.kode}>{t.nama} {k.alat?.nama}</option>
              ))}
            </select>
          </label>
        )}
        <div className="baris">
          <button type="button" className="btn btn-primary btn-kecil" disabled={sibuk || (!pilih && !kalimat.trim())}
            onClick={() => void kirim()}>Kirim reaksi</button>
          {terkirim && <span className="pesan-ok">Reaksi terkirim. Muncul di Beranda anak.</span>}
        </div>
        <Galat pesan={galat} />
      </div>
    </article>
  )
}

function IsiKartuPamer() {
  const { penulisDipilih } = useMe()
  const [simulasi, setSimulasi] = useState(false)
  const { data, error } = useMuat(() => listKartuPamerAnak(simulasi), [penulisDipilih, simulasi])
  return (
    <main className="page">
      <Link className="kembali" to="/ortu">← Dasbor</Link>
      <h1 className="page-title">Kartu Pamer</h1>
      <p className="kecil">
        Di akhir modul anak menyusun Kartu Pamer: hasil yang ia betulkan dan satu kalimat tentang yang ia pelajari.
        Beri reaksi; reaksinya muncul di Beranda anak.
      </p>
      <PilihSimulasi nilai={simulasi} onUbah={setSimulasi} />
      <Galat pesan={error} />
      {!data && !error && <Memuat />}
      {data && data.kartu.length === 0 && <p className="kecil bagian-ortu">Belum ada Kartu Pamer.</p>}
      {data?.kartu.map((k) => <KartuAnak key={k.id} k={k} emoji={data.emoji} />)}
    </main>
  )
}

export default function KartuPamerAnak() {
  return <ButuhPenulis judul="Kartu Pamer"><IsiKartuPamer /></ButuhPenulis>
}
