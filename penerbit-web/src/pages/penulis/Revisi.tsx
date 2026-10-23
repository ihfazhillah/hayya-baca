import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getAlat, getModul, getNaskah, getVersi, mintaStempel, simpanNaskah, simpanVersi, sorotanSistem, tandaiMisi,
} from '../../api'
import type { Alat, Delta, HadiahBaru, ModulDetail, ModulTerkunci, NaskahDetail, Sorotan } from '../../types'
import { Galat, KepalaHalaman, Memuat, PerayaanHadiah } from '../../components/ui'
import { useNavPenulis } from '../../components/LayoutPenulis'
import Editor, { type AlatStabilo, type DataEditor, type EditorApi } from '../../editor/Editor'
import { pilihTerbaru, useSimpanOtomatis } from '../../editor/antrean'
import { LAPIS, NAMA_STEMPEL, adalahLapis, alatDipelajari, type LapisRevisi } from '../../editor/naskah'
import { bawaKeVersiBaru, gantiSorotanSistem, pecahParagraf, potongSegmen } from '../../editor/sorotan'
import '../../editor/editor.css'

interface Isi {
  isi: Delta | null
  teks: string
  sorotan: Sorotan[]
}

interface Cetak {
  nomor: number
  teks: string
  sorotan: Sorotan[]
}

/** Versi terakhir untuk dicoret: sorotan dicetak sebagai pola hitam putih (cetak.css). */
function CetakVersi({ judul, data, alat, onTutup }: { judul: string; data: Cetak; alat: Alat[]; onTutup: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.print()
      } catch {
        /* jsdom / browser tanpa dialog cetak */
      }
    }, 300)
    return () => clearTimeout(t)
  }, [])
  const pola = (kode: string) => alat.find((a) => a.kode === kode)?.pola_cetak ?? 'tebal'
  const sorotan = data.sorotan.filter((s) => !s.diperbaiki && s.length > 0)
  const dipakai = alat.filter((a) => sorotan.some((s) => s.alat === a.kode))
  return (
    <main className="page">
      <div className="layar tumpuk">
        <div className="baris tidak-dicetak">
          <button type="button" className="tombol-kecil" onClick={onTutup}>← Kembali ke revisi</button>
          <button type="button" className="btn-besar" onClick={() => window.print()}>🖨️ Cetak</button>
        </div>
        <article className="lembar-cetak" aria-label={`Cetak Versi ${data.nomor}`}>
          <div className="kepala">
            <h1>{judul}</h1>
            <span>Versi {data.nomor}</span>
          </div>
          {dipakai.length > 0 && (
            <p style={{ fontSize: '11pt' }}>
              {dipakai.map((a) => (
                <span key={a.kode} style={{ marginRight: 16 }}><span className={`pola-${a.pola_cetak}`}>{a.nama}</span></span>
              ))}
            </p>
          )}
          <div className="cetak-naskah">
            {pecahParagraf(data.teks).map((p) => (
              <p key={p.index}>
                {potongSegmen(data.teks, sorotan, p.index, p.index + p.teks.length).map((seg) =>
                  seg.sorotan.length ? (
                    <span key={seg.index} className={seg.sorotan.map((s) => `pola-${pola(s.alat)}`).join(' ')}>{seg.teks}</span>
                  ) : (
                    <span key={seg.index}>{seg.teks}</span>
                  ),
                )}
              </p>
            ))}
          </div>
        </article>
      </div>
    </main>
  )
}

function keStabilo(a: Alat): AlatStabilo {
  return { kode: a.kode, nama: a.nama, emoji: a.emoji, warna: a.warna }
}

