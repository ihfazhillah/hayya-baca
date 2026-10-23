import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAlat, getNaskah, getVersi, simpanFavorit } from '../../api'
import type { Alat, NaskahDetail, Sorotan, VersiDetail } from '../../types'
import { Galat, KepalaHalaman, Memuat } from '../../components/ui'
import { cssWarna } from '../../editor/stabilo'
import { warnaCss } from '../../components/ui'
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

/** Alat yang paling banyak menyorot paragraf ini (untuk warna garis pinggir). */
function alatDominan(daftar: Sorotan[], awal: number, akhir: number): string | null {
  const n = new Map<string, number>()
  for (const s of daftar) {
    if (s.length > 0 && s.index < akhir && s.index + s.length > awal) n.set(s.alat, (n.get(s.alat) ?? 0) + 1)
  }
  let terbaik: string | null = null
  for (const [k, j] of n) if (!terbaik || j > (n.get(terbaik) ?? 0)) terbaik = k
  return terbaik
}

function Kolom({ v, judul, berubah, favorit, onFavorit, alat, utama = false }: {
  v: VersiDetail
  judul: string
  berubah: Set<number>
  favorit?: string
  onFavorit?: (p: Paragraf) => void
  alat: Alat[]
  utama?: boolean
}) {
  return (
    <section className={`kolom-versi${utama ? ' utama' : ''}`} aria-label={judul}>
      <h2 className="kolom-judul">{judul} · {hitungKata(v.teks)} kata</h2>
      {pecahParagraf(v.teks).map((p) => {
        const kode = berubah.has(p.index) ? alatDominan(v.sorotan, p.index, p.index + p.teks.length) : null
        const warna = kode ? alat.find((a) => a.kode === kode)?.warna : undefined
        return (
        <div key={p.index} className={`paragraf${berubah.has(p.index) ? ' berubah' : ''}${favorit === p.teks ? ' favorit' : ''}`}
          data-berubah={berubah.has(p.index) || undefined}
          style={warna && favorit !== p.teks ? { borderLeftColor: warnaCss(warna) } : undefined}>
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
              <button type="button" className="tombol-kecil tombol-favorit" onClick={() => onFavorit(p)}>⭐ Jadikan paragraf favorit</button>
            ) : null
          )}
        </div>
        )
      })}
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
    <div className="pilih-versi">
      <label htmlFor={idEl}>{label}</label>
      <select id={idEl} className="isian" value={nilai ?? ''} onChange={(e) => atur(Number(e.target.value))}>
        {n.versi.map((v, i) => (
          <option key={v.nomor} value={v.nomor}>
            Versi {v.nomor} · {i === n.versi.length - 1 && i > 0 ? 'terbaru' : namaLapis(v.lapis)}
          </option>
        ))}
      </select>
    </div>
  )

  const hB = vb ? hitungSorotan(vb.sorotan) : null
  const selisihKata = va && vb ? hitungKata(vb.teks) - hitungKata(va.teks) : 0
  const berubahB = va && vb ? berubahTerhadap(vb, va) : new Set<number>()

  return (
    <main className="page">
      <div className="layar layar-lebar tumpuk">
        <Link to={`/naskah/${nid}`} className="tautan-kembali">← {n.judul}</Link>
        <div className="banding-kepala">
          <KepalaHalaman judul="Sebelum dan Sesudah" sub="Lihat sendiri seberapa jauh ceritamu berkembang." />
          {n.versi.length >= 2 && (
            <div className="baris">
              {pilihVersi(kiri, setKiri, 'Kiri', 'versi-kiri')}
              {pilihVersi(kanan, setKanan, 'Kanan', 'versi-kanan')}
            </div>
          )}
        </div>
        {alat.length > 0 && <style>{cssWarna(alat)}</style>}
        {n.versi.length < 2 ? (
          <p>Baru ada {n.versi.length} versi. Setelah revisi pertama, kamu bisa membandingkannya di sini.</p>
        ) : (
          <>
            {(!va || !vb) && !galat && <Memuat />}
            {va && vb && (
              <>
                <div className="banding-grid">
                  <Kolom v={va} judul={`Versi ${va.nomor}`} berubah={berubahTerhadap(va, vb)} alat={alat} />
                  <div className="vs-badge" aria-hidden="true">VS</div>
                  <Kolom v={vb} judul={`Versi ${vb.nomor}`} berubah={berubahB} favorit={favorit}
                    onFavorit={jadikanFavorit} alat={alat} utama />
                </div>
                <section className="banding-angka" aria-label="Perubahanmu">
                  {hB && hB.total > 0 && (
                    <div><strong>{hB.diperbaiki} dari {hB.total}</strong><span>sorotan sudah diperbaiki ✓</span></div>
                  )}
                  <div><strong>{berubahB.size}</strong><span>paragraf berubah</span></div>
                  <div>
                    <strong>{selisihKata > 0 ? `+${selisihKata}` : selisihKata}</strong>
                    <span>kata dibanding Versi {va.nomor}</span>
                  </div>
                </section>
                <p className="kecil">Garis di pinggir menandai paragraf yang berubah. Warnanya mengikuti alat yang paling banyak dipakai di paragraf itu.</p>
              </>
            )}
          </>
        )}
        <Galat pesan={galat} />
      </div>
    </main>
  )
}
