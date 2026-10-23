import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { hapusIde, listIde, listNaskah, tambahIde, ubahIde } from '../../api'
import type { Ide, NaskahRingkas } from '../../types'
import { Galat, KepalaHalaman, Memuat } from '../../components/ui'
import { NAMA_STEMPEL, URUTAN_STEMPEL, adalahLapis, formatSisa, LAPIS, lapisBerikutnya, tautanLanjut } from '../../editor/naskah'
import '../../editor/editor.css'

export const SUMUR: { nilai: Ide['sumur']; label: string }[] = [
  { nilai: '', label: 'Tanpa sumur' },
  { nilai: 'kenangan', label: 'Sumur Kenangan' },
  { nilai: 'bagaimana', label: 'Sumur Bagaimana Kalau' },
  { nilai: 'acak', label: 'Sumur Acak' },
]

export const BINTANG = ['Aku senang menulisnya', 'Ada masalahnya', 'Aku tahu akhirnya']

export function BintangIde({ ide, onUbah }: { ide: Ide; onUbah?: (b: boolean[]) => void }) {
  const b = [0, 1, 2].map((i) => !!ide.bintang[i])
  return (
    <span className="bintang" role="group" aria-label="Tes 3 Bintang">
      {BINTANG.map((nama, i) => (
        <button key={nama} type="button" aria-pressed={b[i]} title={nama} aria-label={nama}
          disabled={!onUbah} onClick={() => onUbah?.(b.map((x, j) => (j === i ? !x : x)))}>★</button>
      ))}
    </span>
  )
}

function labelTahap(n: NaskahRingkas): string {
  if (n.tahap === 'revisi') {
    const l = lapisBerikutnya(n.stempel)
    if (adalahLapis(l)) return `Revisi Lapis ${LAPIS[l].nomor} · ${NAMA_STEMPEL[l]}`
    if (l === 'pembaca') return 'Menunggu pembaca'
  }
  if (n.tahap === 'laci') return 'Versi 1 di Laci Rahasia'
  return n.tahap_label
}

function KartuNaskah({ n }: { n: NaskahRingkas }) {
  const [sisa, setSisa] = useState(n.laci?.sisa_detik ?? 0)
  const terkunci = n.tahap === 'laci' && !!n.laci?.terkunci && sisa > 0
  useEffect(() => {
    if (!terkunci) return
    const t = setInterval(() => setSisa((s) => Math.max(0, s - 60)), 60_000)
    return () => clearInterval(t)
  }, [terkunci])
  const berikut = lapisBerikutnya(n.stempel)
  const lanjut = tautanLanjut(n)
  const aktif = n.tahap === 'revisi' || n.tahap === 'draf_nol' || n.tahap === 'peta' || (n.tahap === 'laci' && !terkunci)
  const tampilStempel = n.tahap === 'revisi' || n.tahap === 'terbit'
  return (
    <article className={`kartu-naskah${n.tahap === 'revisi' ? ' sedang' : ''}`}>
      <div className="kartu-naskah-isi">
        <h3>{n.judul}</h3>
        <p className="kecil">{labelTahap(n)}{n.nomor_terbitan ? ` · ${n.nomor_terbitan}` : ''}</p>
        {tampilStempel && (
          <div className="stempel-mini" aria-label="Stempel">
            {URUTAN_STEMPEL.map((l) => {
              const punya = n.stempel.includes(l)
              const sekarang = !punya && l === berikut && n.tahap === 'revisi'
              return (
                <span key={l} className={punya ? 'punya' : sekarang ? 'sekarang' : ''}>
                  {NAMA_STEMPEL[l]}{punya ? ' ✓' : sekarang ? ' · sekarang' : ''}
                </span>
              )
            })}
          </div>
        )}
        {n.stempel_diminta && (
          <p className="lencana aktif">Menunggu stempel {NAMA_STEMPEL[n.stempel_diminta] ?? n.stempel_diminta} dari Ayah atau Ummah</p>
        )}
        {terkunci && (
          <p className="gembok"><span aria-hidden="true">🔒</span> Buka dalam {formatSisa(sisa)}</p>
        )}
      </div>
      <Link className={`btn-besar tautan-tombol${aktif ? '' : ' sekunder'}`} to={lanjut.ke}>{terkunci ? 'Lihat naskah' : lanjut.label}</Link>
    </article>
  )
}

