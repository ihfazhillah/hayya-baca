import { useState } from 'react'
import { jawabBertanya } from '../api'

const NAMA_BAGIAN = ['', 'Aku sedang…', 'Aku bingung…', 'Tolong…, jangan…', 'Setelah itu aku akan…']

/** Modul 1–9: mana pertanyaan yang lebih baik untuk belajar? */
export default function LatihanBertanya({ modul, a, b }: { modul: number; a: string; b: string }) {
  const [hasil, setHasil] = useState<{ pilihan: 'a' | 'b'; benar: boolean; jawaban: 'a' | 'b'; bagian: number[]; penjelasan: string } | null>(null)
  async function pilih(p: 'a' | 'b') {
    if (hasil) return
    const r = await jawabBertanya(modul, p)
    setHasil({ pilihan: p, ...r })
  }
  return (
    <section className="callout-ai" aria-label="Latihan Bertanya">
      <span className="ai-icon" aria-hidden="true">🤖</span>
      <div className="ai-title">Latihan Bertanya · hari ini tanpa AI</div>
      <p>Mana pertanyaan yang lebih baik untuk belajar?</p>
      {(['a', 'b'] as const).map((p) => (
        <button key={p} type="button" className="quiz-option" aria-pressed={hasil?.pilihan === p}
          onClick={() => pilih(p)} disabled={!!hasil}
          style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 'var(--space-2)' }}>
          <strong>{p.toUpperCase()}.</strong> “{p === 'a' ? a : b}”
        </button>
      ))}
      {hasil && (
        <div role="status">
          <p><strong>{hasil.benar ? 'Tepat!' : `Yang lebih baik ${hasil.jawaban.toUpperCase()}.`}</strong> {hasil.penjelasan}</p>
          <p className="ai-tip">Bagian Rumus Bertanya di sana: {hasil.bagian.map((n) => NAMA_BAGIAN[n]).join(' · ')}</p>
        </div>
      )}
    </section>
  )
}
