import { useCallback, useEffect, useState } from 'react'
import { ajukanPenukaran, getPenukaran } from '../../api'
import type { HadiahItem, PenukaranItem } from '../../types'
import { Galat, KepalaHalaman, Memuat } from '../../components/ui'
import { useNavPenulis } from '../../components/LayoutPenulis'
import '../../styles/penulis-halaman.css'

type Data = { total: number; hadiah: HadiahItem[]; penukaran: PenukaranItem[] }

const STATUS: Record<PenukaranItem['status'], { teks: string; kelas: string }> = {
  diajukan: { teks: 'menunggu Ayah atau Ummah', kelas: 'lencana' },
  disetujui: { teks: 'Disetujui 🎉', kelas: 'lencana selesai' },
  ditunda: { teks: 'Nanti dulu', kelas: 'lencana aktif' },
}

function tanggal(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export default function Tukar() {
  const { segarkan } = useNavPenulis()
  const [data, setData] = useState<Data | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState<number | null>(null)

  const muat = useCallback(() => getPenukaran().then(setData).catch((e: Error) => setGalat(e.message)), [])
  useEffect(() => { muat() }, [muat])

  async function tukar(h: HadiahItem) {
    setSibuk(h.id)
    setGalat(null)
    setPesan(null)
    try {
      await ajukanPenukaran(h.id)
      setPesan(`Permintaan “${h.nama}” sudah dikirim. Tunggu jawaban Ayah atau Ummah, ya.`)
      await muat()
      segarkan()
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Belum terkirim. Coba lagi, ya.')
    } finally {
      setSibuk(null)
    }
  }

  return (
    <main className="page ph-halaman">
      <KepalaHalaman judul="Tukar poin" sub={data ? `Kamu punya ${data.total} poin.` : undefined} />
      <Galat pesan={galat} />
      {pesan && <p role="status" className="callout callout-accent" style={{ padding: 'var(--space-4)' }}>{pesan}</p>}
      {!data && !galat && <Memuat />}
      {data && (
        <>
          <section aria-labelledby="judul-hadiah">
            <h2 id="judul-hadiah" className="ph-judul-bagian">Hadiah</h2>
            {data.hadiah.length === 0 ? (
              <p>Ayah atau Ummah belum menambahkan hadiah. Nanti tanya mereka, ya.</p>
            ) : (
              <ul className="ph-hadiah-daftar">
                {data.hadiah.map((h) => {
                  const kurang = h.harga - data.total
                  return (
                    <li key={h.id} className="kartu">
                      <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)' }}>{h.nama}</strong>
                      <span className="kecil">{h.harga} poin</span>
                      {kurang > 0 ? (
                        <span className="kecil">Kurang {kurang} poin lagi. Terus berlatih!</span>
                      ) : (
                        <button type="button" className="btn-besar sekunder" onClick={() => tukar(h)} disabled={sibuk !== null}>
                          Tukar
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          {data.penukaran.length > 0 && (
            <section aria-labelledby="judul-riwayat">
              <h2 id="judul-riwayat" className="ph-judul-bagian">Permintaanku</h2>
              <ul className="ph-baris-daftar">
                {data.penukaran.map((p) => (
                  <li key={p.id}>
                    <span>{p.hadiah} <span className="kecil">· {tanggal(p.tanggal)}</span></span>
                    <span className={STATUS[p.status]?.kelas ?? 'lencana'}>{STATUS[p.status]?.teks ?? p.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}
