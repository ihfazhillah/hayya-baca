import { useState, type FormEvent } from 'react'
import { getHadiahOrtu, putuskanPenukaran, tambahHadiah, ubahHadiah } from '../../api'
import { Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import type { HadiahItem } from '../../types'
import { ButuhPenulis, labelMinggu, pesanGalat, tgl, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

const NAMA_STATUS = { diajukan: 'Diajukan', disetujui: 'Disetujui', ditunda: 'Nanti dulu' } as const

function BarisHadiah({ h, aksi, sibuk }: { h: HadiahItem; aksi: (fn: () => Promise<unknown>) => void; sibuk: boolean }) {
  const [nama, setNama] = useState(h.nama)
  const [harga, setHarga] = useState(String(h.harga))
  const aktif = h.aktif !== false
  const berubah = nama.trim() !== h.nama || Number(harga) !== h.harga
  return (
    <tr style={aktif ? undefined : { opacity: 0.55 }}>
      <td><input className="isian" type="text" aria-label="Nama hadiah" value={nama} onChange={(e) => setNama(e.target.value)} /></td>
      <td><input className="isian" type="number" min={1} aria-label={`Harga ${h.nama}`} style={{ width: 90 }} value={harga}
        onChange={(e) => setHarga(e.target.value)} /></td>
      <td>{aktif ? 'Aktif' : 'Nonaktif'}</td>
      <td className="aksi">
        <button type="button" className="btn btn-ghost btn-kecil" disabled={sibuk || !berubah || !nama.trim() || Number(harga) <= 0}
          onClick={() => aksi(() => ubahHadiah(h.id, { nama: nama.trim(), harga: Number(harga) }))}>Simpan</button>
        <button type="button" className="btn btn-ghost btn-kecil" disabled={sibuk}
          onClick={() => aksi(() => ubahHadiah(h.id, { aktif: !aktif }))}>{aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
      </td>
    </tr>
  )
}

function IsiHadiahPoin() {
  const { penulisDipilih } = useMe()
  const { data, error, muat } = useMuat(getHadiahOrtu, [penulisDipilih])
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [nama, setNama] = useState('')
  const [harga, setHarga] = useState('')

  const aksi = async (fn: () => Promise<unknown>) => {
    setSibuk(true)
    setGalat(null)
    try {
      await fn()
      await muat()
      return true
    } catch (e) {
      setGalat(pesanGalat(e))
      return false
    } finally {
      setSibuk(false)
    }
  }

  const tambah = async (e: FormEvent) => {
    e.preventDefault()
    if (!nama.trim() || !(Number(harga) > 0)) return setGalat('Isi nama dan harga hadiah.')
    if (await aksi(() => tambahHadiah(nama.trim(), Number(harga)))) {
      setNama('')
      setHarga('')
    }
  }

  if (error) return <main className="page"><h1 className="page-title">Hadiah dan poin</h1><Galat pesan={error} /></main>
  if (!data) return <main className="page"><h1 className="page-title">Hadiah dan poin</h1><Memuat /></main>
  const diajukan = data.penukaran.filter((p) => p.status !== 'disetujui')
  const selesai = data.penukaran.filter((p) => p.status === 'disetujui')

  return (
    <main className="page">
      <h1 className="page-title">Hadiah dan poin</h1>
      <p className="kecil">Poin sekarang: <b>{data.total}</b></p>
      <Galat pesan={galat} />

      <section className="bagian-ortu" aria-label="Penukaran">
        <h2 className="judul-bagian">Penukaran yang diajukan</h2>
        {diajukan.length === 0 ? (
          <p className="kecil">Tidak ada penukaran yang menunggu.</p>
        ) : (
          <div className="gulir-x">
          <table className="tabel">
            <thead><tr><th>Hadiah</th><th>Harga</th><th>Tanggal</th><th>Status</th><th /></tr></thead>
            <tbody>
              {diajukan.map((p) => (
                <tr key={p.id}>
                  <td>{p.hadiah}</td>
                  <td>{p.harga ?? ''}</td>
                  <td>{tgl(p.tanggal)}</td>
                  <td>
                    {NAMA_STATUS[p.status]}
                    {p.harga != null && data.total < p.harga && <div className="kecil">poin belum cukup</div>}
                  </td>
                  <td className="aksi">
                    <button type="button" className="btn btn-primary btn-kecil" disabled={sibuk}
                      onClick={() => void aksi(() => putuskanPenukaran(p.id, 'disetujui'))}>Setujui</button>
                    {p.status === 'diajukan' && (
                      <button type="button" className="btn btn-ghost btn-kecil" disabled={sibuk}
                        onClick={() => void aksi(() => putuskanPenukaran(p.id, 'ditunda'))}>Nanti dulu</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {selesai.length > 0 && (
          <p className="kecil">Sudah disetujui: {selesai.map((p) => `${p.hadiah} (${tgl(p.tanggal)})`).join(', ')}</p>
        )}
      </section>

      <section className="bagian-ortu" aria-label="Daftar hadiah">
        <h2 className="judul-bagian">Daftar hadiah</h2>
        {data.hadiah.length === 0 && <p className="kecil">Belum ada hadiah. Tambahkan hadiah yang bisa ditukar dengan poin.</p>}
        {data.hadiah.length > 0 && (
          <div className="gulir-x">
          <table className="tabel">
            <thead><tr><th>Hadiah</th><th>Harga (poin)</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.hadiah.map((h) => (
                <BarisHadiah key={`${h.id}-${h.nama}-${h.harga}-${h.aktif}`} h={h} sibuk={sibuk} aksi={(fn) => void aksi(fn)} />
              ))}
            </tbody>
          </table>
          </div>
        )}
        <form className="baris form-hadiah" onSubmit={tambah}>
          <input className="isian" type="text" aria-label="Nama hadiah baru" placeholder="Hadiah baru" value={nama}
            onChange={(e) => setNama(e.target.value)} />
          <input className="isian" type="number" min={1} aria-label="Harga hadiah baru" placeholder="Poin" style={{ width: 100 }}
            value={harga} onChange={(e) => setHarga(e.target.value)} />
          <button className="btn btn-ghost" disabled={sibuk}>Tambah hadiah</button>
        </form>
      </section>

      <section className="bagian-ortu" aria-label="Riwayat poin">
        <h2 className="judul-bagian">Riwayat poin</h2>
        {data.riwayat_poin.length === 0 && <p className="kecil">Belum ada poin.</p>}
        {data.riwayat_poin.map((m) => (
          <details key={m.minggu} open={m === data.riwayat_poin[0]}>
            <summary><b>Minggu {labelMinggu(m.minggu)}</b> · {m.total >= 0 ? '+' : ''}{m.total} poin</summary>
            <table className="tabel riwayat-poin">
              <tbody>
                {m.baris.map((b, i) => (
                  <tr key={i}>
                    <td style={{ width: 90 }}>{tgl(b.tanggal)}</td>
                    <td className="mono" style={{ width: 70 }}>{b.jumlah > 0 ? `+${b.jumlah}` : b.jumlah}</td>
                    <td>{b.alasan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </section>
    </main>
  )
}

export default function HadiahPoin() {
  return <ButuhPenulis judul="Hadiah dan poin"><IsiHadiahPoin /></ButuhPenulis>
}
