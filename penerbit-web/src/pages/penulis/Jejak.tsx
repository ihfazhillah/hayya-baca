import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJejak } from '../../api'
import NamaTokoh from '../../components/NamaTokoh'
import type { JejakCerita } from '../../types'
import { Galat, KepalaHalaman, Memuat } from '../../components/ui'
import '../../styles/penulis-halaman.css'

type Kunci = 'jumlah_kata' | 'kalimat_terpanjang' | 'kata_kembar_jumlah' | 'kalimat_perasaan' | 'ejaan_per_100'
type DataJejak = Awaited<ReturnType<typeof getJejak>>

/** Lima angka Jejak. `alat` = alat yang Emas-nya dihitung dari angka ini (musim-1). */
const ANGKA: { kunci: Kunci; nama: string; alat: string | null; namaAlat?: string; batas?: number; naikBagus?: boolean }[] = [
  { kunci: 'jumlah_kata', nama: 'Jumlah kata', alat: null, naikBagus: true },
  { kunci: 'kalimat_terpanjang', nama: 'Kalimat terpanjang', alat: 'gunting', namaAlat: 'Gunting', batas: 20 },
  { kunci: 'kata_kembar_jumlah', nama: 'Kata kembar terbanyak', alat: 'kembar', namaAlat: 'Detektor Kembar', batas: 3 },
  { kunci: 'kalimat_perasaan', nama: 'Kalimat “bilang perasaan”', alat: 'kamera', namaAlat: 'Kamera' },
  { kunci: 'ejaan_per_100', nama: 'Kesalahan ejaan per 100 kata', alat: 'kaca', namaAlat: 'Kaca Pembesar' },
]

function tanggal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export default function Jejak() {
  const [data, setData] = useState<DataJejak | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  const muat = () => getJejak().then(setData).catch((e: Error) => setGalat(e.message))
  useEffect(() => {
    muat()
  }, [])

  return (
    <main className="page ph-halaman">
      <KepalaHalaman judul="Jejak Keterampilan" sub={data?.cerita.length ? data.kalimat_utama : undefined} />
      <Galat pesan={galat} />
      {!data && !galat && <Memuat />}
      {data && data.cerita.length === 0 && (
        <div className="tumpuk">
          <p style={{ fontSize: 'var(--text-lg)' }}>Jejakmu mulai tercatat setelah Draf Nol pertama.</p>
          <Link className="btn-besar ph-tautan-tombol" to="/naskah">Ke Ruang Penulis</Link>
        </div>
      )}
      {data && data.cerita.length > 0 && (
        <>
          <p className="kecil">Dihitung dari Versi 1 setiap cerita, sebelum direvisi.</p>
          <div className="ph-grafik-grid">
            {ANGKA.map((a) => {
              const emas = a.alat ? data.emas.find((e) => e.alat === a.alat) : undefined
              return <Grafik key={a.kunci} angka={a} cerita={data.cerita} emas={emas} />
            })}
          </div>
          <section aria-labelledby="judul-tabel">
            <h2 id="judul-tabel" className="ph-judul-bagian">Angka per cerita</h2>
            <div className="ph-tabel-gulir">
              <table className="ref-table">
                <thead>
                  <tr>
                    <th scope="col">Cerita</th>
                    <th scope="col">Kata</th>
                    <th scope="col">Kalimat terpanjang</th>
                    <th scope="col">Kata kembar</th>
                    <th scope="col">Bilang perasaan</th>
                    <th scope="col">Ejaan /100</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.cerita].reverse().map((c, i) => (
                    <tr key={`${c.naskah}-${i}`}>
                      <th scope="row" style={{ fontWeight: 600 }}>{c.judul} <span className="kecil">· {tanggal(c.tanggal)}</span></th>
                      <td>{c.jumlah_kata}</td>
                      <td>{c.kalimat_terpanjang}</td>
                      <td>{c.kata_kembar ? `${c.kata_kembar}, ${c.kata_kembar_jumlah}` : c.kata_kembar_jumlah}</td>
                      <td>{c.kalimat_perasaan}</td>
                      <td>{c.ejaan_per_100}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="kecil">Angka ejaan diisi Ayah atau Ummah dari halaman Pemeriksa.</p>
          </section>
          <section aria-labelledby="judul-tokoh" className="tumpuk">
            <h2 id="judul-tokoh" className="ph-judul-bagian">Nama tokoh</h2>
            <p className="kecil">Nama tokoh tidak dihitung sebagai kata kembar. Ada nama yang terlewat? Tambahkan di ceritanya.</p>
            {[...new Map(data.cerita.map((c) => [c.naskah, c])).values()].reverse().map((c) => (
              <div key={c.naskah} className="tumpuk">
                <h3 style={{ fontSize: 'var(--text-base)' }}>{c.judul}</h3>
                <NamaTokoh naskahId={c.naskah} nama={c.tokoh ?? []} label={`Nama tokoh ${c.judul}`} onUbah={muat} />
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  )
}

const W = 260
const H = 90
const PAD = 10

function Grafik({ angka: a, cerita, emas }: {
  angka: (typeof ANGKA)[number]
  cerita: JejakCerita[]
  emas: { alat: string; tanggal: string } | undefined
}) {
  const nilai = cerita.map((c) => Number(c[a.kunci]) || 0)
  const awal = nilai[0]
  const akhir = nilai[nilai.length - 1]
  const maks = Math.max(...nilai, a.batas ?? 0, 1)
  const x = (i: number) => (nilai.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (nilai.length - 1))
  const y = (v: number) => H - PAD - (v / maks) * (H - 2 * PAD)
  const titik = nilai.map((v, i) => `${x(i)},${y(v)}`).join(' ')

  let arah = ''
  if (nilai.length > 1 && akhir !== awal) {
    const naik = akhir > awal
    arah = a.naikBagus ? (naik ? 'Makin panjang' : 'Lebih pendek') : naik ? 'Naik sedikit' : 'Membaik'
  }

  return (
    <figure className="kartu ph-grafik">
      <figcaption>
        <h3>{a.nama}</h3>
        <p className="angka">{nilai.length > 1 ? `${awal} → ${akhir}` : awal}</p>
        {arah && <p className="kecil">{arah}</p>}
        {a.batas !== undefined && !emas && <p className="kecil">Batas Emas {a.namaAlat}: {a.batas}</p>}
        {emas && <p className="lencana selesai">🥇 Emas {a.namaAlat} · {tanggal(emas.tanggal)}</p>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${a.nama} per cerita: ${cerita.map((c, i) => `${c.judul} ${nilai[i]}`).join(', ')}`}>
        <line className="dasar" x1={0} x2={W} y1={H - PAD} y2={H - PAD} />
        {a.batas !== undefined && <line className="batas" x1={0} x2={W} y1={y(a.batas)} y2={y(a.batas)} />}
        {nilai.length > 1 && <polyline className="garis" points={titik} />}
        {nilai.map((v, i) => (
          <circle key={i} className="titik" cx={x(i)} cy={y(v)} r={5}>
            <title>{`${cerita[i].judul}: ${v}`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  )
}
