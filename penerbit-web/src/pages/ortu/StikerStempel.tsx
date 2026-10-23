import { useState } from 'react'
import { Link } from 'react-router-dom'
import { beriStiker, getStikerOrtu } from '../../api'
import { EMOJI_TINGKAT, Galat, Memuat } from '../../components/ui'
import { useMe } from '../../me'
import type { Alat, Slot } from '../../types'
import { ButuhPenulis, LAPIS, pesanGalat, TINGKAT, tgl, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

function layak(s: Slot): boolean {
  return s.oleh_pemeriksa || (!!s.kemajuan && s.kemajuan.sekarang >= s.kemajuan.target)
}

function SelStiker({ alat, slot, onBeri, sibuk }: { alat: Alat; slot: Slot | undefined; onBeri: () => void; sibuk: boolean }) {
  if (!slot) return <td>—</td>
  if (slot.punya) {
    return (
      <td>
        {EMOJI_TINGKAT[slot.tingkat]} {tgl(slot.tanggal)}
        <div className="kecil">{slot.diberikan_oleh ?? 'otomatis'}</div>
      </td>
    )
  }
  return (
    <td>
      <div className="kecil">{slot.syarat_teks}</div>
      {slot.kemajuan && <div className="kecil mono">{slot.kemajuan.sekarang}/{slot.kemajuan.target}</div>}
      {alat.terbuka && (
        <button type="button" className={`btn btn-kecil ${layak(slot) ? 'btn-primary' : 'btn-ghost'}`}
          disabled={sibuk} onClick={onBeri}>
          Beri stiker
        </button>
      )}
    </td>
  )
}

function IsiStikerStempel() {
  const { penulisDipilih } = useMe()
  const { data, error, muat } = useMuat(getStikerOrtu, [penulisDipilih])
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)

  const beri = async (alat: Alat, tingkat: string, nama: string) => {
    setSibuk(true)
    setGalat(null)
    setPesan(null)
    try {
      await beriStiker(alat.kode, tingkat)
      setPesan(`Stiker ${nama} ${alat.nama} diberikan.`)
      await muat()
    } catch (e) {
      setGalat(pesanGalat(e))
    } finally {
      setSibuk(false)
    }
  }

  return (
    <main className="page">
      <Link className="kembali" to="/ortu">← Dasbor</Link>
      <h1 className="page-title">Stiker dan stempel</h1>
      <Galat pesan={error ?? galat} />
      {pesan && <p className="pesan-ok" role="status">{pesan}</p>}
      {!data && !error && <Memuat />}
      {data && (
        <>
          <section className="bagian-ortu gulir-x" aria-label="Stiker alat">
            <h2 className="judul-bagian">Stiker alat</h2>
            <table className="tabel">
              <thead>
                <tr><th>Alat</th>{TINGKAT.map((t) => <th key={t.kode}>{EMOJI_TINGKAT[t.kode]} {t.nama}</th>)}</tr>
              </thead>
              <tbody>
                {data.alat.map((a) => (
                  <tr key={a.kode}>
                    <td>
                      <b>{a.emoji} {a.nama}</b>
                      {!a.terbuka && <div className="kecil">belum dipelajari (Modul {a.modul_belajar})</div>}
                    </td>
                    {TINGKAT.map((t) => (
                      <SelStiker key={t.kode} alat={a} slot={a.slot.find((s) => s.tingkat === t.kode)} sibuk={sibuk}
                        onBeri={() => void beri(a, t.kode, t.nama)} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="bagian-ortu gulir-x" aria-label="Riwayat stempel">
            <h2 className="judul-bagian">Riwayat stempel per naskah</h2>
            {data.stempel.length === 0 ? (
              <p className="kecil">Belum ada naskah.</p>
            ) : (
              <table className="tabel">
                <thead>
                  <tr><th>Naskah</th>{LAPIS.map((l) => <th key={l.kode}>{l.nama}</th>)}</tr>
                </thead>
                <tbody>
                  {data.stempel.map((n) => (
                    <tr key={n.id}>
                      <td><Link to={`/ortu/naskah/${n.id}`}>{n.naskah || '(tanpa judul)'}</Link></td>
                      {LAPIS.map((l) => {
                        const s = n.stempel.find((x) => x.lapis === l.kode)
                        return <td key={l.kode}>{s?.punya ? `✓ ${tgl(s.tanggal)}` : '—'}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  )
}

export default function StikerStempel() {
  return <ButuhPenulis judul="Stiker dan stempel"><IsiStikerStempel /></ButuhPenulis>
}
