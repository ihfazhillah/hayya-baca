import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAlat, getBeranda, getModul } from '../../api'
import type { Alat, Beranda as DataBeranda, Tingkat } from '../../types'
import { EMOJI_TINGKAT, Galat, Memuat, warnaCss } from '../../components/ui'
import '../../styles/penulis-halaman.css'

const NAMA_LEVEL: Record<number, string> = { 1: 'Detektif Kalimat', 2: 'Penulis Cilik', 3: 'Editor' }
const TINGKAT: Tingkat[] = ['perunggu', 'perak', 'emas']
const NAMA_TINGKAT: Record<Tingkat, string> = { perunggu: 'Perunggu', perak: 'Perak', emas: 'Emas' }

/** "A", "A dan B", "A, B, dan C". */
function daftarKata(x: string[]): string {
  if (x.length <= 2) return x.join(' dan ')
  return `${x.slice(0, -1).join(', ')}, dan ${x[x.length - 1]}`
}

export default function Beranda() {
  const [data, setData] = useState<DataBeranda | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  // Status buka/kunci tiap alat (Kartu Alat ringkas). Tambahan saja: kalau gagal, Beranda tetap tampil.
  const [statusAlat, setStatusAlat] = useState<Alat[] | null>(null)

  useEffect(() => {
    getBeranda().then(setData).catch((e: Error) => setGalat(e.message))
    getAlat().then((r) => setStatusAlat(r.alat)).catch(() => setStatusAlat(null))
  }, [])

  return (
    <main className="page ph-halaman">
      <h1 className="sr-only">Beranda</h1>
      <Galat pesan={galat} />
      {!data && !galat && <Memuat />}
      {data && <IsiBeranda data={data} statusAlat={statusAlat} />}
    </main>
  )
}

