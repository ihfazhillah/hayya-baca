/** Buat soal untuk Ayah (spec 075 K4, "Mengajarkan orang lain"): anak menulis teks Si Ceroboh,
 *  menandai kesalahan yang dia sembunyikan, lalu melihat siapa yang sudah mencoba.
 *  Token berasal dari tokenizer server; server memeriksa ulang setiap tanda. */
import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getSoalBuatan, hapusSoal, simpanSoal, tokenSoal,
  type AlatSoal, type JawabanKeluarga, type SoalBuatanku, type TandaKesalahan,
} from '../../apiBuatSoal'
import type { Token } from '../../types'
import { Galat, KepalaHalaman, Memuat, warnaCss } from '../../components/ui'
import '../../styles/penulis-halaman.css'

interface Tanda {
  /** posisi untuk urutan di teks: token i → i, celah c → c - 0.5 */
  pos: number
  token?: number
  celah?: number
  label: string
  kenapa: string
}

const kunciTanda = (t: { token?: number; celah?: number }) =>
  t.token !== undefined ? `t${t.token}` : `c${t.celah}`

function tanggal(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export function kalimatJawaban(j: JawabanKeluarga): string {
  return j.selesai
    ? `${j.oleh} menemukan ${j.ditemukan} dari ${j.total}`
    : `${j.oleh} sedang mencari: ${j.ditemukan} dari ${j.total}`
}

/** Teks untuk ditandai. Aturan yang bisa diketuk sama dengan TeksKlik (dan `_bisa_diklik` di
 *  server): tanpa mode celah hanya kata; dengan mode celah juga tanda baca, spasi, dan celah di
 *  antara dua token bukan spasi atau di akhir teks. */
function TeksTandai({ tokens, celah, tanda, onTandai }: {
  tokens: Token[]
  celah: boolean
  tanda: Map<string, Tanda>
  onTandai: (t: Tanda) => void
}) {
  const nama = (t: Token) => (t.j === 'spasi' ? 'spasi' : t.t)
  return (
    <div className="teks-latihan" role="group" aria-label="Ketuk kata yang salah">
      {tokens.map((t) => {
        const tombolCelah = celah && t.i > 0 && t.j !== 'spasi' && tokens[t.i - 1].j !== 'spasi'
        const bisa = t.j === 'kata' || celah
        const aktif = tanda.has(kunciTanda({ token: t.i }))
        const aktifCelah = tanda.has(kunciTanda({ celah: t.i }))
        return (
          <Fragment key={t.i}>
            {tombolCelah && (
              <button type="button" className={`celah${aktifCelah ? ' potong' : ''}`} aria-pressed={aktifCelah}
                aria-label={`celah sebelum ${t.t}`}
                onClick={() => onTandai({ pos: t.i - 0.5, celah: t.i, label: `celah sebelum "${t.t}"`, kenapa: '' })} />
            )}
            {bisa ? (
              <button type="button" aria-pressed={aktif}
                className={['kata', t.j !== 'kata' ? 'tanda' : '', t.j === 'spasi' ? 'spasi' : '', aktif ? 'ditemukan' : '']
                  .filter(Boolean).join(' ')}
                aria-label={t.j === 'spasi' ? 'spasi' : undefined}
                onClick={() => onTandai({ pos: t.i, token: t.i, label: `"${nama(t)}"`, kenapa: '' })}>
                {t.j === 'spasi' ? ' ' : t.t}
              </button>
            ) : <span>{t.t}</span>}
          </Fragment>
        )
      })}
      {celah && (
        <button type="button" className={`celah${tanda.has(kunciTanda({ celah: tokens.length })) ? ' potong' : ''}`}
          aria-pressed={tanda.has(kunciTanda({ celah: tokens.length }))} aria-label="celah di akhir"
          onClick={() => onTandai({ pos: tokens.length - 0.5, celah: tokens.length, label: 'celah di akhir', kenapa: '' })} />
      )}
    </div>
  )
}

function KartuSoal({ s, onHapus }: { s: SoalBuatanku; onHapus: (id: number) => void }) {
  const [yakin, setYakin] = useState(false)
  return (
    <article className="kartu" aria-label={`Soal ${s.alat.nama}, ${tanggal(s.dibuat)}`}
      style={{ borderLeft: `5px solid ${warnaCss(s.alat.warna)}` }}>
      <p className="kecil"><span aria-hidden="true">{s.alat.emoji}</span> {s.alat.nama} · {tanggal(s.dibuat)} · {s.jumlah} kesalahan</p>
      <p>{s.teks}</p>
      {s.jawaban.length === 0 ? (
        <p className="kecil">Belum ada yang mencoba. Minta Ayah atau Ummah membukanya di Pojok Orang Tua.</p>
      ) : (
        <ul>
          {s.jawaban.map((j) => <li key={j.oleh}>{kalimatJawaban(j)}</li>)}
        </ul>
      )}
      <div className="baris">
        {yakin ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => onHapus(s.id)}>Ya, hapus soal ini</button>
            <button type="button" className="btn btn-ghost" onClick={() => setYakin(false)}>Batal</button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setYakin(true)}>Hapus</button>
        )}
      </div>
    </article>
  )
}

