import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAlat, getNaskah, getVersi, simpanFavorit } from '../../api'
import type { Alat, NaskahDetail, Sorotan, VersiDetail } from '../../types'
import { Galat, KepalaHalaman, Memuat } from '../../components/ui'
import { cssWarna } from '../../editor/stabilo'
import { hitungSorotan, pecahParagraf, potongSegmen, type Paragraf } from '../../editor/sorotan'
import { hitungKata } from '../../editor/modes'
import { namaLapis } from '../../editor/naskah'
import '../../editor/editor.css'

function kataSet(t: string) {
  return new Set(t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean))
}

/** Paragraf versi lama yang paling mirip dengan paragraf baru (untuk "sebelum"). */
export function paragrafPadanan(baru: string, lama: Paragraf[]): string {
  const b = kataSet(baru)
  let terbaik = ''
  let skor = -1
  for (const p of lama) {
    const a = kataSet(p.teks)
    const sama = [...a].filter((x) => b.has(x)).length
    const s = sama / Math.max(1, a.size + b.size - sama)
    if (s > skor) {
      skor = s
      terbaik = p.teks
    }
  }
  return terbaik
}

function kelasSorotan(s: Sorotan): string {
  const k = s.alat.replace(/[^a-z0-9_-]/gi, '')
  return `${s.sumber === 'anak' ? `sorot-${k}` : `sorot-sistem-${k}`}${s.diperbaiki ? ' sorot-ok' : ''}`
}

function Kolom({ v, judul, berubah, favorit, onFavorit }: {
  v: VersiDetail
  judul: string
  berubah: Set<number>
  favorit?: string
  onFavorit?: (p: Paragraf) => void
}) {
  return (
    <section className="kolom-versi" aria-label={judul}>
      <h2 className="kecil" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 12 }}>
        {judul} · {hitungKata(v.teks)} kata
      </h2>
      {pecahParagraf(v.teks).map((p) => (
        <div key={p.index} className={`paragraf${berubah.has(p.index) ? ' berubah' : ''}${favorit === p.teks ? ' favorit' : ''}`}
          data-berubah={berubah.has(p.index) || undefined}>
          <p>
            {potongSegmen(v.teks, v.sorotan, p.index, p.index + p.teks.length).map((seg) =>
              seg.sorotan.length ? (
                <span key={seg.index} className={seg.sorotan.map(kelasSorotan).join(' ')}>{seg.teks}</span>
              ) : (
                <span key={seg.index}>{seg.teks}</span>
              ),
            )}
          </p>
          {onFavorit && (
            favorit === p.teks ? (
              <p className="kecil">⭐ Paragraf favoritmu</p>
            ) : berubah.has(p.index) ? (
              <button type="button" className="tombol-kecil" onClick={() => onFavorit(p)}>⭐ Jadikan paragraf favorit</button>
            ) : null
          )}
        </div>
      ))}
    </section>
  )
}

function berubahTerhadap(dari: VersiDetail, lawan: VersiDetail): Set<number> {
  const ada = new Set(pecahParagraf(lawan.teks).map((p) => p.teks.trim()))
  return new Set(pecahParagraf(dari.teks).filter((p) => !ada.has(p.teks.trim())).map((p) => p.index))
}

