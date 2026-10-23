import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listIde, naskahBaru, tambahIde } from '../../api'
import type { Ide, Peta4 } from '../../types'
import { Galat, KepalaHalaman, Memuat } from '../../components/ui'
import { BintangIde } from './RuangPenulis'
import '../../editor/editor.css'

export const KOTAK_PETA: { kunci: keyof Peta4; label: string; contoh: string }[] = [
  { kunci: 'siapa', label: 'Siapa?', contoh: 'Raka dan kakaknya, berdua di rumah sore hari.' },
  { kunci: 'mau_apa', label: 'Mau apa?', contoh: 'Menyelesaikan PR sebelum magrib.' },
  { kunci: 'masalah', label: 'Ada masalah apa?', contoh: 'Hujan deras, lalu listrik padam.' },
  { kunci: 'akhir', label: 'Bagaimana akhirnya?', contoh: 'Mereka belajar dengan senter dan malah tertawa.' },
]

const IDE_BARU = 'baru'

export default function NaskahBaru() {
  const nav = useNavigate()
  const [ide, setIde] = useState<Ide[] | null>(null)
  const [pilih, setPilih] = useState<string>('')
  const [ideBaru, setIdeBaru] = useState('')
  const [peta, setPeta] = useState<Peta4>({})
  const [judul, setJudul] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [mengirim, setMengirim] = useState(false)

  useEffect(() => {
    listIde()
      .then((d) => {
        setIde(d)
        if (!d.length) setPilih(IDE_BARU)
      })
      .catch((e: Error) => setGalat(e.message))
  }, [])

  const mulai = async () => {
    if (!judul.trim()) return
    setMengirim(true)
    setGalat(null)
    try {
      let ideId: number | null = null
      if (pilih === IDE_BARU) {
        if (ideBaru.trim()) ideId = (await tambahIde(ideBaru.trim(), '')).id
      } else if (pilih) ideId = Number(pilih)
      const isiPeta = Object.fromEntries(
        Object.entries(peta).map(([k, v]) => [k, (v ?? '').trim()]).filter(([, v]) => v),
      ) as Peta4
      const n = await naskahBaru({ judul: judul.trim(), ide: ideId, peta: isiPeta })
      nav(`/naskah/${n.id}/draf-nol`)
    } catch (e) {
      setGalat((e as Error).message)
      setMengirim(false)
    }
  }

  const terisi = KOTAK_PETA.filter((k) => (peta[k.kunci] ?? '').trim()).length

  return (
    <main className="page">
      <div className="layar tumpuk">
        <KepalaHalaman judul="Cerita baru" sub="Tiga langkah kecil sebelum mulai menulis." />

        <section aria-labelledby="langkah-1">
          <h2 id="langkah-1" className="langkah-judul">1. Pilih ide</h2>
          {!ide && !galat && <Memuat />}
          <div role="radiogroup" aria-labelledby="langkah-1">
            {ide?.map((i) => (
              <label key={i.id} className="pilihan-ide">
                <input type="radio" name="ide" value={i.id} checked={pilih === String(i.id)}
                  onChange={() => setPilih(String(i.id))} />
                <span style={{ flex: 1 }}>{i.teks}</span>
                <BintangIde ide={i} />
              </label>
            ))}
            <label className="pilihan-ide">
              <input type="radio" name="ide" value={IDE_BARU} checked={pilih === IDE_BARU}
                onChange={() => setPilih(IDE_BARU)} />
              <span>Tulis ide baru</span>
            </label>
          </div>
          {pilih === IDE_BARU && (
            <>
              <label className="sr-only" htmlFor="ide-baru-naskah">Ide baru</label>
              <input id="ide-baru-naskah" className="isian" placeholder="Tulis ide baru…" value={ideBaru}
                maxLength={300} onChange={(e) => setIdeBaru(e.target.value)} />
            </>
          )}
        </section>

        <section aria-labelledby="langkah-2">
          <div className="baris" style={{ justifyContent: 'space-between' }}>
            <h2 id="langkah-2" className="langkah-judul">2. Peta 4 Kotak</h2>
            <a href="/cetak/PETA-4-KOTAK" target="_blank" rel="noopener">🖨️ Lebih suka di kertas? Cetak petanya</a>
          </div>
          <p className="kecil" style={{ marginBottom: 'var(--space-3)' }}>Satu kalimat saja di setiap kotak.</p>
          <div className="peta4">
            {KOTAK_PETA.map((k) => (
              <div key={k.kunci} className="kotak">
                <label className="label-isian" htmlFor={`peta-${k.kunci}`}>{k.label}</label>
                <textarea id={`peta-${k.kunci}`} className="isian" placeholder={k.contoh} rows={2}
                  spellCheck={false} value={peta[k.kunci] ?? ''}
                  onChange={(e) => setPeta((p) => ({ ...p, [k.kunci]: e.target.value }))} />
              </div>
            ))}
          </div>
          {terisi > 0 && terisi < 4 && <p className="kecil" style={{ marginTop: 'var(--space-2)' }}>{terisi} dari 4 kotak terisi.</p>}
        </section>

        <section aria-labelledby="langkah-3">
          <h2 id="langkah-3" className="langkah-judul">3. Judul sementara</h2>
          <label className="sr-only" htmlFor="judul-sementara">Judul sementara</label>
          <input id="judul-sementara" className="isian" placeholder="Judul sementara" value={judul} maxLength={150}
            spellCheck={false} onChange={(e) => setJudul(e.target.value)} />
          <p className="kecil" style={{ marginTop: 'var(--space-2)' }}>Judul boleh diganti kapan saja, nanti saat mau terbit.</p>
        </section>

        <Galat pesan={galat} />
        <button type="button" className="btn-besar" disabled={!judul.trim() || mengirim} onClick={mulai}>
          {mengirim ? 'Menyiapkan…' : 'Mulai Draf Nol'}
        </button>
      </div>
    </main>
  )
}
