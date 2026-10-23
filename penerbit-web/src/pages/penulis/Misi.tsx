import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  bantuanGunting, berhentiMisi, cetakMisi, getMisi, getModul, kirimPerasaan, klikMisi, periksaGunting, periksaKembar, petunjukMisi, tandaiMisi,
} from '../../api'
import type {
  BantuanPerasaan, HadiahBaru, Jawaban, MisiDetail, ModulDetail, ModulTerkunci, PercobaanPerasaan,
} from '../../types'
import { Galat, Memuat, PerayaanHadiah } from '../../components/ui'
import { useNavPenulis } from '../../components/LayoutPenulis'
import TeksKlik, { type AwalKlik } from '../../components/TeksKlik'
import Gunting from '../../components/Gunting'
import DetektorKembar from '../../components/DetektorKembar'
import Perekam from '../../components/Perekam'
import TanyaAyah from '../../components/TanyaAyah'
import ContohOren from '../../components/ContohOren'
import PilihPerasaan from '../../components/PilihPerasaan'
import Dengar from '../../components/Dengar'
import '../../styles/penulis-halaman.css'

type Muat = { kunci: string; modul: ModulDetail | ModulTerkunci; misi: MisiDetail | null }

export default function Misi() {
  const params = useParams()
  const nomor = Number(params.nomor)
  const urutan = Number(params.urutan)
  const kunci = `${nomor}/${urutan}`
  const [data, setData] = useState<Muat | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    let aktif = true
    setGalat(null)
    ;(async () => {
      const modul = await getModul(nomor)
      if (modul.terkunci) return { kunci, modul, misi: null }
      const r = modul.misi.find((x) => x.urutan === urutan)
      if (!r) throw new Error('Misi ini tidak ada. Kembali ke modul, ya.')
      return { kunci, modul, misi: await getMisi(r.id) }
    })()
      .then((d) => aktif && setData(d))
      .catch((e: Error) => aktif && setGalat(e.message))
    return () => { aktif = false }
  }, [nomor, urutan, kunci])

  const d = data?.kunci === kunci ? data : null
  return (
    <main className="page ph-halaman">
      <Galat pesan={galat} />
      {galat && <Link to={`/modul/${nomor}`}>Kembali ke modul</Link>}
      {!d && !galat && <Memuat />}
      {d && d.modul.terkunci && (
        <>
          <div className="callout callout-info" role="status">
            <span className="callout-icon" aria-hidden="true">🔒</span>
            <div className="callout-content"><p>Selesaikan Modul {d.modul.modul_sebelumnya} dulu, ya.</p></div>
          </div>
          <Link className="btn-besar ph-tautan-tombol" to={`/modul/${d.modul.modul_sebelumnya}`}>
            Ke Modul {d.modul.modul_sebelumnya}
          </Link>
        </>
      )}
      {d && !d.modul.terkunci && d.misi && <IsiMisi key={d.misi.id} modul={d.modul} misi={d.misi} />}
    </main>
  )
}

