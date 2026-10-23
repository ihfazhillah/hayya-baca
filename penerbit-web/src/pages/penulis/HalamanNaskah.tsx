import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { bukaLaci, getAlat, getNaskah, getVersi } from '../../api'
import type { Alat, NaskahDetail, VersiDetail } from '../../types'
import { Galat, KepalaHalaman, Memuat } from '../../components/ui'
import Editor from '../../editor/Editor'
import { LAPIS, NAMA_STEMPEL, URUTAN_STEMPEL, adalahLapis, formatSisa, namaLapis, tanggalPendek } from '../../editor/naskah'
import '../../editor/editor.css'

const EMOJI_STEMPEL: Record<string, string> = { peta: '🗺️', kamera: '🎥', gunting: '✂️', kaca: '🔍', pembaca: '📖' }

function JalurStempel({ n }: { n: NaskahDetail }) {
  const terbit = n.tahap === 'terbit'
  // "sekarang" hanya saat naskah sedang direvisi (bukan saat Draf Nol atau di laci)
  const sekarang = n.tahap === 'revisi' ? (n.lapis_berikutnya ?? 'terbit') : null
  return (
    <section className="kartu jalur-kartu" aria-labelledby="judul-jalur">
      <h2 id="judul-jalur" className="sub-judul">Jalur stempel</h2>
      <ol className="jalur-naskah">
        {URUTAN_STEMPEL.map((l) => {
          const s = n.stempel.find((x) => x.lapis === l)
          const kelas = s?.punya ? 'punya' : sekarang === l ? 'sekarang' : ''
          return (
            <li key={l} className={`jalur-titik ${kelas}`} title={s?.catatan || undefined}
              aria-label={`${NAMA_STEMPEL[l]}${s?.punya ? ', sudah' : sekarang === l ? ', sekarang' : ''}`}>
              <span className="lingkar" aria-hidden="true">{s?.punya ? '✓' : sekarang === l ? EMOJI_STEMPEL[l] : ''}</span>
              <span className="nama">{NAMA_STEMPEL[l]}{sekarang === l ? ' · sekarang' : ''}</span>
            </li>
          )
        })}
        <li className={`jalur-titik terbit ${terbit ? 'punya' : sekarang === 'terbit' ? 'sekarang' : ''}`}
          aria-label={`Terbit${terbit ? ', sudah' : sekarang === 'terbit' ? ', sekarang' : ''}`}>
          <span className="lingkar" aria-hidden="true">TERBIT</span>
          <span className="nama">{n.nomor_terbitan || 'Terbit'}</span>
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
    <section className="kartu laci-kartu tumpuk" aria-labelledby="judul-laci">
      <h2 id="judul-laci" className="sub-judul">🔒 Laci Rahasia</h2>
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
  const catatanStempel = n.stempel.filter((s) => s.punya && s.catatan)

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

        <section aria-labelledby="judul-versi">
          <h2 id="judul-versi" className="sub-judul">Versi</h2>
          {n.versi.length === 0 && <p className="kecil">Belum ada versi. Versi 1 tersimpan setelah Draf Nol selesai.</p>}
          <ul className="daftar-versi">
            {[...n.versi].reverse().map((v) => (
              <li key={v.nomor}>
                <strong>Versi {v.nomor}</strong>
                <span className="isi">{namaLapis(v.lapis)}{v.tanggal ? ` · ${tanggalPendek(v.tanggal)}` : ''}</span>
                <span className="kecil">{v.jumlah_kata} kata</span>
                <button type="button" className="tombol-kecil" aria-expanded={baca?.nomor === v.nomor}
                  onClick={() => bacaVersi(v.nomor)}>{baca?.nomor === v.nomor ? 'Tutup' : `Baca Versi ${v.nomor}`}</button>
              </li>
            ))}
          </ul>
          {n.versi.length > 0 && <p className="kecil" style={{ marginTop: 'var(--space-3)' }}>Versi lama hanya bisa dibaca dan diberi stabilo, tidak bisa diubah.</p>}
          {baca && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Editor key={baca.nomor} mode="baca" isi={baca.isi} teks={baca.teks} sorotan={baca.sorotan}
                warna={alat} label={`Versi ${baca.nomor}`} />
            </div>
          )}
        </section>

        <div className="baris tombol-naskah">
          {n.tahap === 'draf_nol' && <Link className="btn-besar tautan-tombol" to={`/naskah/${nid}/draf-nol`}>Lanjut menulis Draf Nol</Link>}
          {bolehRevisi && (
            <Link className="btn-besar tautan-tombol" to={`/naskah/${nid}/revisi/${lapis}`}>Lanjut ke Revisi Lapis {LAPIS[lapis].nomor}</Link>
          )}
          {n.tahap === 'revisi' && lapis === 'pembaca' && (
            <p>Semua lapis revisi sudah distempel. Sekarang giliran pembaca!</p>
          )}
          {n.versi.length >= 2 && <Link className="btn-besar sekunder tautan-tombol" to={`/naskah/${nid}/bandingkan`}>Lihat Sebelum dan Sesudah</Link>}
        </div>

        {(catatanStempel.length > 0 || n.catatan.length > 0 || n.ulasan.length > 0) && (
          <section aria-labelledby="judul-pembaca" className="daftar-pembaca">
            <h2 id="judul-pembaca" className="sub-judul">Dari pembaca</h2>
            {catatanStempel.map((s) => (
              <div key={s.lapis} className="catatan-pembaca">
                <strong>Stempel {s.nama}{s.tanggal ? ` · ${tanggalPendek(s.tanggal)}` : ''}</strong>
                <p>{s.catatan}</p>
              </div>
            ))}
            {n.catatan.map((c, i) => (
              <div key={`c${i}`} className="catatan-pembaca">
                <strong>{c.oleh} · {tanggalPendek(c.tanggal)}</strong>
                <p>{c.teks}</p>
              </div>
            ))}
            {n.ulasan.map((u, i) => (
              <div key={`u${i}`}>
                <dl className="kartu kartu-ulasan">
                  <div><dt>Bagian favoritku</dt><dd>{u.favorit}</dd></div>
                  <div><dt>Yang membuatku bingung</dt><dd>{u.membingungkan}</dd></div>
                  <div><dt>Pertanyaanku</dt><dd>{u.pertanyaan}</dd></div>
                </dl>
                <p className="kecil" style={{ marginTop: 'var(--space-2)' }}>
                  Kartu Ulasan dari {u.oleh} · Versi {u.versi} · {tanggalPendek(u.tanggal)}
                </p>
              </div>
            ))}
          </section>
        )}
        <Galat pesan={galat} />
      </div>
    </main>
  )
}
