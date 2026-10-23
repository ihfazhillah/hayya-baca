import { useState } from 'react'
import type { SoalPilih } from '@/content/jenis'
import Pilihan from './Pilihan'
import Teks from './Teks'

/** Set soal pilihan ganda: semua soal di satu kartu, skor dihitung dari jawaban benar pada percobaan pertama. */
export default function Kenali({ petunjuk, soal }: { petunjuk: string; soal: SoalPilih[] }) {
  const [hasil, setHasil] = useState<(boolean | null)[]>(() => soal.map(() => null))
  const selesai = hasil.filter((x) => x !== null).length
  const pertama = hasil.filter((x) => x === true).length

  return (
    <div className="tumpuk">
      <p><Teks>{petunjuk}</Teks></p>
      <ol className="soal-daftar">
        {soal.map((s, i) => (
          <li key={i}>
            <Pilihan {...s} onSelesai={(p) => setHasil((h) => h.map((v, k) => (k === i ? p : v)))} />
          </li>
        ))}
      </ol>
      <div className="baris">
        <span className={`chip ${selesai === soal.length ? 'ok' : ''}`}>{selesai} dari {soal.length} soal</span>
        {selesai === soal.length && <span className="redup kecil">Benar pada percobaan pertama: {pertama} dari {soal.length}.</span>}
      </div>
    </div>
  )
}