function IsiMisi({ modul, misi }: { modul: ModulDetail; misi: MisiDetail }) {
  const { segarkan } = useNavPenulis()
  const [selesai, setSelesai] = useState<Jawaban | null>(misi.status === 'selesai' ? misi : null)
  const [hadiah, setHadiah] = useState<HadiahBaru[]>([])
  const tutupHadiah = useCallback(() => setHadiah([]), [])

  const selesaikan = useCallback((h: Jawaban & { hadiah_baru?: HadiahBaru[] }) => {
    setSelesai(h)
    if (h.hadiah_baru?.length) setHadiah(h.hadiah_baru)
    segarkan()
  }, [segarkan])

  const alat = modul.alat
  const kepala = alat ? `${alat.emoji} ${alat.nama}` : `${modul.emoji} ${modul.judul}`
  const urutanBerikut = misi.berikutnya !== null
    ? modul.misi.find((x) => x.id === misi.berikutnya)?.urutan
    : undefined
  const [ulang, setUlang] = useState(false)
  // "Kerjakan lagi" langsung ke pekerjaan; "Lihat contoh Oren lagi" mulai dari contoh.
  const [lewatiContoh, setLewatiContoh] = useState(false)
  const dariAwal = misi.status === 'selesai' && !ulang

  return (
    <>
      <div className="ph-antara ph-deret-atas">
        <Link to={`/modul/${modul.nomor}`}>← Kembali ke Modul {modul.nomor}</Link>
        <nav className="ph-deret-misi" aria-label="Misi di modul ini">
          {modul.misi.map((x) => {
            const status = x.status === 'selesai' ? ', selesai' : x.status === 'menunggu' ? ', menunggu diperiksa' : ''
            return (
              <Link key={x.id} to={`/modul/${modul.nomor}/misi/${x.urutan}`}
                aria-label={`Misi ${x.urutan}, ${x.judul}${status}`} title={x.judul}
                aria-current={x.urutan === misi.urutan ? 'step' : undefined}
                className={`ph-deret-titik${x.status === 'selesai' ? ' selesai' : ''}${x.urutan === misi.urutan ? ' di-sini' : ''}`}>
                {x.status === 'selesai' ? '✓' : x.urutan}
              </Link>
            )
          })}
        </nav>
      </div>
      <p className="kecil">Misi {misi.urutan} dari {misi.jumlah_misi}. Ketuk angka di atas untuk pindah misi.</p>

      <header>
        <p className="kecil" style={{ fontWeight: 600 }}>{kepala} · {misi.tahap_label}</p>
        <h1 className="page-title">{misi.judul}</h1>
        {misi.petunjuk && <p className="ph-sub">{misi.petunjuk}</p>}
        {misi.tahap === 'bonus' && <p className="lencana">⭐ Bonus, boleh dilewati</p>}
      </header>

      <Panduan misi={misi} />

      {dariAwal ? (
        <JawabanTerbuka misi={misi} onUlang={(contoh) => { setSelesai(null); setUlang(true); setLewatiContoh(!contoh) }} />
      ) : (
        <AreaKerja misi={misi} selesai={!!selesai} onSelesai={selesaikan} onSegarkan={segarkan} urutanBerikut={urutanBerikut} nomor={modul.nomor} lewatiContoh={lewatiContoh} />
      )}

      <TanyaAyah misi={misi.id} />

      {selesai && (
        <section className="ph-selesai" aria-live="polite">
          <h2>Misi {misi.urutan} selesai!</h2>
          {urutanBerikut !== undefined && <p>Lanjut ke Misi {urutanBerikut}?</p>}
          <div className="baris" style={{ marginTop: 'var(--space-4)' }}>
            {urutanBerikut !== undefined && (
              <Link className="btn-besar ph-tautan-tombol" to={`/modul/${modul.nomor}/misi/${urutanBerikut}`}>Misi berikutnya</Link>
            )}
            <Link className={`btn-besar ph-tautan-tombol${urutanBerikut !== undefined ? ' sekunder' : ''}`} to={`/modul/${modul.nomor}`}>
              Kembali ke modul
            </Link>
          </div>
        </section>
      )}

      {hadiah.length > 0 && <PerayaanHadiah hadiah={hadiah} onTutup={tutupHadiah} />}
    </>
  )
}

/** Kenapa, langkah, dan catatan orang tua: supaya misi di luar layar jelas harus ke mana. */
function Panduan({ misi }: { misi: MisiDetail }) {
  if (!misi.kenapa && !misi.langkah?.length && !misi.petunjuk_ortu) return null
  return (
    <div className="tumpuk ph-panduan">
      {misi.kenapa && (
        <p><strong>Kenapa? </strong>{misi.kenapa}</p>
      )}
      {!!misi.langkah?.length && (
        <ol className="ph-langkah" aria-label="Langkah">
          {misi.langkah.map((l) => <li key={l}>{l}</li>)}
        </ol>
      )}
      {misi.petunjuk_ortu && (
        <details className="ph-lipat">
          <summary>Untuk Ayah atau Ummah</summary>
          <p>{misi.petunjuk_ortu}</p>
        </details>
      )}
    </div>
  )
}

