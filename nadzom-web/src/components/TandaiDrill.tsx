import { useMemo, useState } from 'react'
import { kitabahBait } from '@/lib/kitabah'
import TandaiBit from './TandaiBit'
import Teks from './Teks'

/** Drill memberi tanda 1/0: kata atau frasa pendek satu per satu, dengan hitungan yang sudah benar. */
export default function TandaiDrill({ petunjuk, butir }: { petunjuk: string; butir: string[] }) {
  const huruf = useMemo(() => butir.map((b) => {
    const k = kitabahBait([b], { tanpaAkhir: true })
    return k.ok ? k.syathr[0] : null
  }), [butir])
  const [ke, setKe] = useState(0)
  const [benar, setBenar] = useState<boolean[]>(() => butir.map(() => false))
  const h = huruf[ke]
  const jumlahBenar = benar.filter(Boolean).length

  return (
    <div className="tumpuk">
      <p><Teks>{petunjuk}</Teks></p>
      <div className="baris-antara">
        <span className="label">Butir {ke + 1} dari {butir.length}: <span className="ar-in" lang="ar">{butir[ke]}</span></span>
        <span className={`chip ${jumlahBenar === butir.length ? 'ok' : ''}`}>{jumlahBenar} benar</span>
      </div>
      {h ? (
        <TandaiBit key={ke} huruf={h} onBenar={() => setBenar((b) => b.map((v, i) => v || i === ke))} />
      ) : (
        <div className="pesan salah">Butir ini belum berharakat lengkap.</div>
      )}
      <div className="baris">
        <button type="button" className="tombol" onClick={() => setKe(ke - 1)} disabled={ke === 0}>Butir sebelumnya</button>
        <button type="button" className={`tombol${benar[ke] ? ' utama' : ''}`} onClick={() => setKe(ke + 1)} disabled={ke === butir.length - 1}>
          Butir berikutnya
        </button>
      </div>
    </div>
  )
}
