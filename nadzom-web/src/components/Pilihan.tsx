import { useState } from 'react'
import Teks from './Teks'

interface Props {
  soal?: string
  pilihan: string[]
  jawaban: number
  alasan?: string
  /** Pilihan berupa teks Arab panjang (kitabah): ditampilkan besar dan RTL. */
  arab?: boolean
  onBenar?: () => void
  /** Dipanggil sekali saat jawaban benar ditemukan; `pertama` = benar tanpa salah. */
  onSelesai?: (pertama: boolean) => void
}

const HURUF = 'abcdefgh'

/** Pilihan ganda: salah boleh dicoba lagi; benar membuka alasannya. */
export default function Pilihan({ soal, pilihan, jawaban, alasan, arab, onBenar, onSelesai }: Props) {
  const [salah, setSalah] = useState<number[]>([])
  const [benar, setBenar] = useState(false)

  const pilih = (i: number) => {
    if (benar) return
    if (i === jawaban) {
      setBenar(true)
      onBenar?.()
      onSelesai?.(salah.length === 0)
    } else if (!salah.includes(i)) {
      setSalah([...salah, i])
    }
  }

  return (
    <div className="tumpuk">
      {soal && <p><Teks>{soal}</Teks></p>}
      <div className="pilihan" role="group">
        {pilihan.map((p, i) => {
          const kelas = benar && i === jawaban ? 'benar' : salah.includes(i) ? 'salah' : ''
          return (
            <button key={i} type="button" className={kelas} onClick={() => pilih(i)} disabled={benar || salah.includes(i)}>
              <span className="huruf-pilihan" aria-hidden="true">{HURUF[i]}</span>
              {arab ? <span className="ar-pilihan" lang="ar">{p}</span> : <span><Teks>{p}</Teks></span>}
            </button>
          )
        })}
      </div>
      {benar && alasan && <div className="pesan ok"><Teks>{alasan}</Teks></div>}
      {!benar && salah.length > 0 && <div className="pesan salah">Belum tepat. Coba pilihan lain.</div>}
    </div>
  )
}
