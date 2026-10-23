import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ApiError, berhentiLatihan, getRuangLatihan, klikLatihan, periksaGuntingLatihan, periksaKembarLatihan,
} from '../../api'
import type { HadiahBaru, Jawaban, RuangLatihan as DataRuang } from '../../types'
import { Galat, KepalaHalaman, Memuat, PerayaanHadiah } from '../../components/ui'
import { useNavPenulis } from '../../components/LayoutPenulis'
import TeksKlik from '../../components/TeksKlik'
import Gunting from '../../components/Gunting'
import DetektorKembar from '../../components/DetektorKembar'
import '../../styles/penulis-halaman.css'

type Kartu = DataRuang['kartu'][number]

const CARA: Partial<Record<Kartu['jenis'], string>> = {
  klik: 'Klik kata yang salah.',
  gunting: 'Klik celah di antara kata untuk memotong kalimatnya, lalu tekan Periksa.',
  kembar: 'Klik kata yang paling sering muncul.',
}

/** Ruang Latihan satu alat (spec 075 K4): semua teks bank latihan alat ini, bebas dimainkan setelah
 *  Perunggu. Server mengurutkan: belum dicoba dulu, lalu yang paling jarang. Percobaan pertama di
 *  tiap teks dihitung untuk Perak; jadwal Pemanasan tidak berubah. */
export default function RuangLatihan() {
  const { kode = '' } = useParams()
  const [data, setData] = useState<DataRuang | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [terkunci, setTerkunci] = useState<string | null>(null)
  const [putaran, setPutaran] = useState(0)

  const muat = useCallback(() => {
    getRuangLatihan(kode)
      .then((d) => { setData(d); setPutaran((n) => n + 1) })
      .catch((e: Error) => {
        if (e instanceof ApiError && e.status === 403) setTerkunci(e.message)
        else setGalat(e.message)
      })
  }, [kode])

  useEffect(() => { muat() }, [muat])

  if (terkunci) {
    return (
      <main className="page ph-halaman">
        <div className="callout callout-info" role="status">
          <span className="callout-icon" aria-hidden="true">🔒</span>
          <div className="callout-content"><p>{terkunci}</p></div>
        </div>
        <Link className="btn-besar ph-tautan-tombol" to="/alat">Kembali ke Kotak Alat</Link>
      </main>
    )
  }

  const k = data?.kartu[0]
  return (
    <main className="page ph-halaman">
      <Link to="/alat">← Kotak Alat</Link>
      <Galat pesan={galat} />
      {!data && !galat && <Memuat />}
      {data && (
        <>
          <KepalaHalaman judul={`${data.alat.emoji} Ruang Latihan ${data.alat.nama}`}
            sub="Latih alat ini sesukamu. Pilih kapan berhenti." />
          <Kemajuan data={data} />
          {k ? (
            <KartuSatu key={`${k.id}-${putaran}`} kartu={k} alat={data.alat} onLanjut={muat} />
          ) : (
            <p role="status">Belum ada teks latihan untuk alat ini.</p>
          )}
        </>
      )}
    </main>
  )
}

function Kemajuan({ data }: { data: DataRuang }) {
  const p = data.perak
  return (
    <div className="kartu tumpuk">
      <p style={{ fontWeight: 600 }}>{data.dicoba} dari {data.jumlah} teks sudah kamu coba</p>
      <div className="ph-batang" aria-hidden="true">
        <span style={{ width: `${data.jumlah ? Math.min(100, (data.dicoba / data.jumlah) * 100) : 0}%` }} />
      </div>
      {p.punya ? (
        <p>🥈 Perak sudah kamu dapat. Teruskan supaya alatnya makin tajam!</p>
      ) : (
        <>
          {p.syarat_teks && <p className="kecil">{p.syarat_teks}</p>}
          {p.kemajuan && p.kemajuan.target > 0 && (
            <p className="kecil">Perak: {Math.min(p.kemajuan.sekarang, p.kemajuan.target)} dari {p.kemajuan.target}</p>
          )}
          <p className="kecil">Hanya percobaan pertama di setiap teks yang dihitung untuk Perak.</p>
        </>
      )}
    </div>
  )
}

function KartuSatu({ kartu: k, alat, onLanjut }: {
  kartu: Kartu
  alat: DataRuang['alat']
  onLanjut: () => void
}) {
  const { segarkan } = useNavPenulis()
  const [selesai, setSelesai] = useState(false)
  const [hadiah, setHadiah] = useState<HadiahBaru[]>([])
  const tutup = useCallback(() => setHadiah([]), [])
  const tokens = k.tokens ?? []

  function selesaikan(h: Jawaban & { hadiah_baru?: HadiahBaru[] }) {
    setSelesai(true)
    if (h.hadiah_baru?.length) setHadiah(h.hadiah_baru)
    segarkan()
  }

  return (
    <section className="kartu tumpuk ph-kartu-latihan" aria-label="Teks latihan">
      <div>
        <p className="ph-label-kecil ph-ungu">
          <span className={k.dicoba ? 'lencana' : 'lencana aktif'}>{k.dicoba ? 'Diulang' : 'Teks baru'}</span>
        </p>
        {alat.pertanyaan && <p className="ph-sub">“{alat.pertanyaan}”</p>}
        {!selesai && CARA[k.jenis] && <p className="kecil">{CARA[k.jenis]}</p>}
      </div>
      {k.jenis === 'klik' && (
        <TeksKlik tokens={tokens} celah={k.celah} jumlah={k.jumlah}
          onKlik={(t) => klikLatihan(k.id, t)} onBerhenti={() => berhentiLatihan(k.id)} onSelesai={selesaikan} />
      )}
      {k.jenis === 'gunting' && (
        <Gunting tokens={tokens} onPeriksa={(p) => periksaGuntingLatihan(k.id, p)} onSelesai={selesaikan} />
      )}
      {k.jenis === 'kembar' && (
        <DetektorKembar tokens={tokens} kataUmum={k.kata_umum} onPeriksa={(kata) => periksaKembarLatihan(k.id, kata)}
          onSelesai={selesaikan} />
      )}
      {selesai && (
        <div className="baris">
          <button type="button" className="btn-besar" onClick={onLanjut}>Teks berikutnya</button>
          <Link className="btn-besar sekunder ph-tautan-tombol" to="/alat">Selesai berlatih</Link>
        </div>
      )}
      {hadiah.length > 0 && <PerayaanHadiah hadiah={hadiah} onTutup={tutup} />}
    </section>
  )
}