/** Misi yang sudah selesai sebelumnya: tampilkan jawabannya. */
function JawabanTerbuka({ misi, onUlang }: { misi: MisiDetail; onUlang: (contoh: boolean) => void }) {
  const bisaUlang = misi.jenis === 'klik' || misi.jenis === 'gunting' || misi.jenis === 'kembar' || misi.jenis === 'perasaan'
  const adaContoh = bisaUlang && Array.isArray(misi.contoh) && misi.contoh.length > 0
  return (
    <div className="tumpuk">
      {bisaUlang && (
        <div className="baris">
          {adaContoh && <button type="button" className="btn btn-ghost" onClick={() => onUlang(true)}>🐱 Lihat contoh Oren lagi</button>}
          <button type="button" className="btn btn-ghost" onClick={() => onUlang(false)}>🔁 Kerjakan lagi</button>
        </div>
      )}
      {(misi.jenis === 'tandai' || misi.jenis === 'log') && (
        <p className="lencana aktif">✓ Misi ini sudah selesai. Kamu boleh mengulanginya kapan saja.</p>
      )}
      {misi.teks_rekam && <AreaRekam teks={misi.teks_rekam} />}
      {misi.versi_benar && (
        <div className="callout callout-accent">
          <div className="callout-content">
            <span className="callout-title">{misi.jenis === 'gunting' ? 'Setelah digunting' : 'Versi yang sudah dibetulkan'}</span>
            <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text)' }}>{misi.versi_benar}</p>
          </div>
        </div>
      )}
      {misi.jenis === 'perasaan' && misi.soal_jawaban && <JawabanPerasaan misi={misi} />}
      {misi.jenis === 'kembar' && misi.kata && misi.kata.length > 0 && (
        <p>Kata kembarnya: <strong>{misi.kata.join(', ')}</strong>
          {misi.pengganti && misi.pengganti.length > 0 && <>. Pengganti yang bisa dipakai: {misi.pengganti.join(', ')}.</>}
        </p>
      )}
    </div>
  )
}

/** Misi perasaan yang sudah selesai: tiap soal dengan perasaan dan alasannya (soal Oren dilewati). */
function JawabanPerasaan({ misi }: { misi: MisiDetail }) {
  const mulai = Array.isArray(misi.contoh) && misi.contoh.length > 0 ? 1 : 0
  const soal = misi.soal ?? []
  return (
    <ol className="tumpuk ph-langkah" aria-label="Jawaban tiap soal">
      {(misi.soal_jawaban ?? []).slice(mulai).map((k, n) => (
        <li key={n}>
          <p>{soal[n + mulai]?.tokens.map((t) => t.t).join('')}</p>
          <p><strong>Dia {k.jawaban}.</strong></p>
          <p>{k.alasan}</p>
        </li>
      ))}
    </ol>
  )
}