export default function Bandingkan() {
  const { id } = useParams()
  const nid = Number(id)
  const [n, setN] = useState<NaskahDetail | null>(null)
  const [alat, setAlat] = useState<Alat[]>([])
  const [kiri, setKiri] = useState<number | null>(null)
  const [kanan, setKanan] = useState<number | null>(null)
  const [va, setVa] = useState<VersiDetail | null>(null)
  const [vb, setVb] = useState<VersiDetail | null>(null)
  const [favorit, setFavorit] = useState<string | undefined>()
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    getNaskah(nid)
      .then((d) => {
        setN(d)
        setFavorit(d.paragraf_favorit.sesudah)
        if (d.versi.length) {
          setKiri(d.versi[0].nomor)
          setKanan(d.versi[d.versi.length - 1].nomor)
        }
      })
      .catch((e: Error) => setGalat(e.message))
    getAlat().then((r) => setAlat(r.alat)).catch(() => {})
  }, [nid])

  useEffect(() => {
    if (kiri === null) return
    getVersi(nid, kiri).then(setVa).catch((e: Error) => setGalat(e.message))
  }, [nid, kiri])
  useEffect(() => {
    if (kanan === null) return
    getVersi(nid, kanan).then(setVb).catch((e: Error) => setGalat(e.message))
  }, [nid, kanan])

  const jadikanFavorit = async (p: Paragraf) => {
    if (!va) return
    try {
      const r = await simpanFavorit(nid, paragrafPadanan(p.teks, pecahParagraf(va.teks)), p.teks)
      setFavorit(r.sesudah)
    } catch (e) {
      setGalat((e as Error).message)
    }
  }

  if (!n) return <main className="page"><div className="layar"><Galat pesan={galat} />{!galat && <Memuat />}</div></main>

  const pilihVersi = (nilai: number | null, atur: (x: number) => void, label: string, idEl: string) => (
    <div>
      <label className="label-isian" htmlFor={idEl}>{label}</label>
      <select id={idEl} className="isian" value={nilai ?? ''} onChange={(e) => atur(Number(e.target.value))}>
        {n.versi.map((v) => <option key={v.nomor} value={v.nomor}>Versi {v.nomor} · {namaLapis(v.lapis)}</option>)}
      </select>
    </div>
  )

  const hA = va ? hitungSorotan(va.sorotan) : null
  const hB = vb ? hitungSorotan(vb.sorotan) : null
  const selisihKata = va && vb ? hitungKata(vb.teks) - hitungKata(va.teks) : 0

  return (
    <main className="page">
      <div className="layar tumpuk">
        <Link to={`/naskah/${nid}`}>← {n.judul}</Link>
        <KepalaHalaman judul="Sebelum dan Sesudah" sub="Lihat sendiri seberapa jauh ceritamu berkembang." />
        {alat.length > 0 && <style>{cssWarna(alat)}</style>}
        {n.versi.length < 2 ? (
          <p>Baru ada {n.versi.length} versi. Setelah revisi pertama, kamu bisa membandingkannya di sini.</p>
        ) : (
          <>
            <div className="baris">
              {pilihVersi(kiri, setKiri, 'Kiri', 'versi-kiri')}
              {pilihVersi(kanan, setKanan, 'Kanan', 'versi-kanan')}
            </div>
            {(!va || !vb) && !galat && <Memuat />}
            {va && vb && (
              <>
                <div className="banding-grid">
                  <Kolom v={va} judul={`Versi ${va.nomor}`} berubah={berubahTerhadap(va, vb)} />
                  <div className="vs-badge" aria-hidden="true">VS</div>
                  <Kolom v={vb} judul={`Versi ${vb.nomor}`} berubah={berubahTerhadap(vb, va)} favorit={favorit}
                    onFavorit={jadikanFavorit} />
                </div>
                <ul className="kecil tumpuk" style={{ listStyle: 'none' }}>
                  {hA && hA.total > 0 && <li>Di Versi {va.nomor} ada {hA.total} sorotan.</li>}
                  {hB && hB.total > 0 && <li>Di Versi {vb.nomor}: {hB.diperbaiki} dari {hB.total} sorotan sudah diperbaiki ✓</li>}
                  {selisihKata !== 0 && <li>{selisihKata > 0 ? `+${selisihKata}` : selisihKata} kata dibanding Versi {va.nomor}</li>}
                  <li>Garis di pinggir menandai paragraf yang berubah.</li>
                </ul>
              </>
            )}
          </>
        )}
        <Galat pesan={galat} />
      </div>
    </main>
  )
}
