import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getLembarCetak } from '../../api'
import LembarA4 from '../../components/LembarA4'
import { Galat, Memuat } from '../../components/ui'
import { TautanPulang, useMuat } from '../ortu/umum'
import '../../styles/ortu-halaman.css'

export default function LembarCetak() {
  const kode = useParams().kode ?? ''
  const { data, error } = useMuat(() => getLembarCetak(kode), [kode])
  const sudah = useRef<string | null>(null)

  useEffect(() => {
    if (!data || sudah.current === data.kode) return
    document.title = `Lembar ${data.kode} · Penerbit Rumah`
    // Beri waktu satu frame agar halaman tergambar sebelum dialog cetak.
    const t = setTimeout(() => {
      sudah.current = data.kode
      window.print()
    }, 50)
    return () => clearTimeout(t)
  }, [data])

  return (
    <main className="page">
      <div className="tidak-dicetak baris" style={{ justifyContent: 'space-between', maxWidth: 794, margin: '0 auto var(--space-4)' }}>
        <TautanPulang />
        {data && <button type="button" className="btn btn-ghost" onClick={() => window.print()}>🖨️ Cetak lagi</button>}
      </div>
      <Galat pesan={error} />
      {!data && !error && <Memuat />}
      {data && <LembarA4 lembar={data} />}
    </main>
  )
}