export default function BuatSoal() {
  const [alat, setAlat] = useState<AlatSoal[] | null>(null)
  const [soal, setSoal] = useState<SoalBuatanku[]>([])
  const [batas, setBatas] = useState({ teks: 600, kesalahan: 8 })
  const [galat, setGalat] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [kode, setKode] = useState('')
  const [teks, setTeks] = useState('')
  const [tokens, setTokens] = useState<Token[] | null>(null)
  const [tanda, setTanda] = useState<Map<string, Tanda>>(new Map())
  const [sibuk, setSibuk] = useState(false)

  const muat = useCallback(async () => {
    try {
      const r = await getSoalBuatan()
      setAlat(r.alat)
      setSoal(r.soal)
      setBatas(r.batas)
    } catch (e) {
      setGalat((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void muat()
  }, [muat])

  const dipilih = alat?.find((a) => a.kode === kode && a.terbuka)
  const adaTerbuka = !!alat?.some((a) => a.terbuka)
  const daftarTanda = [...tanda.values()].sort((a, b) => a.pos - b.pos)

  function pilihAlat(k: string) {
    setKode(k)
    // Mode celah bisa berbeda: tanda lama dibuang supaya tidak ada tanda yang tak bisa diklik.
    setTanda(new Map())
  }

  async function mulaiTandai() {
    setGalat(null)
    setPesan(null)
    setSibuk(true)
    try {
      const r = await tokenSoal(teks)
      setTokens(r.tokens)
      setTanda(new Map())
    } catch (e) {
      setGalat((e as Error).message)
    } finally {
      setSibuk(false)
    }
  }

  function tandai(t: Tanda) {
    const k = kunciTanda(t)
    if (!tanda.has(k) && tanda.size >= batas.kesalahan) {
      setPesan(`Paling banyak ${batas.kesalahan} kesalahan, ya.`)
      return
    }
    const baru = new Map(tanda)
    if (baru.has(k)) baru.delete(k)
    else baru.set(k, t)
    setTanda(baru)
  }

  function ubahKenapa(k: string, kenapa: string) {
    setTanda((lama) => {
      const baru = new Map(lama)
      const t = baru.get(k)
      if (t) baru.set(k, { ...t, kenapa })
      return baru
    })
  }

  async function simpan() {
    if (!dipilih) return
    setGalat(null)
    setSibuk(true)
    try {
      const kesalahan: TandaKesalahan[] = daftarTanda.map((t) =>
        t.token !== undefined ? { token: t.token, kenapa: t.kenapa.trim() } : { celah: t.celah!, kenapa: t.kenapa.trim() })
      const r = await simpanSoal(dipilih.kode, teks.trim(), kesalahan)
      setPesan(r.pesan)
      setTeks('')
      setTokens(null)
      setTanda(new Map())
      await muat()
    } catch (e) {
      setGalat((e as Error).message)
    } finally {
      setSibuk(false)
    }
  }

  async function hapus(id: number) {
    try {
      await hapusSoal(id)
      setSoal((s) => s.filter((x) => x.id !== id))
    } catch (e) {
      setGalat((e as Error).message)
    }
  }

  return (
    <main className="page ph-halaman">
      <Link className="kembali" to="/alat">← Kotak Alat Editor</Link>
      <KepalaHalaman judul="Buat soal untuk Ayah"
        sub="Sekarang kamu yang jadi guru. Tulis teks Si Ceroboh, sembunyikan beberapa kesalahan, lalu minta Ayah atau Ummah mencarinya." />
      {!alat && !galat && <Memuat />}
      {alat && (
        <section className="kartu tumpuk" aria-labelledby="judul-buat">
          <h2 id="judul-buat" className="ph-judul-bagian">Soal baru</h2>
          {!adaTerbuka && <p>Buat soal terbuka setelah kamu punya stiker Perak pertama.</p>}
          <fieldset className="tumpuk" disabled={!!tokens}>
            <legend>1. Pilih alatnya</legend>
            {alat.map((a) => (
              <label key={a.kode} className={a.terbuka ? undefined : 'samar'}>
                <input type="radio" name="alat" value={a.kode} checked={kode === a.kode} disabled={!a.terbuka}
                  onChange={() => pilihAlat(a.kode)} />
                {' '}<span aria-hidden="true">{a.emoji}</span> {a.nama}
                {!a.terbuka && <> · <span className="kecil">{a.syarat}</span></>}
              </label>
            ))}
          </fieldset>
          {dipilih && !tokens && (
            <div className="tumpuk">
              <label className="tumpuk">
                <span>2. Tulis teks Si Ceroboh</span>
                <textarea aria-label="Teks Si Ceroboh" rows={4} maxLength={batas.teks} value={teks}
                  onChange={(e) => setTeks(e.target.value)} />
              </label>
              <p className="kecil">Tulis dengan sengaja salah. Paling banyak {batas.kesalahan} kesalahan.</p>
              <div className="baris">
                <button type="button" className="btn-besar" disabled={!teks.trim() || sibuk} onClick={() => void mulaiTandai()}>
                  Tandai kesalahan
                </button>
              </div>
            </div>
          )}
          {dipilih && tokens && (
            <div className="tumpuk">
              <p>3. Ketuk {dipilih.celah ? 'kata, tanda baca, atau celah' : 'kata'} yang kamu buat salah.</p>
              <TeksTandai tokens={tokens} celah={dipilih.celah} tanda={tanda} onTandai={tandai} />
              <p aria-live="polite">{tanda.size} kesalahan ditandai</p>
              {daftarTanda.map((t) => {
                const k = kunciTanda(t)
                return (
                  <label key={k} className="tumpuk">
                    <span>Kenapa {t.label} salah? (boleh kosong)</span>
                    <input type="text" maxLength={200} value={t.kenapa} onChange={(e) => ubahKenapa(k, e.target.value)} />
                  </label>
                )
              })}
              <div className="baris">
                <button type="button" className="btn-besar" disabled={tanda.size === 0 || sibuk} onClick={() => void simpan()}>
                  Simpan soal
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setTokens(null); setTanda(new Map()) }}>
                  Ubah teks
                </button>
              </div>
            </div>
          )}
          {pesan && <p role="status" className="ph-pesan">{pesan}</p>}
          <Galat pesan={galat} />
        </section>
      )}
      {alat && (
        <section className="tumpuk" aria-labelledby="judul-soalku">
          <h2 id="judul-soalku" className="ph-judul-bagian">Soal buatanku</h2>
          {soal.length === 0 && <p className="kecil">Belum ada soal. Buat yang pertama, yuk!</p>}
          {soal.map((s) => <KartuSoal key={s.id} s={s} onHapus={(id) => void hapus(id)} />)}
        </section>
      )}
    </main>
  )
}