function BankIde() {
  const [ide, setIde] = useState<Ide[] | null>(null)
  const [teks, setTeks] = useState('')
  const [sumur, setSumur] = useState<Ide['sumur']>('')
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    listIde().then(setIde).catch((e: Error) => setGalat(e.message))
  }, [])

  const tambah = async (e: FormEvent) => {
    e.preventDefault()
    if (!teks.trim()) return
    try {
      const baru = await tambahIde(teks.trim(), sumur)
      setIde((d) => [baru, ...(d ?? [])])
      setTeks('')
    } catch (er) {
      setGalat((er as Error).message)
    }
  }

  const beriBintang = async (i: Ide, bintang: boolean[]) => {
    setIde((d) => d?.map((x) => (x.id === i.id ? { ...x, bintang } : x)) ?? null)
    try {
      await ubahIde(i.id, { bintang })
    } catch (er) {
      setGalat((er as Error).message)
    }
  }

  const buang = async (i: Ide) => {
    if (!window.confirm(`Buang ide "${i.teks}"?`)) return
    try {
      await hapusIde(i.id)
      setIde((d) => d?.filter((x) => x.id !== i.id) ?? null)
    } catch (er) {
      setGalat((er as Error).message)
    }
  }

  return (
    <section className="bank-ide" aria-labelledby="judul-bank-ide">
      <div className="bagian-kepala">
        <h2 id="judul-bank-ide" className="sub-judul">Bank Ide</h2>
        <span className="kecil">{ide ? `${ide.length} ide · ` : ''}Tes 3 Bintang</span>
      </div>
      <Galat pesan={galat} />
      <form onSubmit={tambah} className="ide-form">
        <label className="sr-only" htmlFor="ide-baru">Ide baru</label>
        <input id="ide-baru" className="isian" placeholder="Tulis ide baru di sini…" value={teks} maxLength={300}
          spellCheck={false} onChange={(e) => setTeks(e.target.value)} />
        <label className="sr-only" htmlFor="ide-sumur">Sumur</label>
        <select id="ide-sumur" className="isian" value={sumur}
          onChange={(e) => setSumur(e.target.value as Ide['sumur'])}>
          {SUMUR.map((s) => <option key={s.nilai} value={s.nilai}>{s.label}</option>)}
        </select>
        <button type="submit" className="btn-besar" disabled={!teks.trim()}>Simpan ide</button>
      </form>
      <p className="kecil">Bintang: {BINTANG.join(' · ').toLowerCase()}.</p>
      {!ide && !galat && <Memuat />}
      {ide?.length === 0 && <p className="kecil">Belum ada ide. Tulis satu di atas, sekecil apa pun.</p>}
      {!!ide?.length && (
        <ul className="ide-daftar">
          {ide.map((i) => (
            <li key={i.id} className="ide-baris">
              <span className="teks">{i.teks}</span>
              {i.sumur && <span className="kecil">{SUMUR.find((s) => s.nilai === i.sumur)?.label}</span>}
              <BintangIde ide={i} onUbah={(b) => beriBintang(i, b)} />
              <button type="button" className="tombol-kecil" onClick={() => buang(i)} aria-label={`Buang ide ${i.teks}`}>Buang</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function RuangPenulis() {
  const [naskah, setNaskah] = useState<NaskahRingkas[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    listNaskah().then(setNaskah).catch((e: Error) => setGalat(e.message))
  }, [])

  return (
    <main className="page">
      <div className="layar ruang-penulis">
        <div className="bagian-kepala rp-kepala">
          <KepalaHalaman judul="Ruang Penulis" sub="Semua ide dan naskahmu ada di sini." />
          <Link to="/naskah/baru" className="btn-besar tautan-tombol">✏️ Tulis cerita baru</Link>
        </div>
        <section aria-labelledby="judul-naskahku" className="naskahku">
          <h2 id="judul-naskahku" className="sub-judul">Naskahku</h2>
          <Galat pesan={galat} />
          {!naskah && !galat && <Memuat />}
          {naskah?.length === 0 && <p className="kecil">Belum ada naskah. Mulai dari satu ide di Bank Ide, yuk.</p>}
          {naskah?.map((n) => <KartuNaskah key={n.id} n={n} />)}
        </section>
        <BankIde />
      </div>
    </main>
  )
}
