import { Link } from 'react-router-dom'
import { listNaskahOrtu } from '../../api'
import { Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import { LAPIS, tgl, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

export default function DaftarNaskah() {
  const { penulisDipilih } = useMe()
  const { data, error } = useMuat(listNaskahOrtu, [penulisDipilih])
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
              {data.map((n) => (
                <tr key={n.id}>
                  <td><Link to={`/ortu/naskah/${n.id}`}><b>{n.judul || '(tanpa judul)'}</b></Link></td>
                  <td>
                    {n.tahap_label}
                    {n.nomor_terbitan && <span className="nomor-terbitan"> · {n.nomor_terbitan}</span>}
                  </td>
                  <td>
                    <span className="kecil">{n.stempel.length} dari 5 · </span>
                    {LAPIS.map((l) => (
                      <span key={l.kode} title={l.nama} style={{ marginRight: 6, opacity: n.stempel.includes(l.kode) ? 1 : 0.35 }}>
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
