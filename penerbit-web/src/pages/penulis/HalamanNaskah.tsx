import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { bukaLaci, getAlat, getNaskah, getVersi } from '../../api'
import type { Alat, NaskahDetail, VersiDetail } from '../../types'
import { Galat, KepalaHalaman, Memuat } from '../../components/ui'
import Editor from '../../editor/Editor'
import { LAPIS, NAMA_STEMPEL, URUTAN_STEMPEL, adalahLapis, formatSisa, namaLapis, tanggalPendek } from '../../editor/naskah'
import '../../editor/editor.css'

function JalurStempel({ n }: { n: NaskahDetail }) {
  const terbit = n.tahap === 'terbit'
  const sekarang = terbit ? null : (n.lapis_berikutnya ?? 'terbit')
  return (
    <section aria-labelledby="judul-jalur">
      <h2 id="judul-jalur" className="langkah-judul">Jalur stempel</h2>
      <ol className="jalur-stempel" style={{ listStyle: 'none' }}>
        {URUTAN_STEMPEL.map((l) => {
          const s = n.stempel.find((x) => x.lapis === l)
          const kelas = s?.punya ? 'punya' : sekarang === l ? 'sekarang' : ''
          return (
            <li key={l} className={`stempel ${kelas}`} title={s?.catatan || undefined}
              aria-label={`${NAMA_STEMPEL[l]}${s?.punya ? ', sudah' : sekarang === l ? ', sekarang' : ''}`}>
              {s?.punya ? '✓ ' : ''}{NAMA_STEMPEL[l]}{sekarang === l ? <><br />sekarang</> : null}
            </li>
          )
        })}
        <li className={`stempel ${terbit ? 'punya' : sekarang === 'terbit' ? 'sekarang' : ''}`}>
          TERBIT{n.nomor_terbitan ? <><br />{n.nomor_terbitan}</> : null}
        </li>
      </ol>
    </section>
  )
}