function AreaKerja({ misi, selesai, onSelesai, onSegarkan, urutanBerikut, nomor, lewatiContoh = false }: {
  misi: MisiDetail
  selesai: boolean
  onSelesai: (h: Jawaban & { hadiah_baru?: HadiahBaru[] }) => void
  onSegarkan: () => void
  urutanBerikut: number | undefined
  nomor: number
  /** "Kerjakan lagi" pada misi yang sudah selesai: contoh Oren tidak diputar dulu. */
  lewatiContoh?: boolean
}) {
  const id = misi.id
  const tokens = misi.tokens ?? []
  switch (misi.jenis) {
    case 'klik':
      return <KerjaKlik misi={misi} onSelesai={onSelesai} lewatiContoh={lewatiContoh} />
    case 'gunting':
      return (
        <DenganContoh misi={misi} lewati={lewatiContoh} potong>
          <Gunting tokens={tokens} onPeriksa={(p) => periksaGunting(id, p)} onSelesai={onSelesai}
            bantuan={misi.bantuan_memudar ? (misi.bantuan ?? null) : undefined}
            onBantuan={(p) => bantuanGunting(id, p)} />
        </DenganContoh>
      )
    case 'kembar':
      return (
        <DenganContoh misi={misi} lewati={lewatiContoh || (misi.percobaan?.meleset ?? 0) > 0}>
          <DetektorKembar tokens={tokens} kataUmum={misi.kata_umum ?? []} onPeriksa={(k) => periksaKembar(id, k)}
            onSelesai={onSelesai} bantuan={misi.bantuan_memudar ? (misi.bantuan ?? null) : undefined} />
        </DenganContoh>
      )
    case 'tandai':
      return <MisiTandai misi={misi} selesai={selesai} onSelesai={onSelesai} />
    case 'log':
      return <MisiLog misi={misi} selesai={selesai} onSelesai={onSelesai} />
    case 'perasaan':
      return (
        <PilihPerasaan soal={misi.soal ?? []} contoh={Array.isArray(misi.contoh) ? misi.contoh : []}
          awal={misi.percobaan as PercobaanPerasaan | undefined}
          bantuan={misi.bantuan_memudar ? ((misi.bantuan ?? null) as unknown as BantuanPerasaan) : undefined}
          onKirim={(b) => kirimPerasaan(id, b)} onSelesai={onSelesai} />
      )
    case 'cetak':
      return <MisiCetak misi={misi} onSegarkan={onSegarkan} urutanBerikut={urutanBerikut} nomor={nomor} />
  }
}

/** Contoh dari Oren lebih dulu (bila misinya punya `contoh`) dan tombol 🔊 (bila `suara`), untuk
 *  misi klik, gunting, dan kembar (spec 075 K1). Pekerjaan anak tetap terpasang selama contoh
 *  supaya keadaannya tidak hilang. `lewati`: anak sudah mulai, atau memilih "Kerjakan lagi". */
function DenganContoh({ misi, lewati, potong = false, children }: {
  misi: MisiDetail
  lewati: boolean
  /** Gunting: spasi yang disorot contoh tampil sebagai garis potong. */
  potong?: boolean
  children: ReactNode
}) {
  const tokens = misi.tokens ?? []
  const langkah = Array.isArray(misi.contoh) ? misi.contoh : []
  const [lihatContoh, setLihatContoh] = useState(langkah.length > 0 && !lewati)
  const kerja = (
    <>
      {lihatContoh && <ContohOren tokens={tokens} langkah={langkah} potong={potong} onSelesai={() => setLihatContoh(false)} />}
      <div className="tumpuk" hidden={lihatContoh}>
        {langkah.length > 0 && (
          <p><button type="button" className="btn btn-ghost" onClick={() => setLihatContoh(true)}>🐱 Lihat contoh Oren lagi</button></p>
        )}
        {children}
      </div>
    </>
  )
  return misi.suara ? <Dengar teks={tokens.map((t) => t.t).join('')}>{kerja}</Dengar> : kerja
}

/** Klik Kesalahan dengan bantuan memudar bila misinya memakainya. */
function KerjaKlik({ misi, onSelesai, lewatiContoh }: {
  misi: MisiDetail
  onSelesai: (h: Jawaban & { hadiah_baru?: HadiahBaru[] }) => void
  lewatiContoh: boolean
}) {
  const id = misi.id
  const p = misi.percobaan ? awalKlik(misi.percobaan) : undefined
  const sudahMulai = !!p && ((p.ditemukan ?? 0) > 0 || p.diklik.length > 0 || p.meleset > 0)
  return (
    <DenganContoh misi={misi} lewati={lewatiContoh || sudahMulai}>
      <TeksKlik tokens={misi.tokens ?? []} celah={misi.celah} jumlah={misi.jumlah} awal={p}
        bantuan={misi.bantuan_memudar ? (misi.bantuan ?? null) : undefined}
        onKlik={(t) => klikMisi(id, t)} onPetunjuk={() => petunjukMisi(id)} onBerhenti={() => berhentiMisi(id)}
        onSelesai={onSelesai} />
    </DenganContoh>
  )
}

