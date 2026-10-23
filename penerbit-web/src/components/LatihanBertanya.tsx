import { useState } from 'react'
import { jawabBertanya } from '../api'

const NAMA_BAGIAN = ['', 'Aku sedang…', 'Aku bingung…', 'Tolong…, jangan…', 'Setelah itu aku akan…']

type Hasil = { pilihan: 'a' | 'b'; benar: boolean; jawaban: 'a' | 'b'; bagian: number[]; penjelasan: string }

/** Modul 1–9: mana pertanyaan yang lebih baik untuk belajar? */
export default function LatihanBertanya({ modul, a, b }: { modul: number; a: string; b: string }) {
  const [hasil, setHasil] = useState<Hasil | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function pilih(p: 'a' | 'b') {
    if (hasil || sibuk) return
    setSibuk(true)
    setGalat(null)
    try {
      const r = await jawabBertanya(modul, p)
      setHasil({ pilihan: p, ...r })
    } catch {
      setGalat('Belum tersambung. Coba pilih lagi, ya.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <section className="callout-ai ph-mentor" aria-label="Latihan Bertanya">
      <span className="ai-icon" aria-hidden="true">🤖</span>
      <div className="ai-title">Latihan Bertanya · hari ini tanpa AI</div>
      <p>Mana pertanyaan yang lebih baik untuk belajar?</p>
      <div className="ph-bertanya-pilihan">
        {(['a', 'b'] as const).map((p) => {
          const kelas = hasil ? (hasil.jawaban === p ? ' correct' : hasil.pilihan === p ? ' selected' : '') : ''
          return (
            <button key={p} type="button" className={`quiz-option${kelas}`} aria-pressed={hasil?.pilihan === p}
              onClick={() => pilih(p)} disabled={!!hasil || sibuk}>
              <strong>{p.toUpperCase()}.</strong> <span>“{p === 'a' ? a : b}”</span>
            </button>
          )
        })}
      </div>
      {galat && <p className="ph-pesan" role="status">{galat}</p>}
      {hasil && (
        <div role="status" className="ph-bertanya-hasil">
          <p><strong>{hasil.benar ? 'Tepat!' : `Yang lebih baik ${hasil.jawaban.toUpperCase()}.`}</strong> {hasil.penjelasan}</p>
          {hasil.bagian.length > 0 && (
            <p className="ph-bagian-baris">
              Bagian Rumus Bertanya di sana:{' '}
              {hasil.bagian.map((n) => <span key={n} className={`ph-bagian b${n}`}>{NAMA_BAGIAN[n]}</span>)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