function IsiBeranda({ data, statusAlat }: { data: DataBeranda; statusAlat: Alat[] | null }) {
  const l = data.lanjutkan
  const navigate = useNavigate()
  const [sibuk, setSibuk] = useState<number | null>(null)

  /** Catatan "coba lagi" hanya membawa id misi; cari urutannya dari modul. */
  async function kerjakanLagi(misi: number, modul: number) {
    setSibuk(misi)
    try {
      const m = await getModul(modul)
      const x = !m.terkunci ? m.misi.find((y) => y.id === misi) : undefined
      navigate(x ? `/modul/${modul}/misi/${x.urutan}` : `/modul/${modul}`)
    } catch {
      navigate(`/modul/${modul}`)
    }
  }

  const level = new Map<number, DataBeranda['peta']>()
  for (const p of data.peta) level.set(p.level, [...(level.get(p.level) ?? []), p])

  const modulAktif = data.peta.find((p) => p.status === 'aktif')?.nomor
  const adaKabar = data.kabar.length > 0 || data.coba_lagi.length > 0 || data.menunggu > 0

  return (
    <>
      <header>
        <p className="ph-sapa">Assalamu’alaikum, {data.nama}!</p>
        <p className="ph-sub">
          {l
            ? l.pertama_kali
              ? 'Hari ini petualanganmu dimulai.'
              : `Hari ini kita lanjut Modul ${l.modul.nomor}.`
            : 'Semua modul sudah kamu selesaikan. Hebat!'}
        </p>
      </header>

      {l ? (
        <section className="kartu-lanjutkan ph-lanjutkan" aria-label="Lanjutkan">
          <div className="ph-lanjutkan-isi">
            <span className="ph-label-kecil">Lanjutkan</span>
            <h2>
              {l.pertama_kali
                ? `Mulai petualangan: Modul ${l.modul.nomor}, ${l.modul.judul}`
                : `${l.modul.emoji} Modul ${l.modul.nomor} · ${l.modul.judul}`}
            </h2>
            <p>
              {l.misi ? `Misi ${l.misi.urutan}: ${l.misi.judul} · ` : ''}sekitar {l.perkiraan_menit} menit
            </p>
          </div>
          <Link className="btn-besar ph-tautan-tombol"
            to={l.misi ? `/modul/${l.modul.nomor}/misi/${l.misi.urutan}` : `/modul/${l.modul.nomor}`}>
            Mulai
          </Link>
        </section>
      ) : (
        <section className="kartu-lanjutkan ph-lanjutkan" aria-label="Lanjutkan">
          <div className="ph-lanjutkan-isi">
            <h2>Saatnya menulis cerita sendiri</h2>
            <p>Pakai alat-alatmu di Ruang Penulis.</p>
          </div>
          <Link className="btn-besar ph-tautan-tombol" to="/naskah">Ke Ruang Penulis</Link>
        </section>
      )}

      {data.pemanasan.ada && (
        <section className="kartu ph-antara" aria-label="Pemanasan hari ini">
          <div>
            <h2 className="ph-judul-bagian" style={{ fontSize: 'var(--text-lg)', marginBottom: 0 }}>Pemanasan hari ini</h2>
            <p className="kecil">3 kalimat dari alat lama: {daftarKata(data.pemanasan.alat)}</p>
          </div>
          <Link className="btn-besar sekunder ph-tautan-tombol" to="/latihan">Mulai pemanasan</Link>
        </section>
      )}

      {adaKabar && (
        <section className="kartu" aria-labelledby="judul-kabar">
          <h2 id="judul-kabar" className="ph-judul-bagian" style={{ fontSize: 'var(--text-lg)' }}>Kabar dari Ayah dan Ummah</h2>
          {data.coba_lagi.map((c) => (
            <div key={`c${c.misi}`} className="ph-kabar">
              <span className="ph-kabar-ikon ungu" aria-hidden="true">💪</span>
              <div style={{ flex: 1 }}>
                <p><strong>Ayo coba sekali lagi: {c.judul}</strong> (Modul {c.modul})</p>
                {c.catatan && <p className="ph-kutip">“{c.catatan}”</p>}
                <button type="button" className="btn btn-ghost" onClick={() => kerjakanLagi(c.misi, c.modul)}
                  disabled={sibuk === c.misi}>
                  Kerjakan lagi
                </button>
              </div>
            </div>
          ))}
          {data.kabar.map((k, i) => (
            <div key={`k${i}`} className="ph-kabar">
              <span className="ph-kabar-ikon" aria-hidden="true">{k.emoji || '🔖'}</span>
              <div>
                <p><strong>{k.oleh ? `${k.oleh} memberi ${k.teks}` : k.teks}</strong></p>
                {k.catatan && <p className="ph-kutip">“{k.catatan}”</p>}
              </div>
            </div>
          ))}
          {data.menunggu > 0 && (
            <div className="ph-kabar">
              <span className="ph-kabar-ikon abu" aria-hidden="true">📄</span>
              <div>
                <p><strong>{data.menunggu} lembar menunggu diperiksa</strong></p>
                <p className="ph-kutip">Kamu tetap boleh lanjut.</p>
              </div>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="judul-peta">
        <h2 id="judul-peta" className="ph-judul-bagian">Peta perjalanan</h2>
        <div className="kartu">
          {[...level.entries()].sort(([a], [b]) => a - b).map(([lv, modul]) => (
            <div key={lv} className="ph-peta-baris">
              <span className="ph-peta-nama">Level {lv}{NAMA_LEVEL[lv] ? ` · ${NAMA_LEVEL[lv]}` : ''}</span>
              <ul className="ph-titik-daftar">
                {modul.map((m) => {
                  const label = `Modul ${m.nomor}, ${m.judul}, ${m.status === 'selesai' ? 'selesai' : m.status === 'aktif' ? 'sedang dikerjakan' : 'terkunci'}`
                  return (
                    <li key={m.nomor}>
                      {m.status === 'terkunci' ? (
                        <span className="ph-titik terkunci" aria-label={label} title={label}>{m.nomor}</span>
                      ) : (
                        <Link className={`ph-titik ${m.status}`} to={`/modul/${m.nomor}`} aria-label={label} title={label}>
                          {m.nomor}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="judul-alat">
        <div className="ph-antara" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 id="judul-alat" className="ph-judul-bagian" style={{ marginBottom: 0 }}>Kotak Alat Editor</h2>
          <Link to="/alat" style={{ fontWeight: 600 }}>Lihat semua</Link>
        </div>
        <ul className="ph-alat-ringkas">
          {data.alat.map((a) => {
            const punya = TINGKAT.filter((t) => a.stiker.includes(t))
            const st = statusAlat?.find((x) => x.kode === a.kode)
            const terkunci = st ? !st.terbuka : false
            const dipelajari = !!st && st.terbuka && st.modul_belajar === modulAktif
            return (
              <li key={a.kode}>
                <Link to="/alat" className={terkunci ? 'samar' : dipelajari ? 'sekarang' : undefined}
                  style={{ ['--warna-alat' as string]: warnaCss(a.warna) }}>
                  <span className="emoji" aria-hidden="true">{a.emoji}</span>
                  <span className="nama">{a.nama}</span>
                  {terkunci ? (
                    <span className="ph-alat-status">terbuka di Modul {st!.modul_belajar}</span>
                  ) : dipelajari && !punya.length ? (
                    <span className="ph-alat-status aktif">sedang dipelajari</span>
                  ) : null}
                  {!terkunci && <span className="ph-stiker-baris"
                    aria-label={punya.length ? `Stiker: ${punya.map((t) => NAMA_TINGKAT[t]).join(', ')}` : 'Belum ada stiker'}>
                    {TINGKAT.map((t) => (
                      <span key={t} className={a.stiker.includes(t) ? undefined : 'ph-samar'} aria-hidden="true">
                        {EMOJI_TINGKAT[t]}
                      </span>
                    ))}
                  </span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="kartu ph-antara" aria-label="Pangkat dan poin">
        <div>
          <span className="kecil">Pangkat</span>
          <p className="ph-pangkat">{data.pangkat ?? 'Pangkat pertamamu sedang menunggu'}</p>
          <Link to="/jejak" className="kecil">Lihat Jejak Keterampilan</Link>
        </div>
        <div className="baris">
          <div style={{ textAlign: 'right' }}>
            <span className="ph-poin-besar">{data.poin}</span>
            <span className="kecil" style={{ display: 'block' }}>poin</span>
          </div>
          <Link className="btn-besar sekunder ph-tautan-tombol" to="/tukar">Tukar poin</Link>
        </div>
      </section>
    </>
  )
}