/** Percobaan yang tersimpan; `ditemukan`/`celah` dipakai bila server mengirimnya. */
function awalKlik(p: NonNullable<MisiDetail['percobaan']>): AwalKlik {
  const x = p as typeof p & { ditemukan?: number; celah?: number[] }
  return { diklik: p.diklik, meleset: p.meleset, ditemukan: x.ditemukan, celah: x.celah }
}

/** Tautan misi: halaman di dalam aplikasi dibuka di tab yang sama. */
function TautanMisi({ href }: { href: string }) {
  if (href.startsWith('/')) {
    const ke = href.startsWith('/naskah/baru') ? 'Buat naskah baru' : href.startsWith('/naskah') ? 'Buka Ruang Penulis' : 'Buka halamannya'
    return <Link className="btn-besar sekunder ph-tautan-tombol" to={href}>{ke} →</Link>
  }
  return (
    <a className="btn-besar sekunder ph-tautan-tombol" href={href} target="_blank" rel="noopener noreferrer">
      Buka tautannya ↗
    </a>
  )
}

function MisiTandai({ misi, selesai, onSelesai }: {
  misi: MisiDetail; selesai: boolean; onSelesai: (h: { hadiah_baru?: HadiahBaru[] }) => void
}) {
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  async function tandai() {
    setSibuk(true)
    setGalat(null)
    try {
      onSelesai(await tandaiMisi(misi.id))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Belum tersimpan. Coba lagi, ya.')
    } finally {
      setSibuk(false)
    }
  }
  return (
    <div className="tumpuk">
      {misi.teks_rekam && <AreaRekam teks={misi.teks_rekam} />}
      {misi.tautan && <p><TautanMisi href={misi.tautan} /></p>}
      <Galat pesan={galat} />
      {!selesai && (
        <button type="button" className="btn-besar" onClick={tandai} disabled={sibuk}>Tandai selesai</button>
      )}
    </div>
  )
}

function AreaRekam({ teks }: { teks: NonNullable<MisiDetail['teks_rekam']> }) {
  const [pilih, setPilih] = useState(0)
  if (!teks.length) {
    return (
      <p className="callout callout-info">
        Selesaikan dulu misi Si Ceroboh di modul ini. Teks yang sudah kamu betulkan akan muncul di sini untuk dibaca.
      </p>
    )
  }
  return (
    <div className="tumpuk">
      {teks.length > 1 && (
        <div className="baris" role="group" aria-label="Pilih teks">
          {teks.map((t, i) => (
            <button key={t.judul} type="button" className={`tombol-kecil${i === pilih ? ' aktif' : ''}`}
              aria-pressed={i === pilih} onClick={() => setPilih(i)}>{t.judul}</button>
          ))}
        </div>
      )}
      <div className="callout callout-accent">
        <div className="callout-content">
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text)' }}>{teks[pilih]?.teks}</p>
        </div>
      </div>
      <Perekam />
    </div>
  )
}

