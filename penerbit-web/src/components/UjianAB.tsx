import { useState } from 'react'
import { jawabUjian } from '../api'

type Soal = { id: number; soal: string; a: string; b: string }

/** Ujian A atau B: pilih, lalu muncul penjelasan singkat. Tidak ada merah. */
export default function UjianAB({ soal, jawab = jawabUjian }: {
  soal: Soal[]
  jawab?: typeof jawabUjian
}) {
  const [hasil, setHasil] = useState<Record<number, { pilihan: 'a' | 'b'; benar: boolean; jawaban: 'a' | 'b'; alasan: string }>>({})
  async function pilih(s: Soal, pilihan: 'a' | 'b') {
    if (hasil[s.id]) return
    const r = await jawab(s.id, pilihan)
    setHasil((h) => ({ ...h, [s.id]: { pilihan, ...r } }))
  }
  return (
    <section className="quiz-container tumpuk" aria-label="Ujian">
      {soal.map((s, n) => {
        const h = hasil[s.id]
        return (
          <div key={s.id} className="quiz-question-block tumpuk">
            <p className="quiz-question"><strong>Ujian {n + 1} dari {soal.length}.</strong> {s.soal}</p>
            {(['a', 'b'] as const).map((p) => (
              <button key={p} type="button" className={`quiz-option${h && h.jawaban === p ? ' correct' : ''}`}
                aria-pressed={h?.pilihan === p} onClick={() => pilih(s, p)} disabled={!!h}
                style={{ display: 'block', width: '100%', textAlign: 'left' }}>
                <strong>{p.toUpperCase()}.</strong> {p === 'a' ? s.a : s.b}
                {h && h.jawaban === p && ' · Betul!'}
              </button>
            ))}
            {h && <p className="quiz-feedback" role="status">{h.benar ? 'Tepat! ' : 'Belum, jawabannya ' + h.jawaban.toUpperCase() + '. '}{h.alasan}</p>}
          </div>
        )
      })}
    </section>
  )
}
