import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getNaskah, simpanVersi, ubahNaskah } from '../../api'
import type { Delta, HadiahBaru, NaskahDetail } from '../../types'
import { Galat, KepalaHalaman, Memuat, PerayaanHadiah } from '../../components/ui'
import Timer, { useTimer } from '../../components/Timer'
import { useNavPenulis } from '../../components/LayoutPenulis'
import Editor, { type DataEditor, type EditorApi } from '../../editor/Editor'
import { pilihTerbaru, useSimpanOtomatis } from '../../editor/antrean'
import { hitungKata } from '../../editor/modes'
import { KOTAK_PETA } from './NaskahBaru'
import '../../editor/editor.css'

export const MENIT_DRAF_NOL = 15

interface Awal {
  isi: Delta | null
  teks: string
  tambahan: number | null
}

export default function DrafNol() {
  const { id } = useParams()
  const nid = Number(id)
  const { segarkan } = useNavPenulis()
  const [naskah, setNaskah] = useState<NaskahDetail | null>(null)
  const [awal, setAwal] = useState<Awal | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [dimulai, setDimulai] = useState(false)
  const [kata, setKata] = useState(0)
  const [kartu, setKartu] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)
  const [hasil, setHasil] = useState<{ nomor: number; hadiah: HadiahBaru[] } | null>(null)
  const editor = useRef<EditorApi>(null)
  const tambahanDari = useRef<number | null>(null)
  const panjangSaatHabis = useRef<number | null>(null)
  const timer = useTimer(MENIT_DRAF_NOL * 60)

  const bisaMenulis = naskah?.tahap === 'draf_nol' && !hasil
  const simpan = useSimpanOtomatis(bisaMenulis ? nid : null)
  const { catat } = simpan

  useEffect(() => {
    getNaskah(nid)
      .then((n) => {
        setNaskah(n)
        setKartu(n.kartu_tebakan)
        const d = pilihTerbaru(n.draf, nid)
        const teks = d?.teks ?? ''
        tambahanDari.current = d?.menulis_tambahan_dari ?? null
        setAwal({ isi: d?.isi ?? null, teks, tambahan: tambahanDari.current })
        setKata(hitungKata(teks))
      })
      .catch((e: Error) => setGalat(e.message))
  }, [nid])

  // Timer habis: catat panjang teks; ketikan sesudahnya = "menulis tambahan".
  useEffect(() => {
    if (timer.selesai && panjangSaatHabis.current === null) {
      panjangSaatHabis.current = editor.current?.ambil().teks.length ?? 0
    }
  }, [timer.selesai])

  const ubah = useCallback(
    (d: DataEditor) => {
      if (tambahanDari.current === null && panjangSaatHabis.current !== null && d.teks.length > panjangSaatHabis.current) {
        tambahanDari.current = panjangSaatHabis.current
      }
      setKata(hitungKata(d.teks))
      catat({ isi: d.isi, teks: d.teks, sorotan: [], menulis_tambahan_dari: tambahanDari.current })
    },
    [catat],
  )

  const tutupHadiah = useCallback(() => setHasil((h) => (h ? { ...h, hadiah: [] } : h)), [])

  const mulai = () => {
    timer.mulai()
    setDimulai(true)
    setTimeout(() => editor.current?.fokus(), 0)
  }

  const simpanV1 = async () => {
    const d = editor.current?.ambil()
    if (!d || !d.teks.trim()) {
      setGalat('Tulis dulu ceritanya, ya. Satu kalimat pun boleh.')
      return
    }
    setMenyimpan(true)
    setGalat(null)
    try {
      simpan.catat({ isi: d.isi, teks: d.teks, sorotan: [], menulis_tambahan_dari: tambahanDari.current })
      const st = await simpan.simpanSekarang()
      if (st !== 'tersimpan') {
        setGalat('Belum tersambung ke server. Tulisanmu aman di perangkat ini; coba lagi sebentar lagi.')
        return
      }
      if (naskah && kartu.trim() !== naskah.kartu_tebakan) await ubahNaskah(nid, { kartu_tebakan: kartu.trim() })
      const r = await simpanVersi(nid)
      setHasil({ nomor: r.nomor, hadiah: r.hadiah_baru })
      segarkan()
    } catch (e) {
      setGalat((e as Error).message)
    } finally {
      setMenyimpan(false)
    }
  }

  if (!naskah || !awal) {
    return <main className="page"><div className="layar"><Galat pesan={galat} />{!galat && <Memuat />}</div></main>
  }

  if (hasil) {
    return (
      <main className="page">
        <div className="layar tumpuk">
          <KepalaHalaman judul="Masuk Laci Rahasia" sub={`${naskah.judul} · Versi ${hasil.nomor}: ${kata} kata`} />
          <div className="callout callout-info">
            <span className="callout-icon">🔒</span>
            <div className="callout-content">
              <p>Naskahmu tidur di laci selama 2 hari. Nanti kamu akan membacanya dengan mata baru.</p>
              <p>Sambil menunggu, coba Latihan Harian atau isi Bank Ide.</p>
            </div>
          </div>
          <div className="baris">
            <Link className="btn-besar" to={`/naskah/${nid}`}>Lihat naskah</Link>
            <Link className="btn" to="/latihan">Latihan Harian</Link>
            <Link className="btn" to="/naskah">Bank Ide</Link>
          </div>
          {hasil.hadiah.length > 0 && <PerayaanHadiah hadiah={hasil.hadiah} onTutup={tutupHadiah} />}
        </div>
      </main>
    )
  }

  if (naskah.tahap !== 'draf_nol') {
    return (
      <main className="page">
        <div className="layar tumpuk">
          <KepalaHalaman judul="Draf Nol sudah selesai" sub={naskah.judul} />
          <p>Versi 1 sudah tersimpan. Versi lama hanya bisa dibaca, tidak bisa diubah.</p>
          <Link className="btn-besar" to={`/naskah/${nid}`}>Ke halaman naskah</Link>
        </div>
      </main>
    )
  }

  const adaPeta = KOTAK_PETA.some((k) => naskah.peta[k.kunci])
  const sudahAdaTulisan = awal.teks.trim().length > 0
  const bolehSimpan = timer.selesai || (!dimulai && sudahAdaTulisan)

  return (
    <main className="page">
      <div className="layar tumpuk">
        <KepalaHalaman judul="Draf Nol" sub={naskah.judul} />
        <div className="draf-tata">
          <details className="kartu peta-samping">
            <summary>🗺️ Peta 4 Kotak</summary>
            {adaPeta ? (
              <dl>
                {KOTAK_PETA.map((k) => (
                  <div key={k.kunci}>
                    <dt>{k.label}</dt>
                    <dd>{naskah.peta[k.kunci] || '…'}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="kecil" style={{ marginTop: 8 }}>Peta belum diisi. Tidak apa-apa, tulis saja.</p>
            )}
          </details>

          <div className="tumpuk">
            <div className="baris" style={{ justifyContent: 'space-between' }}>
              <Timer sisa={timer.sisa} />
              {!timer.berjalan && !timer.selesai && (
                <button type="button" className="btn-besar" onClick={mulai}>▶ Mulai</button>
              )}
            </div>
            <p className="kecil">
              {timer.berjalan
                ? 'Tulis terus sampai timer berbunyi. Boleh jelek, dilarang menghapus. Tulis [???] kalau bingung.'
                : timer.selesai
                  ? 'Waktu habis! Kamu boleh menambah tulisan; itu dicatat sebagai "menulis tambahan".'
                  : 'Tekan Mulai, lalu tulis terus selama 15 menit. Boleh jelek, dilarang menghapus.'}
            </p>
            <Editor
              ref={editor}
              mode="draf_nol"
              isi={awal.isi}
              teks={awal.teks}
              timerBerjalan={timer.berjalan}
              nonaktif={!dimulai}
              label="Draf Nol"
              statusSimpan={simpan.label}
              onUbah={ubah}
            />
          </div>
        </div>

        {bolehSimpan && (
          <section className="kartu tumpuk" aria-labelledby="judul-selesai">
            <h2 id="judul-selesai" className="langkah-judul">{timer.selesai ? 'Selesai!' : 'Sudah selesai menulis?'}</h2>
            <p><strong style={{ fontSize: 'var(--text-3xl)' }}>{kata}</strong> kata</p>
            <div>
              <label className="label-isian" htmlFor="kartu-tebakan">Kartu Tebakan</label>
              <p className="kecil" style={{ marginBottom: 8 }}>
                Sebelum masuk laci, tebak: bagian mana yang nanti paling perlu diperbaiki?
              </p>
              <textarea id="kartu-tebakan" className="isian" rows={2} maxLength={500} spellCheck={false}
                value={kartu} onChange={(e) => setKartu(e.target.value)} />
            </div>
            <Galat pesan={galat} />
            <div>
              <button type="button" className="btn-besar" onClick={simpanV1} disabled={menyimpan}>
                {menyimpan ? 'Menyimpan…' : 'Simpan sebagai Versi 1 dan masukkan ke Laci'}
              </button>
            </div>
          </section>
        )}
        {!bolehSimpan && <Galat pesan={galat} />}
      </div>
    </main>
  )
}
