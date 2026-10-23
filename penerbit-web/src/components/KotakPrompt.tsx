import { useId, useState, type FormEvent } from 'react'
import { buatPrompt, refleksiPrompt } from '../api'
import type { Mentor } from '../types'
import TombolSalin from './TombolSalin'
import '../styles/penulis-halaman.css'

/** Rumus Bertanya 4 bagian. */
const RUMUS = [
  { label: '1. Aku sedang…', tanya: 'Apa yang sedang aku kerjakan?' },
  { label: '2. Aku bingung…', tanya: 'Bagian mana tepatnya yang belum aku pahami?' },
  { label: '3. Tolong…, jangan…', tanya: 'Bantuan seperti apa yang aku mau?' },
  { label: '4. Setelah itu aku akan…', tanya: 'Apa yang akan aku lakukan sendiri?' },
]

const CEK_MANDIRI = [
  'Apakah aku menyebut sedang mengerjakan apa?',
  'Apakah bagian yang membingungkan sudah jelas dan spesifik?',
  'Apakah aku melarang AI menuliskan jawabannya?',
]

const NAMA_TAHAP = { contoh: 'Contoh', isian: 'Isian', mandiri: 'Mandiri', tanpa: '' } as const
type Bantu = 'ya' | 'sedikit' | 'tidak'

/** Kotak Mentor AI (modul 10 ke atas): Contoh → Isian → Mandiri. */
export default function KotakPrompt({ modul, mentor }: { modul: number; mentor: Mentor }) {
  const id = useId()
  const tahap = mentor.tahap
  const [bagian, setBagian] = useState<string[]>(() =>
    tahap === 'isian' ? [0, 1, 2, 3].map((i) => mentor.isian_awal?.[i] ?? '') : ['', '', '', ''])
  const [cek, setCek] = useState<boolean[]>([false, false, false])
  const [promptId, setPromptId] = useState<number | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  const lengkap = bagian.every((b) => b.trim() !== '')
  const bolehSalin = tahap === 'contoh' || (lengkap && (tahap !== 'mandiri' || cek.every(Boolean)))
  const isi = tahap === 'contoh' ? mentor.kartu_prompt : bagian.map((b) => b.trim()).filter(Boolean).join(' ')

  async function ambilTeks(): Promise<string> {
    setGalat(null)
    try {
      const r = await buatPrompt(modul, tahap === 'contoh' ? undefined : bagian.map((b) => b.trim()))
      setPromptId(r.id)
      return r.teks
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Belum tersimpan, tapi prompt tetap disalin.')
      return `${mentor.pembuka}\n\n${isi}`
    }
  }

  function ubah(i: number, v: string) {
    setBagian((b) => b.map((x, j) => (j === i ? v : x)))
  }

  return (
    <section className="callout-ai ph-mentor" aria-label="Mentor AI">
      <span className="ai-icon" aria-hidden="true">🤖</span>
      <div className="ai-title">Mentor AI · {NAMA_TAHAP[tahap]}</div>
      {tahap === 'contoh' && <p>Ini contoh pertanyaan yang baik. Salin, lalu tempel di Gemini.</p>}
      {tahap === 'isian' && <p>Bagian 1 dan 3 sudah diisi. Lengkapi bagian 2 dan 4 dengan kata-katamu sendiri.</p>}
      {tahap === 'mandiri' && <p>Susun pertanyaanmu sendiri dengan Rumus Bertanya.</p>}

      <details className="ph-lipat" style={{ background: '#fff' }}>
        <summary>Aturan untuk AI (ikut tersalin)</summary>
        <p>{mentor.pembuka}</p>
      </details>

      {tahap !== 'contoh' && (
        <div className="ph-rumus">
          {RUMUS.map((r, i) => (
            <div key={i}>
              <label htmlFor={`${id}-b${i}`}>
                {r.label}
                <span className="tanya">{r.tanya}</span>
              </label>
              <textarea id={`${id}-b${i}`} rows={2} value={bagian[i]} onChange={(e) => ubah(i, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {tahap === 'mandiri' && lengkap && (
        <fieldset style={{ border: 0, margin: 'var(--space-3) 0' }}>
          <legend className="kecil" style={{ fontWeight: 700 }}>Cek dulu sebelum menyalin:</legend>
          {CEK_MANDIRI.map((c, i) => (
            <label key={i} className="ph-cek">
              <input type="checkbox" checked={cek[i]}
                onChange={(e) => setCek((s) => s.map((x, j) => (j === i ? e.target.checked : x)))} />
              {c}
            </label>
          ))}
        </fieldset>
      )}

      <div className="ai-prompt" aria-live="polite">
        {isi || <em>Isi keempat kotak dulu. Prompt-mu akan muncul di sini.</em>}
        <TombolSalin ambilTeks={ambilTeks} disabled={!bolehSalin} />
      </div>
      {tahap !== 'contoh' && !bolehSalin && (
        <p className="ai-tip">
          {lengkap ? 'Centang ketiga cek dulu, ya.' : 'Tombol salin aktif setelah keempat kotak terisi.'}
        </p>
      )}
      {galat && <p className="ai-tip" role="status">{galat}</p>}

      <p>
        <a className="btn btn-ghost ph-tautan-tombol" href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer">
          Buka Gemini ↗
        </a>
      </p>

      {promptId !== null && <Refleksi key={promptId} promptId={promptId} />}
    </section>
  )
}

function Refleksi({ promptId }: { promptId: number }) {
  const id = useId()
  const [bantu, setBantu] = useState<Bantu | null>(null)
  const [ubah, setUbah] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!bantu) return
    setSibuk(true)
    try {
      await refleksiPrompt(promptId, bantu, ubah.trim())
      setStatus('Refleksimu tersimpan. Terima kasih!')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Belum tersimpan. Coba lagi, ya.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <form onSubmit={simpan} aria-label="Refleksi setelah bertanya" style={{ marginTop: 'var(--space-4)' }}>
      <h4>Setelah bertanya</h4>
      <p id={`${id}-bantu`}>Apakah jawaban AI membantuku?</p>
      <div className="ph-pilih-baris" role="group" aria-labelledby={`${id}-bantu`}>
        {(['ya', 'sedikit', 'tidak'] as const).map((b) => (
          <button key={b} type="button" className="ph-pilih" aria-pressed={bantu === b} onClick={() => setBantu(b)}>
            {b === 'ya' ? 'Ya' : b === 'sedikit' ? 'Sedikit' : 'Tidak'}
          </button>
        ))}
      </div>
      <label htmlFor={`${id}-ubah`} className="kecil" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
        Apa yang akan kuubah dari pertanyaanku lain kali?
      </label>
      <input id={`${id}-ubah`} className="ph-isian" value={ubah} maxLength={300} onChange={(e) => setUbah(e.target.value)} />
      <div className="baris" style={{ marginTop: 'var(--space-2)' }}>
        <button type="submit" className="btn btn-ghost" disabled={!bantu || sibuk}>Simpan refleksi</button>
        {status && <span role="status" className="kecil">{status}</span>}
      </div>
    </form>
  )
}
