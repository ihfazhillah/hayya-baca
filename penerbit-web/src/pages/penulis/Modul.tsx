import { useEffect, useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getModul } from '../../api'
import type { Alat, MisiRingkas, ModulDetail, ModulTerkunci } from '../../types'
import { EMOJI_TINGKAT, Galat, KepalaHalaman, Memuat, warnaCss } from '../../components/ui'
import KotakPrompt from '../../components/KotakPrompt'
import LatihanBertanya from '../../components/LatihanBertanya'
import UjianAB from '../../components/UjianAB'
import '../../styles/penulis-halaman.css'

export default function Modul() {
  const nomor = Number(useParams().nomor)
  const [data, setData] = useState<{ nomor: number; m: ModulDetail | ModulTerkunci } | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    let aktif = true
    getModul(nomor)
      .then((m) => aktif && setData({ nomor, m }))
      .catch((e: Error) => aktif && setGalat(e.message))
    return () => { aktif = false }
  }, [nomor])

  const m = data?.nomor === nomor ? data.m : null
  return (
    <main className="page ph-halaman">
      <Galat pesan={galat} />
      {!m && !galat && <Memuat />}
      {m && (m.terkunci ? <Terkunci m={m} /> : <IsiModul key={m.nomor} m={m} />)}
    </main>
  )
}

function Terkunci({ m }: { m: ModulTerkunci }) {
  return (
    <>
      <KepalaHalaman nomor={m.nomor} judul={`${m.emoji} ${m.judul}`} />
      <div className="callout callout-info" role="status">
        <span className="callout-icon" aria-hidden="true">🔒</span>
        <div className="callout-content">
          <p>Selesaikan Modul {m.modul_sebelumnya} dulu, ya.</p>
        </div>
      </div>
      <Link className="btn-besar ph-tautan-tombol" to={`/modul/${m.modul_sebelumnya}`}>Ke Modul {m.modul_sebelumnya}</Link>
    </>
  )
}

function IsiModul({ m }: { m: ModulDetail }) {
  return (
    <>
      <KepalaHalaman nomor={m.nomor} judul={`${m.emoji} ${m.judul}`} sub={m.tujuan} />

      {m.kenapa && (
        <section aria-labelledby="judul-kenapa" className="kartu ph-kenapa">
          <span className="besar" aria-hidden="true">{m.emoji}</span>
          <div>
            <h2 id="judul-kenapa" className="ph-judul-bagian" style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Kenapa?</h2>
            <p style={{ fontSize: 'var(--text-lg)' }}>{m.kenapa}</p>
          </div>
        </section>
      )}

      {m.mentor.tahap !== 'tanpa' ? (
        <KotakPrompt modul={m.nomor} mentor={m.mentor} />
      ) : (
        m.bertanya && <LatihanBertanya modul={m.nomor} a={m.bertanya.a} b={m.bertanya.b} />
      )}

      {m.petunjuk_lihat && (
        <details className="ph-lipat">
          <summary>Untuk Ayah atau Ummah: tahap Lihat</summary>
          <p>{m.petunjuk_lihat}</p>
        </details>
      )}

      {m.langkah.length > 0 && (
        <section aria-labelledby="judul-langkah">
          <h2 id="judul-langkah" className="ph-judul-bagian">Langkah</h2>
          <ol className="ph-daftar" style={{ fontSize: 'var(--text-lg)' }}>
            {m.langkah.map((l, i) => <li key={i}>{l}</li>)}
          </ol>
        </section>
      )}

      <section aria-labelledby="judul-misi" className="ph-misi">
        <h2 id="judul-misi" className="ph-judul-bagian">Misi</h2>
        {m.misi.map((x) => <BarisMisi key={x.id} nomor={m.nomor} x={x} />)}
      </section>

      <TabBelajar m={m} />

      {m.ujian.length > 0 && (
        <section aria-labelledby="judul-ujian">
          <h2 id="judul-ujian" className="ph-judul-bagian">Ujian</h2>
          <UjianAB soal={m.ujian} />
        </section>
      )}

      {m.alat && <KartuStiker alat={m.alat} />}
    </>
  )
}

const STATUS: Record<string, { teks: string; kelas: string }> = {
  selesai: { teks: 'Selesai', kelas: 'lencana selesai' },
  menunggu: { teks: 'menunggu Ayah atau Ummah', kelas: 'lencana' },
  coba_lagi: { teks: 'Coba lagi', kelas: 'lencana aktif' },
}

