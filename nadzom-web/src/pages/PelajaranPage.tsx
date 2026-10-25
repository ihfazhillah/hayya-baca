import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cariModul, namaModul } from '@/content'
import type { Contoh, Tamrin } from '@/content/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { timbangBait } from '@/lib/timbang'
import { aturSelesai, kodePelajaran, sudahSelesai } from '@/lib/progres'
import Teks from '@/components/Teks'
import Peragaan from '@/components/Peragaan'
import Pilihan from '@/components/Pilihan'
import TaqthiBertahap from '@/components/TaqthiBertahap'
import Cetakan from '@/components/Cetakan'
import Susun from '@/components/Susun'
import HasilTimbang from '@/components/HasilTimbang'
import Irama from '@/components/Irama'
import Kenali from '@/components/Kenali'
import TandaiDrill from '@/components/TandaiDrill'
import CariPincang from '@/components/CariPincang'
import Panen from '@/components/Panen'
import { Jilid } from '@/components/Jilid'

const ANGKA = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
const angka = (n: number) => String(n).split('').map((d) => ANGKA[Number(d)]).join('')

function Bagian({ nomor, ar, label, children }: { nomor: number; ar: string; label: string; children: ReactNode }) {
  return (
    <section className="bagian" aria-label={label}>
      <div className="bagian-judul">
        <span className="segel" aria-hidden="true">{angka(nomor)}</span>
        <h2 className="ar" lang="ar">{ar}</h2>
        <span className="label">{label}</span>
      </div>
      {children}
    </section>
  )
}

function KartuContoh({ c }: { c: Contoh }) {
  const [buka, setBuka] = useState(false)
  const k = kitabahBait(c.bait)
  return (
    <article className="kartu">
      <div className="papan-bait" lang="ar">
        {c.bait.map((s, i) => <div key={i}>{s}</div>)}
      </div>
      <p className="makna">{c.makna}</p>
      <div className="tumpuk-kecil">
        {c.catatan && <p><Teks>{c.catatan}</Teks></p>}
        <p className="redup kecil"><Teks>{c.sumber}</Teks></p>
      </div>
      <div className="baris">
        <button type="button" className="tombol kecil" onClick={() => setBuka(!buka)} aria-expanded={buka}>
          {buka ? 'Tutup timbangan' : 'Lihat timbangan'}
        </button>
      </div>
      {buka && k.ok && <HasilTimbang hasil={timbangBait(k.syathr, cariBahr(c.bahr)!)} bait={c.bait} />}
    </article>
  )
}

const NAMA_TAMRIN: Record<Tamrin['jenis'], string> = {
  pilih: 'Kenali',
  kenali: 'Kenali',
  tandai: 'Beri tanda',
  pincang: 'Cari yang pincang',
  taqthi: "Taqthi' bertahap",
  cetakan: 'Isi cetakan',
  susun: 'Susun sendiri',
  irama: 'Dengar dan lagukan',
  panen: 'Panen laci',
}

function TamrinIrama({ t }: { t: Extract<Tamrin, { jenis: 'irama' }> }) {
  const k = kitabahBait(t.bait)
  return (
    <>
      <p><Teks>{t.petunjuk}</Teks></p>
      <div className="papan-bait" lang="ar">{t.bait.map((s, i) => <div key={i}>{s}</div>)}</div>
      {t.makna && <p className="makna">{t.makna}</p>}
      {k.ok ? <Irama hasil={timbangBait(k.syathr, cariBahr(t.bahr)!)} /> : <div className="pesan salah">{k.galat}</div>}
    </>
  )
}

function KartuTamrin({ t, ke }: { t: Tamrin; ke: number }) {
  return (
    <article className="kartu">
      <div className="baris">
        <span className="segel" aria-hidden="true">{angka(ke)}</span>
        <h3>{NAMA_TAMRIN[t.jenis]}</h3>
      </div>
      {t.jenis === 'pilih' && <Pilihan soal={t.soal} pilihan={t.pilihan} jawaban={t.jawaban} alasan={t.alasan} arab={t.arab} />}
      {t.jenis === 'taqthi' && (
        <>
          <p><Teks>{t.petunjuk}</Teks></p>
          {t.makna && <p className="makna">{t.makna}</p>}
          <TaqthiBertahap bait={t.bait} bahr={cariBahr(t.bahr)} judulDiwan="Taqthi' kunci" />
        </>
      )}
      {t.jenis === 'cetakan' && <Cetakan t={t} />}
      {t.jenis === 'susun' && <Susun t={t} />}
      {t.jenis === 'irama' && <TamrinIrama t={t} />}
      {t.jenis === 'kenali' && <Kenali petunjuk={t.petunjuk} soal={t.soal} />}
      {t.jenis === 'tandai' && <TandaiDrill petunjuk={t.petunjuk} butir={t.butir} />}
      {t.jenis === 'pincang' && <CariPincang petunjuk={t.petunjuk} bahr={t.bahr} baris={t.baris} />}
      {t.jenis === 'panen' && <Panen t={t} />}
    </article>
  )
}