function Laci({ n, onBuka }: { n: NaskahDetail; onBuka: (kartu: string) => void }) {
  const [sisa, setSisa] = useState(n.laci?.sisa_detik ?? 0)
  const [galat, setGalat] = useState<string | null>(null)
  const [membuka, setMembuka] = useState(false)
  const terkunci = !!n.laci?.terkunci && sisa > 0
  useEffect(() => {
    if (!terkunci) return
    const t = setInterval(() => setSisa((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [terkunci])

  const buka = async () => {
    setMembuka(true)
    setGalat(null)
    try {
      const r = await bukaLaci(n.id)
      onBuka(r.kartu_tebakan)
    } catch (e) {
      setGalat((e as Error).message)
      setMembuka(false)
    }
  }

  return (
    <section className="kartu tumpuk" aria-labelledby="judul-laci">
      <h2 id="judul-laci" className="langkah-judul">🔒 Laci Rahasia</h2>
      {terkunci ? (
        <>
          <p>Buka dalam <strong>{formatSisa(sisa)}</strong>.</p>
          <p className="kecil">Sambil menunggu: <Link to="/latihan">Latihan Harian</Link> atau isi <Link to="/naskah">Bank Ide</Link>.</p>
        </>
      ) : (
        <>
          <p>Naskahmu sudah cukup lama tidur. Siap membacanya dengan mata baru?</p>
          <div><button type="button" className="btn-besar" onClick={buka} disabled={membuka}>Buka laci</button></div>
        </>
      )}
      <Galat pesan={galat} />
    </section>
  )
}

export default function HalamanNaskah() {
  const { id } = useParams()
  const nid = Number(id)
  const [n, setN] = useState<NaskahDetail | null>(null)
  const [alat, setAlat] = useState<Alat[]>([])
  const [galat, setGalat] = useState<string | null>(null)
  const [baca, setBaca] = useState<VersiDetail | null>(null)
  const [kartuDibuka, setKartuDibuka] = useState<string | null>(null)

  const muat = () => getNaskah(nid).then(setN).catch((e: Error) => setGalat(e.message))
  useEffect(() => {
    void muat()
    getAlat().then((r) => setAlat(r.alat)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nid])

  const bacaVersi = async (nomor: number) => {
    if (baca?.nomor === nomor) {
      setBaca(null)
      return
    }
    try {
      setBaca(await getVersi(nid, nomor))
    } catch (e) {
      setGalat((e as Error).message)
    }
  }

  if (!n) return <main className="page"><div className="layar"><Galat pesan={galat} />{!galat && <Memuat />}</div></main>

  const terakhir = n.versi[n.versi.length - 1]
  const sub = [
    `Dimulai ${tanggalPendek(n.created_at)}`,
    n.jumlah_kata_v1 !== null ? `Versi 1: ${n.jumlah_kata_v1} kata` : null,
    terakhir && terakhir.nomor > 1 ? `sekarang Versi ${terakhir.nomor}: ${terakhir.jumlah_kata} kata` : null,
  ].filter(Boolean).join(' · ')
  const lapis = n.lapis_berikutnya
  const bolehRevisi = n.tahap === 'revisi' && adalahLapis(lapis)

  return (
    <main className="page">
      <div className="layar tumpuk">
        <Link to="/naskah">← Ruang Penulis</Link>
        <KepalaHalaman judul={n.judul} sub={sub} />
        <JalurStempel n={n} />

        {n.tahap === 'laci' && (
          <Laci n={n} onBuka={(k) => {
            setKartuDibuka(k)
            void muat()
          }} />
        )}

        {kartuDibuka !== null && (
          <div className="callout callout-accent" role="status">
            <span className="callout-icon">🃏</span>
            <div className="callout-content">
              <p><strong>Kartu Tebakanmu:</strong> {kartuDibuka ? `“${kartuDibuka}”` : 'kamu belum menulis tebakan.'}</p>
              {kartuDibuka && <p>Masih setuju? Simpan jawabannya dalam hati, lalu buktikan saat merevisi.</p>}
            </div>
          </div>
        )}
        {n.tahap === 'revisi' && kartuDibuka === null && n.kartu_tebakan && (
          <p className="kecil">Kartu Tebakanmu: “{n.kartu_tebakan}”</p>
        )}
        {n.stempel_diminta && (
          <p className="lencana aktif">Menunggu stempel {NAMA_STEMPEL[n.stempel_diminta] ?? n.stempel_diminta} dari Ayah atau Ummah</p>
        )}

        <div className="baris">
          {n.tahap === 'draf_nol' && <Link className="btn-besar" to={`/naskah/${nid}/draf-nol`}>Lanjut menulis Draf Nol</Link>}
          {bolehRevisi && (
            <Link className="btn-besar" to={`/naskah/${nid}/revisi/${lapis}`}>Lanjut ke Revisi Lapis {LAPIS[lapis].nomor}</Link>
          )}
          {n.tahap === 'revisi' && lapis === 'pembaca' && (
            <p>Semua lapis revisi sudah distempel. Sekarang giliran pembaca!</p>
          )}
          {n.versi.length >= 2 && <Link className="btn-besar sekunder" to={`/naskah/${nid}/bandingkan`}>Lihat Sebelum dan Sesudah</Link>}
        </div>

        <section aria-labelledby="judul-versi">
          <h2 id="judul-versi" className="langkah-judul">Versi</h2>
          {n.versi.length === 0 && <p className="kecil">Belum ada versi. Versi 1 tersimpan setelah Draf Nol selesai.</p>}
          <ul className="daftar-versi">
            {[...n.versi].reverse().map((v) => (
              <li key={v.nomor}>
                <span className="isi">
                  <strong>Versi {v.nomor}</strong> · {namaLapis(v.lapis)} · {tanggalPendek(v.tanggal)}
                  <span className="kecil"> · {v.jumlah_kata} kata</span>
                </span>
                <button type="button" className="tombol-kecil" aria-expanded={baca?.nomor === v.nomor}
                  onClick={() => bacaVersi(v.nomor)}>{baca?.nomor === v.nomor ? 'Tutup' : `Baca Versi ${v.nomor}`}</button>
              </li>
            ))}
          </ul>
          {n.versi.length > 0 && <p className="kecil" style={{ marginTop: 8 }}>Versi lama hanya bisa dibaca dan diberi stabilo, tidak bisa diubah.</p>}
          {baca && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Editor key={baca.nomor} mode="baca" isi={baca.isi} teks={baca.teks} sorotan={baca.sorotan}
                warna={alat} label={`Versi ${baca.nomor}`} />
            </div>
          )}
        </section>

        {(n.catatan.length > 0 || n.ulasan.length > 0) && (
          <section aria-labelledby="judul-pembaca" className="tumpuk">
            <h2 id="judul-pembaca" className="langkah-judul">Dari pembaca</h2>
            {n.stempel.filter((s) => s.punya && s.catatan).map((s) => (
              <div key={s.lapis} className="kartu">
                <p className="kecil">Stempel {s.nama} · {tanggalPendek(s.tanggal)}</p>
                <p>{s.catatan}</p>
              </div>
            ))}
            {n.catatan.map((c, i) => (
              <div key={`c${i}`} className="kartu">
                <p className="kecil">{c.oleh} · {tanggalPendek(c.tanggal)}</p>
                <p>{c.teks}</p>
              </div>
            ))}
            {n.ulasan.map((u, i) => (
              <div key={`u${i}`} className="kartu">
                <p className="kecil">Kartu Ulasan dari {u.oleh} · Versi {u.versi} · {tanggalPendek(u.tanggal)}</p>
                <dl className="tumpuk" style={{ marginTop: 8 }}>
                  <div><dt><strong>Bagian favoritku</strong></dt><dd>{u.favorit}</dd></div>
                  <div><dt><strong>Yang membuatku bingung</strong></dt><dd>{u.membingungkan}</dd></div>
                  <div><dt><strong>Pertanyaanku</strong></dt><dd>{u.pertanyaan}</dd></div>
                </dl>
              </div>
            ))}
          </section>
        )}
        <Galat pesan={galat} />
      </div>
    </main>
  )
}
