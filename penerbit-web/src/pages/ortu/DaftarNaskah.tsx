import { Link } from 'react-router-dom'
import { listNaskahOrtu } from '../../api'
import { Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import { ButuhPenulis, LAPIS, tgl, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

const namaLapis = (kode: string) => LAPIS.find((l) => l.kode === kode)?.nama ?? kode

function IsiDaftarNaskah() {
  const { penulisDipilih } = useMe()
  const { data, error } = useMuat(listNaskahOrtu, [penulisDipilih])
  // Naskah yang minta stempel di atas: itulah yang ditunggu dari Dasbor.
  const daftar = [...(data ?? [])].sort((a, b) => Number(!!b.stempel_diminta) - Number(!!a.stempel_diminta))
  return (
    <main className="page">
      <h1 className="page-title">Naskah penulis</h1>
      <Galat pesan={error} />
      {!data && !error && <Memuat />}
      {data && data.length === 0 && <p className="kecil">Belum ada naskah.</p>}
      {data && data.length > 0 && (
        <div className="gulir-x bagian-ortu">
          <table className="tabel">
            <thead>
              <tr><th>Judul</th><th>Tahap</th><th>Stempel</th><th>Dimulai</th></tr>
            </thead>
            <tbody>
              {daftar.map((n) => (
                <tr key={n.id}>
                  <td><Link to={`/ortu/naskah/${n.id}`}><b>{n.judul || '(tanpa judul)'}</b></Link></td>
                  <td>
                    {n.tahap_label}
                    {n.nomor_terbitan && <span className="nomor-terbitan"> · {n.nomor_terbitan}</span>}
                    {n.stempel_diminta && (
                      <div><span className="lencana">minta stempel {namaLapis(n.stempel_diminta)}</span></div>
                    )}
                  </td>
                  <td>
                    <span className="kecil">{n.stempel.length} dari 5 · </span>
                    {LAPIS.map((l) => (
                      <span key={l.kode} title={l.nama} style={{ marginRight: 6, whiteSpace: 'nowrap', opacity: n.stempel.includes(l.kode) ? 1 : 0.35 }}>
                        {n.stempel.includes(l.kode) ? '✓' : '○'} {l.nama}
                      </span>
                    ))}
                  </td>
                  <td>{tgl(n.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

export default function DaftarNaskah() {
  return <ButuhPenulis judul="Naskah penulis"><IsiDaftarNaskah /></ButuhPenulis>
}