function BarisMisi({ nomor, x }: { nomor: number; x: MisiRingkas }) {
  const st = x.status ? STATUS[x.status] : null
  const bonus = x.tahap === 'bonus'
  return (
    <div className={`checklist-step${x.status === 'selesai' ? ' done' : ''}`}>
      <span className="checklist-num" aria-hidden="true">{x.status === 'selesai' ? '✓' : bonus ? '+' : x.urutan}</span>
      <div className="checklist-label">
        <strong>Misi {x.urutan} · {x.tahap_label}</strong>
        <br />
        {x.judul} <span className="kecil">· {x.jenis_label}</span>
        {st && <> <span className={st.kelas}>{st.teks}</span></>}
        {!st && bonus && <> <span className="lencana">Pilihan</span></>}
      </div>
      <Link className="checklist-btn" to={`/modul/${nomor}/misi/${x.urutan}`} aria-label={`Buka misi ${x.urutan}: ${x.judul}`}>
        Buka
      </Link>
    </div>
  )
}

function TabBelajar({ m }: { m: ModulDetail }) {
  const id = useId()
  const tab = [
    { kunci: 'resep', judul: 'Resep', ada: m.resep.length > 0 },
    { kunci: 'mengapa', judul: 'Mengapa ini bekerja', ada: !!m.mengapa },
    { kunci: 'kamus', judul: 'Kamus kata', ada: m.kamus.length > 0 },
  ].filter((t) => t.ada)
  const [aktif, setAktif] = useState(tab[0]?.kunci)
  if (!tab.length) return null
  return (
    <section aria-label="Resep dan penjelasan">
      <div className="diataxis-tabs ph-tab-daftar" role="tablist">
        {tab.map((t) => (
          <button key={t.kunci} type="button" role="tab" id={`${id}-t-${t.kunci}`} aria-controls={`${id}-p-${t.kunci}`}
            aria-selected={aktif === t.kunci} className={`diataxis-tab${aktif === t.kunci ? ' active' : ''}`}
            onClick={() => setAktif(t.kunci)}>
            {t.judul}
          </button>
        ))}
      </div>
      {tab.map((t) => (
        <div key={t.kunci} role="tabpanel" id={`${id}-p-${t.kunci}`} aria-labelledby={`${id}-t-${t.kunci}`}
          className={`diataxis-panel${aktif === t.kunci ? ' active' : ''}`} hidden={aktif !== t.kunci}>
          {t.kunci === 'resep' && (
            <ol className="ph-daftar" style={{ fontSize: 'var(--text-lg)' }}>{m.resep.map((r, i) => <li key={i}>{r}</li>)}</ol>
          )}
          {t.kunci === 'mengapa' && <p style={{ fontSize: 'var(--text-lg)' }}>{m.mengapa}</p>}
          {t.kunci === 'kamus' && (
            <dl className="ph-kamus">
              {m.kamus.map((k) => (
                <div key={k.istilah}><dt>{k.istilah}</dt><dd>{k.arti}</dd></div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </section>
  )
}

function KartuStiker({ alat }: { alat: Alat }) {
  const perunggu = alat.slot.find((s) => s.tingkat === 'perunggu')
  const berikut = alat.slot.find((s) => !s.punya)
  const k = berikut?.kemajuan
  let pesan: string
  if (perunggu && !perunggu.punya) {
    pesan = 'Stiker Perunggu muncul setelah misi 1 dan 2 selesai.'
    if (k) {
      const sisa = k.target - k.sekarang
      if (sisa > 0) pesan += ` Tinggal ${sisa} misi lagi.`
    }
  } else if (berikut) {
    pesan = `Stiker berikutnya: ${berikut.syarat_teks}`
    if (k) pesan += ` (${k.sekarang} dari ${k.target})`
  } else {
    pesan = 'Ketiga stiker alat ini sudah kamu dapat. Masyaa Allah!'
  }
  return (
    <section className="kartu-alat" style={{ ['--warna-alat' as string]: warnaCss(alat.warna) }} aria-label={`Stiker ${alat.nama}`}>
      <div className="baris">
        <span className="emoji" aria-hidden="true">{alat.emoji}</span>
        <strong style={{ fontFamily: 'var(--font-display)' }}>{alat.nama}</strong>
      </div>
      <div className="slot-baris">
        {alat.slot.map((s) => (
          <span key={s.tingkat} className={`slot-stiker ${s.tingkat}${s.punya ? ' punya' : ''}`}
            aria-label={`${s.tingkat}${s.punya ? ', sudah didapat' : ', belum'}`}>
            <span className={s.punya ? undefined : 'ph-samar'} aria-hidden="true">{EMOJI_TINGKAT[s.tingkat]}</span>
          </span>
        ))}
      </div>
      <p style={{ marginTop: 'var(--space-3)' }}>{pesan}</p>
    </section>
  )
}
