import { Link, useSearchParams } from 'react-router-dom'
import { listPemeriksaan } from '../../api'
import { Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import { ButuhPenulis, STATUS_LEMBAR, tglJam, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

function IsiDaftarLembar() {
  const { penulisDipilih } = useMe()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'menunggu'
  const kode = params.get('kode') ?? ''
  const { data, error } = useMuat(
    () => listPemeriksaan({ status: status === 'semua' ? undefined : status, kode: kode.trim() || undefined }),
    [status, kode, penulisDipilih],
  )
  const ubah = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }
  const daftar = [...(data ?? [])].sort((a, b) => b.tanggal_cetak.localeCompare(a.tanggal_cetak))

  return (
    <main className="page">
      <h1 className="page-title">Pemeriksaan lembar</h1>
      <div className="saringan" role="search">
        <label>
          Cari kode di kertas
          <input type="search" className="isian" value={kode} placeholder="mis. M4-3"
            onChange={(e) => ubah('kode', e.target.value)} />
        </label>
        <label>
          Status
          <select className="isian" value={status} onChange={(e) => ubah('status', e.target.value)}>
            <option value="menunggu">Menunggu</option>
            <option value="coba_lagi">Coba lagi</option>
            <option value="bagus">Sudah bagus</option>
            <option value="semua">Semua</option>
          </select>
        </label>
      </div>
      <Galat pesan={error} />
      {!data && !error && <Memuat />}
      {data && (
        daftar.length === 0 ? (
          <p className="kecil">
            {status === 'menunggu' && !kode ? 'Tidak ada lembar yang menunggu diperiksa.' : 'Tidak ada lembar yang cocok.'}
            {kode.trim() && status !== 'semua' && (
              <>
                {' '}
                <button type="button" className="btn btn-ghost btn-kecil" onClick={() => ubah('status', 'semua')}>
                  Cari di semua status
                </button>
              </>
            )}
          </p>
        ) : (
          <div className="gulir-x">
            <p className="kecil">{daftar.length} lembar</p>
            <table className="tabel">
              <thead>
                <tr><th>Kode</th><th>Lembar</th><th>Modul</th><th>Dicetak</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {daftar.map((p) => (
                  <tr key={p.id}>
                    <td className="mono"><b>{p.kode}</b></td>
                    <td>{p.judul}</td>
                    <td>{p.modul}</td>
                    <td className="mono kecil">{tglJam(p.tanggal_cetak)}</td>
                    <td>{STATUS_LEMBAR[p.status] ?? p.status}{p.diperiksa_oleh ? ` · ${p.diperiksa_oleh}` : ''}</td>
                    <td className="aksi"><Link to={`/ortu/lembar/${p.id}`}>{p.status === 'menunggu' ? 'Periksa' : 'Lihat'}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </main>
  )
}

export default function DaftarLembar() {
  return <ButuhPenulis judul="Pemeriksaan lembar"><IsiDaftarLembar /></ButuhPenulis>
}
