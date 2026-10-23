/** Soal dari anak (spec 075 K4, Buat soal untuk Ayah): orang tua mengerjakan teks Si Ceroboh buatan
 *  anak dengan klik yang sama seperti misi. Dinilai server per klik; kunci dan alasan anak terbuka
 *  setelah selesai. Anak melihat hasilnya di halaman soalnya. */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { berhentiSoalAnak, getSoalAnak, klikSoalAnak, listSoalAnak, type KunciSoal, type SoalAnakDetail } from '../../apiBuatSoal'
import TeksKlik from '../../components/TeksKlik'
import { Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import type { HasilKlik, Token } from '../../types'
import { PilihSimulasi } from './PertanyaanAnak'
import { ButuhPenulis, tgl, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

function IsiDaftar() {
  const { penulisDipilih } = useMe()
  const [simulasi, setSimulasi] = useState(false)
  const { data, error } = useMuat(() => listSoalAnak(simulasi), [penulisDipilih, simulasi])
  return (
    <main className="page">
      <Link className="kembali" to="/ortu">← Dasbor</Link>
      <h1 className="page-title">Soal dari {data?.penulis ?? 'anak'}</h1>
      <p className="kecil">
        Setelah stiker Perak, anak bisa membuat teks Si Ceroboh sendiri dan menyembunyikan kesalahannya.
        Coba temukan semuanya. Anak melihat berapa yang kamu temukan.
      </p>
      <PilihSimulasi nilai={simulasi} onUbah={setSimulasi} />
      <Galat pesan={error} />
      {!data && !error && <Memuat />}
      {data && data.soal.length === 0 && <p className="kecil bagian-ortu">Belum ada soal.</p>}
      {data?.soal.map((s) => {
        const p = s.punyaku
        return (
          <article key={s.id} className="kartu bagian-ortu" aria-label={`Soal ${s.alat.nama}, ${tgl(s.dibuat)}`}>
            <p className="kecil"><span aria-hidden="true">{s.alat.emoji}</span> {s.alat.nama} · {tgl(s.dibuat)}</p>
            <p>{s.jumlah} kesalahan disembunyikan</p>
            {p?.selesai ? (
              <p className="pesan-ok">Kamu menemukan {p.ditemukan} dari {p.total}</p>
            ) : p ? (
              <p className="kecil">Sedang dikerjakan: {p.ditemukan} dari {p.total}</p>
            ) : null}
            <Link className="btn btn-primary btn-kecil" to={`/ortu/soal/${s.id}`}>{p?.selesai ? 'Lihat' : 'Kerjakan'}</Link>
          </article>
        )
      })}
    </main>
  )
}

export default function SoalAnak() {
  return <ButuhPenulis judul="Soal dari anak"><IsiDaftar /></ButuhPenulis>
}

/** Teks dengan semua kesalahan yang disembunyikan anak (setelah selesai). */
function TeksTerbuka({ tokens, kunci }: { tokens: Token[]; kunci: KunciSoal['kunci'] }) {
  const token = new Set(kunci.flatMap((g) => g.flatMap((t) => t.token)))
  const celah = new Set(kunci.flatMap((g) => g.map((t) => t.celah).filter((c): c is number => c !== null)))
  return (
    <div className="teks-latihan" aria-label="Teks dengan kesalahan yang disembunyikan">
      {tokens.map((t) => (
        <span key={t.i}>
          {celah.has(t.i) && <span className="celah ditemukan" aria-label="celah" />}
          <span className={token.has(t.i) ? 'kata ditemukan' : undefined}>{t.t}</span>
        </span>
      ))}
      {celah.has(tokens.length) && <span className="celah ditemukan" aria-label="celah di akhir" />}
    </div>
  )
}

function Alasan({ kunci, nama }: { kunci: KunciSoal; nama: string }) {
  const ada = kunci.kenapa.map((k, i) => ({ k, i })).filter((x) => x.k)
  return (
    <div className="callout callout-accent">
      <div className="callout-content">
        <span className="callout-title">Kata {nama}</span>
        {ada.length ? (
          <ol>{ada.map((x) => <li key={x.i} value={x.i + 1}>{x.k}</li>)}</ol>
        ) : <p>{nama} tidak menulis alasannya. Tanyakan langsung, yuk.</p>}
        <p className="kecil">{nama} akan melihat hasilmu di halaman soalnya.</p>
      </div>
    </div>
  )
}

function IsiKerjakan({ id }: { id: number }) {
  const { data, error } = useMuat(() => getSoalAnak(id), [id])
  const [terbuka, setTerbuka] = useState<KunciSoal | null>(null)
  if (error) return <Galat pesan={error} />
  if (!data) return <Memuat />
  const kunci: KunciSoal | null = terbuka ?? (data.kunci && data.kenapa ? { kunci: data.kunci, kenapa: data.kenapa, teks: data.teks ?? '' } : null)
  const simpanKunci = (r: Partial<KunciSoal>) => {
    if (r.kunci && r.kenapa) setTerbuka({ kunci: r.kunci, kenapa: r.kenapa, teks: r.teks ?? '' })
  }
  return (
    <>
      <h1 className="page-title"><span aria-hidden="true">{data.alat.emoji}</span> Soal {data.alat.nama} dari {data.penulis}</h1>
      <p>{data.penulis} menyembunyikan {data.jumlah} kesalahan. Klik {data.celah ? 'kata, tanda baca, atau celah' : 'kata'} yang salah.</p>
      {data.punyaku?.selesai && kunci ? (
        <>
          <p className="pesan-ok">Kamu menemukan {data.punyaku.ditemukan} dari {data.punyaku.total}.</p>
          <TeksTerbuka tokens={data.tokens} kunci={kunci.kunci} />
        </>
      ) : (
        <TeksKlik tokens={data.tokens} celah={data.celah} jumlah={data.jumlah} awal={awalDari(data)}
          onKlik={async (t) => {
            const r = await klikSoalAnak(id, t)
            if (r.selesai) simpanKunci(r)
            return { boleh_petunjuk: false, ...r } as HasilKlik
          }}
          onBerhenti={async () => {
            const r = await berhentiSoalAnak(id)
            simpanKunci(r)
            return r
          }} />
      )}
      {kunci && <Alasan kunci={kunci} nama={data.penulis} />}
    </>
  )
}

function awalDari(d: SoalAnakDetail) {
  const p = d.punyaku
  return p ? { diklik: p.diklik, celah: p.celah, ditemukan: p.ditemukan, meleset: p.meleset } : undefined
}

export function KerjakanSoal() {
  const { id } = useParams()
  return (
    <main className="page">
      <Link className="kembali" to="/ortu/soal">← Soal dari anak</Link>
      <IsiKerjakan id={Number(id)} />
    </main>
  )
}