export default function Revisi() {
  const params = useParams()
  const nid = Number(params.id)
  const lapisParam = params.lapis
  const { segarkan } = useNavPenulis()
  const [n, setN] = useState<NaskahDetail | null>(null)
  const [alat, setAlat] = useState<Alat[]>([])
  const [modul, setModul] = useState<ModulDetail | ModulTerkunci | null>(null)
  const [langkah, setLangkah] = useState<'stabilo' | 'revisi' | null>(null)
  const [isi, setIsi] = useState<Isi | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [cetak, setCetak] = useState<Cetak | null>(null)
  const [hadiah, setHadiah] = useState<HadiahBaru[]>([])
  const [versiBaru, setVersiBaru] = useState<number | null>(null)
  const editor = useRef<EditorApi>(null)
  const lapis = (adalahLapis(lapisParam) ? lapisParam : 'peta') as LapisRevisi
  const info = LAPIS[lapis]
  const simpan = useSimpanOtomatis(langkah === 'revisi' ? nid : null)
  const { catat } = simpan

  useEffect(() => {
    if (!adalahLapis(lapisParam)) return
    let batal = false
    ;(async () => {
      try {
        const [naskah, daftarAlat] = await Promise.all([getNaskah(nid), getAlat()])
        if (batal) return
        setN(naskah)
        setAlat(daftarAlat.alat)
        getModul(LAPIS[lapisParam].modul).then((m) => !batal && setModul(m)).catch(() => {})
        if (naskah.tahap !== 'revisi') return
        const d = pilihTerbaru(naskah.draf, nid)
        const terakhir = naskah.versi[naskah.versi.length - 1]
        if (d && d.lapis === lapisParam && d.teks.trim()) {
          setIsi({ isi: d.isi, teks: d.teks, sorotan: d.sorotan })
          setLangkah('revisi')
        } else if (terakhir) {
          const v = await getVersi(nid, terakhir.nomor)
          if (batal) return
          setIsi({ isi: v.isi, teks: v.teks, sorotan: bawaKeVersiBaru(v.sorotan) })
          setLangkah('stabilo')
        }
      } catch (e) {
        if (!batal) setGalat((e as Error).message)
      }
    })()
    return () => {
      batal = true
    }
  }, [nid, lapisParam])

  const tutupHadiah = useCallback(() => setHadiah([]), [])
  const ubah = useCallback(
    (d: DataEditor) => catat({ isi: d.isi, teks: d.teks, sorotan: d.sorotan, lapis }),
    [catat, lapis],
  )

  if (!adalahLapis(lapisParam)) {
    return (
      <main className="page"><div className="layar tumpuk">
        <KepalaHalaman judul="Lapis tidak dikenal" />
        <Link to={`/naskah/${nid}`}>← Kembali ke naskah</Link>
      </div></main>
    )
  }

  if (!n) return <main className="page"><div className="layar"><Galat pesan={galat} />{!galat && <Memuat />}</div></main>

  if (cetak) return <CetakVersi judul={n.judul} data={cetak} alat={alat} onTutup={() => setCetak(null)} />

  const terakhir = n.versi[n.versi.length - 1]
  const nomorBaru = (terakhir?.nomor ?? 0) + 1
  const stempelAda = n.stempel.find((s) => s.lapis === lapis)?.punya ?? false
  const adaVersiLapis = n.versi.some((v) => v.lapis === lapis)
  const alatLapis = alat.filter((a) => info.alat.includes(a.kode))
  const bilah = [...alatDipelajari(alat)].sort((a, b) => Number(info.alat.includes(b.kode)) - Number(info.alat.includes(a.kode))).map(keStabilo)
  const judulLapis = modul && !modul.terkunci ? modul.judul : `Lapis ${info.nomor}: ${info.nama}`

  const tandai = async (id: number) => {
    try {
      const r = await tandaiMisi(id)
      setModul((m) => (m && !m.terkunci ? { ...m, misi: m.misi.map((x) => (x.id === id ? { ...x, status: 'selesai' } : x)) } : m))
      if (r.hadiah_baru.length) setHadiah(r.hadiah_baru)
      segarkan()
    } catch (e) {
      setGalat((e as Error).message)
    }
  }

  const siapkanCetak = async () => {
    if (!terakhir) return
    try {
      const v = await getVersi(nid, terakhir.nomor)
      const s = langkah === 'stabilo' ? (editor.current?.ambil().sorotan ?? v.sorotan) : v.sorotan
      setCetak({ nomor: v.nomor, teks: v.teks, sorotan: s })
    } catch (e) {
      setGalat((e as Error).message)
    }
  }

  const ambilSistem = async (): Promise<Sorotan[]> => (info.sistem.length ? sorotanSistem(nid, info.sistem) : [])

  const mulaiRevisi = async () => {
    const d = editor.current?.ambil()
    if (!d) return
    setSibuk(true)
    setGalat(null)
    try {
      await simpanNaskah(nid, { isi: d.isi, teks: d.teks, sorotan: d.sorotan, lapis, waktu_klien: Date.now() })
      const sistem = await ambilSistem()
      setIsi({ isi: d.isi, teks: d.teks, sorotan: gantiSorotanSistem(d.sorotan, sistem) })
      setLangkah('revisi')
    } catch (e) {
      setGalat((e as Error).message)
    } finally {
      setSibuk(false)
    }
  }

  const periksaUlang = async () => {
    const d = editor.current?.ambil()
    if (!d) return
    catat({ isi: d.isi, teks: d.teks, sorotan: d.sorotan, lapis })
    if ((await simpan.simpanSekarang()) !== 'tersimpan') return
    try {
      editor.current?.aturSorotan(gantiSorotanSistem(d.sorotan, await ambilSistem()))
    } catch (e) {
      setGalat((e as Error).message)
    }
  }

  const simpanBaru = async () => {
    const d = editor.current?.ambil()
    if (!d) return
    setSibuk(true)
    setGalat(null)
    try {
      catat({ isi: d.isi, teks: d.teks, sorotan: d.sorotan, lapis })
      const st = await simpan.simpanSekarang()
      if (st !== 'tersimpan') {
        setGalat('Belum tersambung ke server. Tulisanmu aman di perangkat ini; coba simpan lagi sebentar lagi.')
        return
      }
      const r = await simpanVersi(nid, lapis)
      setVersiBaru(r.nomor)
      if (r.hadiah_baru.length) setHadiah(r.hadiah_baru)
      setN(await getNaskah(nid))
      segarkan()
    } catch (e) {
      setGalat((e as Error).message)
    } finally {
      setSibuk(false)
    }
  }

  const minta = async () => {
    setSibuk(true)
    setGalat(null)
    try {
      const r = await mintaStempel(nid, lapis)
      setN({ ...n, stempel_diminta: r.stempel_diminta })
    } catch (e) {
      setGalat((e as Error).message)
    } finally {
      setSibuk(false)
    }
  }

  const sub = `${n.judul}${terakhir ? ` · Versi ${terakhir.nomor}` : ''}`

  return (
    <main className="page">
      <div className="layar tumpuk">
        <Link to={`/naskah/${nid}`}>← {n.judul}</Link>
        <KepalaHalaman judul={`Revisi Lapis ${info.nomor}`} sub={sub} />
        <p style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          {alatLapis.map((a) => `${a.emoji} ${a.nama}`).join(' + ') || NAMA_STEMPEL[lapis]} · {judulLapis}
        </p>

        {n.tahap !== 'revisi' ? (
          <div className="callout callout-info">
            <span className="callout-icon">🔒</span>
            <div className="callout-content">
              <p>{n.tahap === 'laci' ? 'Naskah ini masih di Laci Rahasia.' : 'Naskah ini belum bisa direvisi.'}</p>
              <p><Link to={`/naskah/${nid}`}>Ke halaman naskah</Link></p>
            </div>
          </div>
        ) : (
          <>
            <section aria-labelledby="judul-misi">
              <h2 id="judul-misi" className="langkah-judul">Misi kecil lapis ini</h2>
              {!modul && <Memuat />}
              {modul?.terkunci && <p className="kecil">{modul.pesan}</p>}
              {modul && !modul.terkunci && (
                <ul style={{ listStyle: 'none' }}>
                  {modul.misi.map((m, i) => {
                    const done = m.status === 'selesai'
                    return (
                      <li key={m.id} className={`checklist-step ${done ? 'done' : ''}`}>
                        <span className="checklist-num">{i + 1}</span>
                        <label className="checklist-label misi-cek">
                          <input type="checkbox" checked={done} disabled={done} onChange={() => tandai(m.id)} />
                          <strong>{m.judul}</strong>
                        </label>
                        <Link className="checklist-btn" to={`/modul/${modul.nomor}/misi/${m.urutan}`}>Buka</Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <div className="baris">
              <button type="button" className="tombol-kecil" onClick={siapkanCetak} disabled={!terakhir}>
                🖨️ Cetak Versi {terakhir?.nomor ?? ''} untuk dicoret
              </button>
            </div>

            {!isi && !galat && <Memuat />}
            {isi && langkah === 'stabilo' && (
              <section aria-labelledby="judul-langkah" className="tumpuk">
                <h2 id="judul-langkah" className="langkah-judul">Langkah 1: beri stabilo</h2>
                <p className="kecil">
                  Pilih kata atau kalimat di Versi {terakhir?.nomor}, lalu tekan stabilo
                  {alatLapis.length ? ` ${alatLapis.map((a) => a.nama).join(' atau ')}` : ''}. Teksnya belum bisa diubah.
                </p>
                <Editor key="stabilo" ref={editor} mode="stabilo" isi={isi.isi} teks={isi.teks} sorotan={isi.sorotan}
                  alat={bilah} warna={alat} label={`Versi ${terakhir?.nomor ?? ''} untuk distabilo`} />
                <div>
                  <button type="button" className="btn-besar" onClick={mulaiRevisi} disabled={sibuk}>
                    Selesai menyorot, mulai merevisi →
                  </button>
                </div>
              </section>
            )}
            {isi && langkah === 'revisi' && (
              <section aria-labelledby="judul-langkah" className="tumpuk">
                <h2 id="judul-langkah" className="langkah-judul">Langkah 2: perbaiki tulisanmu</h2>
                <p className="kecil">
                  Ubah bagian yang disorot. Sorotan yang sudah kamu ubah memudar dengan tanda ✓.
                  {info.sistem.length ? ' Garis putus-putus = ditandai sistem (kata kembar, kalimat lebih dari 20 kata).' : ''}
                </p>
                {info.sistem.length > 0 && (
                  <div><button type="button" className="tombol-kecil" onClick={periksaUlang}>Periksa ulang tanda sistem</button></div>
                )}
                <Editor key="revisi" ref={editor} mode="revisi" isi={isi.isi} teks={isi.teks} sorotan={isi.sorotan}
                  alat={bilah} warna={alat} label={`Revisi Lapis ${info.nomor}`} statusSimpan={simpan.label} onUbah={ubah} />
                <p className="kecil">
                  Pemeriksa ejaan dan koreksi otomatis tablet dimatikan. Menempel teks dari luar tidak bisa: “Tulisanmu harus kamu ketik sendiri, ya.”
                </p>
                {versiBaru && <p className="lencana selesai" role="status">Versi {versiBaru} tersimpan ✓</p>}
                <div className="baris">
                  <button type="button" className="btn-besar" onClick={simpanBaru} disabled={sibuk}>
                    Simpan sebagai Versi {nomorBaru}
                  </button>
                  {stempelAda ? (
                    <span className="lencana selesai">Stempel {NAMA_STEMPEL[lapis]} sudah ada ✓</span>
                  ) : n.stempel_diminta === lapis ? (
                    <span className="lencana aktif">Stempel sudah diminta, tunggu Ayah atau Ummah</span>
                  ) : (
                    <button type="button" className="btn-besar sekunder" onClick={minta} disabled={sibuk || !adaVersiLapis}
                      title={adaVersiLapis ? undefined : 'Simpan dulu versi untuk lapis ini'}>
                      Minta stempel ke Ayah atau Ummah
                    </button>
                  )}
                </div>
              </section>
            )}
          </>
        )}
        <Galat pesan={galat} />
        {hadiah.length > 0 && <PerayaanHadiah hadiah={hadiah} onTutup={tutupHadiah} />}
      </div>
    </main>
  )
}