function MisiLog({ misi, selesai, onSelesai }: {
  misi: MisiDetail; selesai: boolean; onSelesai: (h: { hadiah_baru?: HadiahBaru[] }) => void
}) {
  const id = useId()
  const [log, setLog] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  async function kirim(e: FormEvent) {
    e.preventDefault()
    if (!log.trim()) return
    setSibuk(true)
    setGalat(null)
    try {
      onSelesai(await tandaiMisi(misi.id, log.trim()))
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Belum tersimpan. Coba lagi, ya.')
    } finally {
      setSibuk(false)
    }
  }
  return (
    <form className="tumpuk" onSubmit={kirim}>
      <div>
        <label htmlFor={`${id}-log`} style={{ fontWeight: 600, display: 'block', marginBottom: 'var(--space-2)' }}>
          {misi.pertanyaan || 'Tulis LOG-mu, satu baris saja.'}
        </label>
        <input id={`${id}-log`} className="ph-isian" value={log} onChange={(e) => setLog(e.target.value)}
          disabled={selesai} maxLength={300} />
        {typeof misi.contoh === 'string' && misi.contoh && <p className="kecil" style={{ marginTop: 'var(--space-2)' }}>Contoh: “{misi.contoh}”</p>}
      </div>
      <Galat pesan={galat} />
      {!selesai && <button type="submit" className="btn-besar" disabled={!log.trim() || sibuk}>Simpan LOG</button>}
    </form>
  )
}

function MisiCetak({ misi, onSegarkan, urutanBerikut, nomor }: {
  misi: MisiDetail; onSegarkan: () => void; urutanBerikut: number | undefined; nomor: number
}) {
  const [status, setStatus] = useState(misi.status)
  const [dicetak, setDicetak] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const kode = misi.lembar?.kode

  function cetak() {
    if (!kode) return
    window.open(`/cetak/${encodeURIComponent(kode)}`, '_blank', 'noopener')
    setDicetak(true)
  }

  /** Langkah kedua (Rancangan: "Sudah aku kerjakan, serahkan ke Ayah atau Ummah"). */
  async function serahkan() {
    setSibuk(true)
    setGalat(null)
    try {
      await cetakMisi(misi.id)
      setStatus('menunggu')
      onSegarkan()
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Belum tersimpan. Coba lagi, ya.')
    } finally {
      setSibuk(false)
    }
  }

  if (!kode) return <p>Lembar untuk misi ini belum ada. Tanya Ayah atau Ummah, ya.</p>
  return (
    <div className="tumpuk">
      {status === 'coba_lagi' && (
        <div className="callout callout-info"><div className="callout-content">
          <p>Ayah atau Ummah minta kamu mencoba sekali lagi. Cetak lembarnya, lalu kerjakan lagi pelan-pelan.</p>
        </div></div>
      )}
      <p className="kecil">Lembar <span className="mono">{kode}</span>{misi.lembar?.judul ? ` · ${misi.lembar.judul}` : ''}</p>
      <Galat pesan={galat} />
      {status === 'menunggu' ? (
        <div className="tumpuk" aria-live="polite">
          <p><span className="lencana">menunggu diperiksa Ayah atau Ummah</span></p>
          <p>Lembarmu sudah diserahkan. Kamu boleh lanjut sekarang.</p>
          <div className="baris">
            {urutanBerikut !== undefined && (
              <Link className="btn-besar ph-tautan-tombol" to={`/modul/${nomor}/misi/${urutanBerikut}`}>Misi berikutnya</Link>
            )}
            <Link className={`btn-besar ph-tautan-tombol${urutanBerikut !== undefined ? ' sekunder' : ''}`} to={`/modul/${nomor}`}>Kembali ke modul</Link>
            <button type="button" className="btn btn-ghost" onClick={cetak}>Cetak lagi</button>
          </div>
        </div>
      ) : (
        <div className="baris">
          <button type="button" className={`btn-besar${dicetak ? ' sekunder' : ''}`} onClick={cetak}>🖨️ Cetak lembar ini</button>
          {/* Selalu ada: lembar bisa saja sudah dicetak Ayah atau Ummah dari Pojok Orang Tua. */}
          <button type="button" className={`btn-besar${dicetak ? '' : ' sekunder'}`} onClick={serahkan} disabled={sibuk}>
            Sudah aku kerjakan, serahkan ke Ayah atau Ummah
          </button>
        </div>
      )}
    </div>
  )
}
