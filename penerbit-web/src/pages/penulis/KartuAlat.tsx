import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAlat } from '../../api'
import type { Alat, Slot } from '../../types'
import { EMOJI_TINGKAT, Galat, KepalaHalaman, Memuat, warnaCss } from '../../components/ui'
import '../../styles/penulis-halaman.css'

const NAMA_TINGKAT = { perunggu: 'Perunggu', perak: 'Perak', emas: 'Emas' } as const

function tanggal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export default function KartuAlat() {
  const [alat, setAlat] = useState<Alat[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    getAlat().then((r) => setAlat(r.alat)).catch((e: Error) => setGalat(e.message))
  }, [])

  return (
    <main className="page ph-halaman">
      <KepalaHalaman judul="Kotak Alat Editor"
        sub="Setiap alat punya tiga stiker. Emas berarti alat itu sudah bekerja sendiri di tulisanmu." />
      <Galat pesan={galat} />
      {!alat && !galat && <Memuat />}
      {alat && (
        <div className="ph-alat-daftar">
          {alat.map((a) => <KartuSatuAlat key={a.kode} alat={a} />)}
        </div>
      )}
    </main>
  )
}

function KartuSatuAlat({ alat: a }: { alat: Alat }) {
  const gaya = { ['--warna-alat' as string]: warnaCss(a.warna) }
  if (!a.terbuka) {
    return (
      <article className="kartu-alat ph-alat-baris samar" style={gaya} aria-label={`${a.nama}, terkunci`}>
        <div className="ph-alat-info">
          <span className="emoji" aria-hidden="true">{a.emoji}</span>
          <h2 className="ph-alat-nama">{a.nama}</h2>
          <p className="kecil">Terbuka di Modul {a.modul_belajar}</p>
        </div>
      </article>
    )
  }
  const perunggu = a.slot.find((s) => s.tingkat === 'perunggu')?.punya ?? false
  const perak = a.slot.find((s) => s.tingkat === 'perak')?.punya ?? false
  return (
    <article className={`kartu-alat ph-alat-baris${perunggu ? '' : ' sekarang'}`} style={gaya} aria-label={a.nama}>
      <div className="ph-alat-info">
        <span className="emoji" aria-hidden="true">{a.emoji}</span>
        <h2 className="ph-alat-nama">{a.nama}</h2>
        {a.pertanyaan && <p className="ph-alat-tanya">“{a.pertanyaan}”</p>}
        {perunggu ? (
          <Link className="btn-besar sekunder ph-tautan-tombol ph-tombol-kecil" to={`/alat/${a.kode}/latihan`}>Latih alat ini</Link>
        ) : (
          <Link className="ph-alat-modul" to={`/modul/${a.modul_belajar}`}>Sedang dipelajari di Modul {a.modul_belajar}</Link>
        )}
        {perunggu && (
          <p className="kecil">
            <Link to="/alat-bebas">Alat Bebas</Link>
            {perak && <> · <Link to="/soal">Buat soal untuk Ayah</Link></>}
          </p>
        )}
      </div>
      <div className="ph-slot-grid">
        {a.slot.map((s) => <SlotStiker key={s.tingkat} slot={s} />)}
      </div>
    </article>
  )
}

function SlotStiker({ slot: s }: { slot: Slot }) {
  const k = s.kemajuan
  return (
    <div className={`ph-slot-kotak${s.punya ? ' punya' : ''}`}>
      <span className={`ph-slot-emoji${s.punya ? '' : ' ph-samar'}`}
        aria-label={`${NAMA_TINGKAT[s.tingkat]}${s.punya ? ', sudah didapat' : ', belum'}`} role="img">
        {EMOJI_TINGKAT[s.tingkat]}
      </span>
      <strong>{NAMA_TINGKAT[s.tingkat]}</strong>
      {s.syarat_teks && <p>{s.syarat_teks}</p>}
      {s.punya ? (
        <p className="ph-didapat">
          Didapat {tanggal(s.tanggal)}{s.diberikan_oleh ? ` dari ${s.diberikan_oleh}` : ''}
        </p>
      ) : (
        <>
          {k && k.target > 0 && (
            <div className="ph-slot-kemajuan">
              <div className="ph-batang" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (k.sekarang / k.target) * 100)}%` }} />
              </div>
              {Math.min(k.sekarang, k.target)} dari {k.target}
            </div>
          )}
          {s.oleh_pemeriksa && <p className="ph-slot-catatan">Diberikan Ayah atau Ummah</p>}
        </>
      )}
    </div>
  )
}
