import { useState } from 'react'
import { jawabUjian } from '../api'

type Soal = { id: number; soal: string; a: string; b: string }
type Hasil = { pilihan: 'a' | 'b'; benar: boolean; jawaban: 'a' | 'b'; alasan: string }

/** Ujian A atau B: pilih, lalu muncul penjelasan singkat. Tidak ada merah:
 *  jawaban benar hijau, pilihan anak yang belum tepat cukup ditandai ungu. */
export default function UjianAB({ soal, jawab = jawabUjian }: {
  soal: Soal[]
  jawab?: typeof jawabUjian
}) {
  const [hasil, setHasil] = useState<Record<number, Hasil>>({})
  const [sibuk, setSibuk] = useState<number | null>(null)
  const [galat, setGalat] = useState<Record<number, string>>({})

  async function pilih(s: Soal, pilihan: 'a' | 'b') {
    if (hasil[s.id] || sibuk !== null) return
    setSibuk(s.id)
    setGalat((g) => ({ ...g, [s.id]: '' }))
    try {
      const r = await jawab(s.id, pilihan)
      setHasil((h) => ({ ...h, [s.id]: { pilihan, ...r } }))
    } catch {
      setGalat((g) => ({ ...g, [s.id]: 'Belum tersambung. Coba pilih lagi, ya.' }))
    } finally {
      setSibuk(null)
    }
  }

  return (
    <section className="quiz-container ph-ujian" aria-label="Ujian">
      {soal.map((s, n) => {
        const h = hasil[s.id]
        return (
          <div key={s.id} className="quiz-question-block">
            <p className="quiz-question">Ujian {n + 1} dari {soal.length}. {s.soal}</p>
            <div className="quiz-options">
              {(['a', 'b'] as const).map((p) => {
                const kelas = h ? (h.jawaban === p ? ' correct' : h.pilihan === p ? ' selected' : '') : ''
                return (
                  <button key={p} type="button" className={`quiz-option${kelas}`}
                    aria-pressed={h?.pilihan === p} onClick={() => pilih(s, p)} disabled={!!h || sibuk !== null}>
                    <strong>{p.toUpperCase()}.</strong> <span>{p === 'a' ? s.a : s.b}</span>
                    {h && h.jawaban === p && <span className="ph-betul">Betul!</span>}
                  </button>
                )
              })}
            </div>
            {h && (
              <p className={`quiz-feedback show${h.benar ? ' success' : ' ph-netral'}`} role="status">
                {h.benar ? 'Tepat! ' : `Belum, jawabannya ${h.jawaban.toUpperCase()}. `}{h.alasan}
              </p>
            )}
            {galat[s.id] && <p className="ph-pesan" role="status">{galat[s.id]}</p>}
          </div>
        )
      })}
    </section>
  )
}
