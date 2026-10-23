import { useId, useRef, useState } from 'react'
import type { HasilBait } from '@/lib/jenis'
import { diwanMarkdown } from '@/lib/latihan'

type Props =
  | { bait: string[]; hasil: HasilBait; judulAwal?: string; buatMd?: never }
  | { buatMd: (judul: string) => string; judulAwal?: string; bait?: never; hasil?: never }

/** Salin bait + pola + jumlah patah sebagai Markdown. Aplikasi tidak menyimpan apa pun. */
export default function SalinDiwan({ bait, hasil, buatMd, judulAwal = 'Bait' }: Props) {
  const id = useId()
  const [judul, setJudul] = useState(judulAwal)
  const [status, setStatus] = useState<'diam' | 'tersalin' | 'manual'>('diam')
  const area = useRef<HTMLTextAreaElement>(null)
  const md = buatMd ? buatMd(judul) : diwanMarkdown(judul, bait!, hasil!)

  const salin = () => {
    navigator.clipboard.writeText(md).then(
      () => setStatus('tersalin'),
      () => {
        setStatus('manual')
        requestAnimationFrame(() => area.current?.select())
      },
    )
  }

  return (
    <div className="kartu">
      <div className="baris-antara">
        <span className="label">Salin ke Diwan</span>
        {status === 'tersalin' && <span className="chip ok">Tersalin</span>}
      </div>
      <div className="baris">
        <div className="isian" style={{ flex: '1 1 220px' }}>
          <label htmlFor={id}>Judul di Diwan</label>
          <input id={id} type="text" value={judul} onChange={(e) => { setJudul(e.target.value); setStatus('diam') }} />
        </div>
        <button type="button" className="tombol utama" onClick={salin} style={{ alignSelf: 'flex-end' }}>
          Salin Markdown
        </button>
      </div>
      <p className="redup kecil">Tempel di Obsidian, catatan HP, atau tulis ulang di kertas.</p>
      {status === 'manual' && (
        <textarea ref={area} readOnly rows={8} value={md} aria-label="Teks untuk Diwan" />
      )}
    </div>
  )
}
