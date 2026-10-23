import { useState } from 'react'
import { Link } from 'react-router-dom'
import { aktifkanPenulis, getDasbor } from '../../api'
import { Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import { pesanGalat, tglJam, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

function KartuAktifkan({ anak }: { anak: { child_id: number; nama: string } }) {
  const { muatUlang } = useMe()
  const [sibuk, setSibuk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const aktifkan = async () => {
    setSibuk(true)
    setError(null)
    try {
      await aktifkanPenulis(anak.child_id)
      await muatUlang()
    } catch (e) {
      setError(pesanGalat(e))
      setSibuk(false)
    }
  }
  return (
    <div className="kartu bagian-ortu">
      <p>
        <b>{anak.nama}</b> belum terdaftar sebagai penulis. Setelah diaktifkan, {anak.nama} bisa masuk dan
        mulai Modul 1.
      </p>
      <button className="btn btn-primary" onClick={aktifkan} disabled={sibuk}>
        Aktifkan Penerbit Rumah untuk {anak.nama}
      </button>
      <Galat pesan={error} />
    </div>
  )
}

function IsiDasbor() {
  const { penulisDipilih } = useMe()
  const { data, error } = useMuat(getDasbor, [penulisDipilih])
  if (error) return <Galat pesan={error} />
  if (!data) return <Memuat />
  const t = data.perlu_tindakan
  const m = data.minggu_ini
  const p = data.persiapan.modul
  const angka = [
    { n: t.lembar, teks: 'lembar menunggu diperiksa', ke: '/ortu/lembar?status=menunggu' },
    { n: t.stempel, teks: 'naskah minta stempel', ke: '/ortu/naskah' },
    { n: t.penukaran, teks: 'penukaran poin diajukan', ke: '/ortu/hadiah' },
  ]
  return (
    <>
      <section className="bagian-ortu" aria-labelledby="perlu">
        <h2 id="perlu" className="judul-bagian">Perlu tindakan</h2>
        <div className="perlu-tindakan">
          {angka.map((a) => (
            <Link key={a.ke} to={a.ke} className={`kartu-angka${a.n ? '' : ' nol'}`}>
              <span className="angka-besar">{a.n}</span>
              {a.teks}
            </Link>
          ))}
        </div>
      </section>

      <section className="bagian-ortu" aria-labelledby="minggu">
        <h2 id="minggu" className="judul-bagian">Minggu ini · {data.penulis.nama}</h2>
        <ul className="ringkas-minggu">
          <li><b>{m.sesi}</b> sesi</li>
          <li><b>{m.misi_selesai}</b> misi selesai</li>
          <li><b>{m.kata_draf_nol}</b> kata Draf Nol</li>
          {m.alat && <li>{m.alat} sedang dipelajari</li>}
        </ul>
      </section>

      <section className="bagian-ortu" aria-labelledby="persiapan">
        <h2 id="persiapan" className="judul-bagian">Persiapan sesi berikutnya</h2>
        {p ? (
          <div className="kartu bagian-ortu">
            <p><b>Modul {p.nomor} · {p.judul}</b></p>
            {p.petunjuk_lihat && <p><span className="kecil">Tahap Lihat untuk orang tua:</span> {p.petunjuk_lihat}</p>}
            {p.lembar.length > 0 ? (
              <div className="baris">
                {p.lembar.map((kode) => (
                  <a key={kode} className="btn btn-ghost btn-kecil" href={`/cetak/${encodeURIComponent(kode)}`}
                    target="_blank" rel="noreferrer">
                    🖨️ Cetak {kode}
                  </a>
                ))}
                <Link className="btn btn-ghost btn-kecil" to={`/ortu/cetak?modul=${p.nomor}`}>
                  Cetak semua lembar Modul {p.nomor}
                </Link>
              </div>
            ) : (
              <p className="kecil">Modul ini tidak punya lembar cetak.</p>
            )}
          </div>
        ) : (
          <p className="kecil">Tidak ada modul terbuka yang menunggu.</p>
        )}
      </section>

      <section className="bagian-ortu" aria-labelledby="aktivitas">
        <h2 id="aktivitas" className="judul-bagian">Aktivitas terbaru</h2>
        {data.aktivitas.length ? (
          <ul className="daftar-aktivitas">
            {data.aktivitas.map((a, i) => (
              <li key={i}><time dateTime={a.tanggal}>{tglJam(a.tanggal)}</time><span>{a.teks}</span></li>
            ))}
          </ul>
        ) : (
          <p className="kecil">Belum ada aktivitas.</p>
        )}
      </section>

      <section className="bagian-ortu" aria-labelledby="lainnya">
        <h2 id="lainnya" className="judul-bagian">Halaman lain</h2>
        <div className="baris">
          <Link className="btn btn-ghost" to="/ortu/stiker">Stiker dan stempel</Link>
          <Link className="btn btn-ghost" to="/ortu/prompt">Prompt anak</Link>
          <Link className="btn btn-ghost" to="/rak">Rak Buku</Link>
        </div>
      </section>
    </>
  )
}

export default function Dasbor() {
  const { me } = useMe()
  const adaPenulis = (me?.pemeriksa.length ?? 0) > 0
  const bisa = me?.bisa_diaktifkan ?? []
  return (
    <main className="page">
      <h1 className="page-title">Dasbor</h1>
      {!adaPenulis && bisa.length === 0 && (
        <p className="kecil">Belum ada penulis yang bisa diperiksa.</p>
      )}
      {!adaPenulis && bisa.map((a) => <KartuAktifkan key={a.child_id} anak={a} />)}
      {adaPenulis && <IsiDasbor />}
      {adaPenulis && bisa.length > 0 && (
        <section className="bagian-ortu" aria-label="Aktifkan penulis lain">
          {bisa.map((a) => <KartuAktifkan key={a.child_id} anak={a} />)}
        </section>
      )}
    </main>
  )
}
