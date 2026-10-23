import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getNaskah, simpanVersi, ubahNaskah } from '../../api'
import type { Delta, HadiahBaru, NaskahDetail } from '../../types'
import { Galat, KepalaHalaman, Memuat, PerayaanHadiah } from '../../components/ui'
import { formatMenit } from '../../components/Timer'
import { useNavPenulis } from '../../components/LayoutPenulis'
import Editor, { type DataEditor, type EditorApi } from '../../editor/Editor'
import { pilihTerbaru, useSimpanOtomatis } from '../../editor/antrean'
import { hapusTimer, useTimerDraf } from '../../editor/timerDraf'
import { hitungKata } from '../../editor/modes'
import { KOTAK_PETA } from './NaskahBaru'
import '../../editor/editor.css'

export const MENIT_DRAF_NOL = 15

/** Timer cincin seperti mock-up: angka di tengah, busur berkurang. */
export function TimerCincin({ sisa, total }: { sisa: number; total: number }) {
  const r = 36
  const keliling = 2 * Math.PI * r
  const bagian = total > 0 ? sisa / total : 0
  return (
    <div className="timer-cincin">
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r={r} fill="none" className="jalur" strokeWidth="8" />
        <circle cx="42" cy="42" r={r} fill="none" className="busur" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={keliling} strokeDashoffset={keliling * (1 - bagian)} transform="rotate(-90 42 42)" />
      </svg>
      <span role="timer" aria-live="off" aria-label={`Sisa waktu ${formatMenit(sisa)}`}>{formatMenit(sisa)}</span>
    </div>
  )
}

/** Peta terlipat: terbuka di layar lebar (samping), tertutup di tablet (di atas). */
function lebar(): boolean {
  try {
    return window.matchMedia('(min-width: 1024px)').matches
  } catch {
    return true
  }
}

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
  const [kata, setKata] = useState(0)
  const [kartu, setKartu] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)
  const [hasil, setHasil] = useState<{ nomor: number; hadiah: HadiahBaru[] } | null>(null)
  const editor = useRef<EditorApi>(null)
  const tambahanDari = useRef<number | null>(null)
  const panjangSaatHabis = useRef<number | null>(null)
  const timer = useTimerDraf(nid, MENIT_DRAF_NOL * 60)
  const dimulai = timer.dimulai
  const [petaTerbuka] = useState(lebar)

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
      hapusTimer(nid)
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
            <Link className="btn-besar tautan-tombol" to={`/naskah/${nid}`}>Lihat naskah</Link>
            <Link className="btn-besar sekunder tautan-tombol" to="/latihan">Latihan Harian</Link>
            <Link className="btn-besar sekunder tautan-tombol" to="/naskah">Bank Ide</Link>
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
          <Link className="btn-besar tautan-tombol" to={`/naskah/${nid}`}>Ke halaman naskah</Link>
        </div>
      </main>
    )
  }

  const adaPeta = KOTAK_PETA.some((k) => naskah.peta[k.kunci])
  const sudahAdaTulisan = awal.teks.trim().length > 0
  const bolehSimpan = timer.selesai || (!dimulai && sudahAdaTulisan)
  const catatan = timer.berjalan
    ? 'Boleh jelek, dilarang menghapus. Tulis [???] kalau bingung.'
    : timer.selesai
      ? 'Waktu habis! Tulisan sesudah ini dicatat sebagai "menulis tambahan".'
      : 'Tekan Mulai, lalu tulis terus selama 15 menit.'

  return (
    <main className="page">
      <div className="layar layar-lebar tumpuk">
        <div className="draf-tata">
          <details className="kartu peta-samping" open={petaTerbuka}>
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

          <section className="draf-utama" aria-labelledby="judul-draf">
            <div className="draf-kepala">
              <div className="draf-kepala-kiri">
                <TimerCincin sisa={timer.sisa} total={timer.total} />
                <div>
                  <h1 id="judul-draf" className="draf-judul">Draf Nol</h1>
                  <p className="kecil">{naskah.judul}</p>
                </div>
              </div>
              {!dimulai ? (
                <button type="button" className="btn-besar" onClick={mulai}>▶ Mulai</button>
              ) : (
                <p className={`catatan-pil${timer.berjalan ? ' jalan' : ''}`} role="note">{catatan}</p>
              )}
            </div>
            {!dimulai && <p className="catatan-pil" role="note">{catatan} Boleh jelek, dilarang menghapus.</p>}
            <Editor
              ref={editor}
              mode="draf_nol"
              isi={awal.isi}
              teks={awal.teks}
              timerBerjalan={timer.berjalan}
              nonaktif={!dimulai}
              label="Draf Nol"
              placeholder={dimulai ? 'Tulis ceritamu di sini…' : 'Tekan Mulai dulu, lalu tulis di sini.'}
              statusSimpan={simpan.label}
              statusKode={simpan.status}
              onUbah={ubah}
            />

            {bolehSimpan ? (
              <section className="kartu tumpuk" aria-labelledby="judul-selesai">
                <h2 id="judul-selesai" className="langkah-judul">{timer.selesai ? 'Selesai!' : 'Sudah selesai menulis?'}</h2>
                <p><strong className="angka-kata">{kata}</strong> kata</p>
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
            ) : (
              <div className="kartu-tunggu">
                <p className="kecil">Saat timer selesai, tombol ini aktif:</p>
                <button type="button" className="btn-besar" disabled>Simpan sebagai Versi 1 dan masukkan ke Laci</button>
              </div>
            )}
            {!bolehSimpan && <Galat pesan={galat} />}
          </section>
        </div>
      </div>
    </main>
  )
}
