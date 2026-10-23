import { useEffect, useId, useState, type FormEvent } from 'react'
import { getKartuPamer, simpanKartuPamer } from '../api'
import type { KartuPamerModul } from '../types'
import Perekam from './Perekam'
import { Galat } from './ui'

/** Kartu Pamer di akhir halaman modul (Spec 075 K3). Tidak mengunci modul berikutnya.
 *  Rekaman suara memakai Perekam: hanya ada di tablet, tidak dikirim ke mana pun. */
export default function KartuPamer({ modul }: { modul: number }) {
  const [data, setData] = useState<KartuPamerModul | null>(null)
  const [pelajaran, setPelajaran] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [tunjukkan, setTunjukkan] = useState(false)
  const id = useId()

  useEffect(() => {
    let aktif = true
    getKartuPamer(modul)
      .then((d) => {
        if (!aktif) return
        setData(d)
        setPelajaran(d.kartu?.pelajaran ?? '')
      })
      .catch(() => { /* Kartu Pamer bukan syarat: diam saja bila gagal dimuat. */ })
    return () => { aktif = false }
  }, [modul])

  if (!data) return null

  async function simpan(e: FormEvent) {
    e.preventDefault()
    setSibuk(true)
    setGalat(null)
    try {
      const kartu = await simpanKartuPamer(modul, pelajaran.trim())
      setData((d) => (d ? { ...d, kartu } : d))
      setPelajaran(kartu.pelajaran)
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err))
    } finally {
      setSibuk(false)
    }
  }

  const kartu = data.kartu
  const berubah = pelajaran.trim() !== (kartu?.pelajaran ?? '')
  return (
    <section className={`kartu ph-pamer${tunjukkan ? ' ph-pamer-tunjuk' : ''}`} aria-labelledby={`${id}-judul`}>
      <h2 id={`${id}-judul`} className="ph-judul-bagian">Kartu Pamer</h2>
      {!data.tersedia ? (
        <p className="kecil">Selesaikan misinya dulu. Setelah itu kamu bisa memamerkan hasilmu di sini.</p>
      ) : (
        <>
          <p>Tunjukkan apa yang kamu bisa sekarang!</p>
          {data.hasil && (
            <div className="ph-pamer-dua">
              <figure>
                <figcaption>Sebelum</figcaption>
                <p>{data.hasil.sebelum}</p>
              </figure>
              <figure>
                <figcaption>Sesudah kamu betulkan</figcaption>
                <p>{data.hasil.sesudah}</p>
              </figure>
            </div>
          )}
          <form onSubmit={simpan} className="tumpuk">
            <label htmlFor={`${id}-pelajaran`}>Yang aku pelajari</label>
            <input id={`${id}-pelajaran`} type="text" value={pelajaran} maxLength={300}
              placeholder="Tulis satu kalimat." onChange={(e) => setPelajaran(e.target.value)} />
            <div className="baris">
              <button type="submit" className="btn btn-primary" disabled={sibuk || !pelajaran.trim() || !berubah}>
                Simpan kartu
              </button>
              {kartu && !berubah && <span className="kecil">Tersimpan.</span>}
            </div>
            <Galat pesan={galat} />
          </form>
          <details className="ph-lipat">
            <summary>Ceritakan dengan suaramu (boleh dilewati)</summary>
            <p className="kecil">Rekamanmu hanya ada di tablet ini. Tidak dikirim ke mana-mana.</p>
            <Perekam />
          </details>
          {kartu?.reaksi_pada || kartu?.reaksi_emoji || kartu?.reaksi ? (
            <p className="ph-kutip">
              {kartu.reaksi_oleh ?? 'Ayah atau Ummah'}: {kartu.reaksi_emoji}{kartu.reaksi && ` “${kartu.reaksi}”`}
            </p>
          ) : null}
          {kartu && (
            tunjukkan ? (
              <div className="callout callout-info" role="status">
                <span className="callout-icon" aria-hidden="true">🎉</span>
                <div className="callout-content">
                  <p>Panggil Ayah atau Ummah, lalu tunjukkan kartu ini. Ceritakan apa yang kamu pelajari.</p>
                  <button type="button" className="btn btn-ghost" onClick={() => setTunjukkan(false)}>Selesai</button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-besar sekunder" onClick={() => setTunjukkan(true)}>
                Tunjukkan ke Ayah atau Ummah
              </button>
            )
          )}
        </>
      )}
    </section>
  )
}
