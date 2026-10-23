import { useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getLembarCetak } from '../../api'
import LembarA4 from '../../components/LembarA4'
import { Galat, Memuat } from '../../components/ui'
import { TautanPulang, useMuat } from '../ortu/umum'
import '../../styles/ortu-halaman.css'

export default function LembarCetak() {
  const kode = useParams().kode ?? ''
  const { data, error } = useMuat(() => getLembarCetak(kode), [kode])
  const sudah = useRef<string | null>(null)
  // ?lihat=1: hanya melihat lembar (dari halaman Pemeriksaan), tanpa membuka dialog cetak.
  const lihat = useSearchParams()[0].has('lihat')

  useEffect(() => {
    if (!data || sudah.current === data.kode) return
    document.title = `Lembar ${data.kode} · Penerbit Rumah`
    if (lihat) return
    // Beri waktu satu frame agar halaman tergambar sebelum dialog cetak.
    const t = setTimeout(() => {
      sudah.current = data.kode
      window.print()
    }, 50)
    return () => clearTimeout(t)
  }, [data, lihat])

  return (
    <main className="page">
      <div className="tidak-dicetak baris" style={{ justifyContent: 'space-between', maxWidth: 794, margin: '0 auto var(--space-4)' }}>
        <TautanPulang />
        {data && <button type="button" className="btn btn-ghost" onClick={() => window.print()}>🖨️ {lihat ? 'Cetak' : 'Cetak lagi'}</button>}
      </div>
      <Galat pesan={error} />
      {!data && !error && <Memuat />}
      {data && <LembarA4 lembar={data} />}
    </main>
  )
}