export default function PelajaranPage() {
  const params = useParams()
  const modul = cariModul(Number(params.modul))
  const p = modul?.pelajaran.find((x) => x.nomor === Number(params.pelajaran))
  const kode = kodePelajaran(Number(params.modul), Number(params.pelajaran), p?.versi)
  const [selesai, setSelesai] = useState(() => sudahSelesai(kode))
  if (!modul || !p) return <div className="tumpuk"><h1>Pelajaran belum tersedia</h1><Link to="/">Kembali ke peta</Link></div>

  const i = modul.pelajaran.indexOf(p)
  const sebelum = modul.pelajaran[i - 1]
  const berikut = modul.pelajaran[i + 1]
  const ubahSelesai = (v: boolean) => {
    setSelesai(v)
    aturSelesai(kode, v)
  }

  return (
    <Jilid.Provider value={{ salim: !!modul.salim, modul: modul.nomor }}>
      <section className="judul-halaman">
        <span className="label">
          <Link to="/">Peta</Link> · <Link to={`/modul/${modul.nomor}`}>{namaModul(modul)}: {modul.judul}</Link> · Pelajaran {p.nomor}
        </span>
        <h1>{p.judul}</h1>
        <p className="lead"><Teks>{p.analogi}</Teks></p>
        <div className="baris"><span className="chip">{p.menit} menit</span><span className="redup kecil"><Teks>{p.ringkas}</Teks></span></div>
      </section>

      <Bagian nomor={1} ar="الأَمْثِلَة" label="Contoh">
        {p.amtsilah.map((c, k) => <KartuContoh key={k} c={c} />)}
        {p.dengar && p.dengar.length > 0 && (
          <div className="kartu">
            <span className="label">Dengarkan</span>
            <ul className="dengar">
              {p.dengar.map((d) => (
                <li key={d.url}>
                  <a href={d.url} target="_blank" rel="noreferrer">{d.judul}</a>
                  {d.catatan && <span className="redup kecil"> · <Teks>{d.catatan}</Teks></span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Bagian>

      <Bagian nomor={2} ar="البَحْث" label="Pembahasan">
        <Peragaan key={kode} bahts={p.bahts} />
        {p.syarh && p.syarh.length > 0 && (
          <div className="kartu">
            <span className="label">Penjelasan</span>
            <div className="syarh">{p.syarh.map((x, k) => <p key={k}><Teks>{x}</Teks></p>)}</div>
          </div>
        )}
        {p.keliru && p.keliru.length > 0 && (
          <div className="kartu">
            <span className="label">Yang sering keliru</span>
            <ul className="keliru">
              {p.keliru.map((x, k) => (
                <li key={k}>
                  <span className="tanda-keliru salah">Keliru</span><span><Teks>{x.salah}</Teks></span>
                  <span className="tanda-keliru benar">Benar</span><span><Teks>{x.benar}</Teks></span>
                  <span className="sebab"><Teks>{x.sebab}</Teks></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Bagian>

      <Bagian nomor={3} ar="القَاعِدَة" label="Kaidah">
        <div className="kartu">
          <ul className="qaidah">
            {p.qaidah.map((q, k) => (
              <li key={k}><span className="segel" aria-hidden="true">{angka(k + 1)}</span><span><Teks>{q}</Teks></span></li>
            ))}
          </ul>
        </div>
      </Bagian>

      <Bagian nomor={4} ar="التَّمْرِينَات" label="Latihan">
        {p.tamarin.map((t, k) => <KartuTamrin key={`${kode}-${k}`} t={t} ke={k + 1} />)}
      </Bagian>

      <section className="patokan" aria-label="Patokan sesi">
        <span className="label">Patokan sesi ini</span>
        <p><Teks>{p.patokan}</Teks></p>
        <label className="baris" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={selesai} onChange={(e) => ubahSelesai(e.target.checked)} />
          <span>Patokan tercapai, tandai pelajaran ini selesai</span>
        </label>
      </section>

      <nav className="baris-antara" aria-label="Pelajaran lain">
        {sebelum ? <Link className="tombol" to={`/modul/${modul.nomor}/${sebelum.nomor}`}>← {sebelum.judul}</Link> : <span />}
        {berikut ? <Link className="tombol utama lanjut" to={`/modul/${modul.nomor}/${berikut.nomor}`}>{berikut.judul} →</Link> : <Link className="tombol lanjut" to="/">Kembali ke peta</Link>}
      </nav>
    </Jilid.Provider>
  )
}
