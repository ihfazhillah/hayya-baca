import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  bagikanNaskah, beraniHapus, beriStempel, bukaLaciOrtu, getNaskahOrtu, logBagus, tambahCatatan,
  terbitkan, ubahEjaan, ulasanOrtu,
} from '../../api'
import { Galat, Memuat } from '../../components/ui'
import type { NaskahOrtu } from '../../types'
import { paragraf, pesanGalat, tgl, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

/** Jalankan aksi, tampilkan pesan hasil atau galat, lalu muat ulang naskah. */
function useAksi(muat: () => Promise<void>) {
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const jalankan = async (fn: () => Promise<string | void>) => {
    setSibuk(true)
    setPesan(null)
    setGalat(null)
    try {
      const p = await fn()
      if (p) setPesan(p)
      await muat()
      return true
    } catch (e) {
      setGalat(pesanGalat(e))
      return false
    } finally {
      setSibuk(false)
    }
  }
  const umpan = (
    <>
      <Galat pesan={galat} />
      {pesan && <p className="pesan-ok" role="status">{pesan}</p>}
    </>
  )
  return { sibuk, jalankan, umpan, setGalat }
}

function Kartu({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className="kartu formulir" aria-label={judul}>
      <h2>{judul}</h2>
      {children}
    </section>
  )
}

function PanelStempel({ n, muat }: { n: NaskahOrtu; muat: () => Promise<void> }) {
  const [catatan, setCatatan] = useState('')
  const { sibuk, jalankan, umpan } = useAksi(muat)
  const adaUlasan = n.ulasan.length > 0
  const beri = (lapis: string, nama: string) =>
    jalankan(async () => {
      await beriStempel(n.id, lapis, catatan.trim())
      setCatatan('')
      return `Stempel ${nama} diberikan.`
    })
  return (
    <Kartu judul="Stempel">
      <ul className="jalur-stempel">
        {n.stempel.map((s) => {
          const diminta = n.stempel_diminta === s.lapis
          const butuhUlasan = s.lapis === 'pembaca' && !adaUlasan
          return (
            <li key={s.lapis}>
              <span>
                {s.punya ? <span className="punya">✓ {s.nama}</span> : <span className={diminta ? 'diminta' : ''}>{s.nama}</span>}
                {s.punya && <span className="kecil"> · {tgl(s.tanggal)}{s.catatan ? ` · ${s.catatan}` : ''}</span>}
                {!s.punya && diminta && <span className="kecil"> · diminta</span>}
                {butuhUlasan && !s.punya && <span className="kecil"> · perlu Kartu Ulasan dulu</span>}
              </span>
              {!s.punya && (
                <button type="button" className={`btn btn-kecil ${diminta ? 'btn-primary' : 'btn-ghost'}`}
                  disabled={sibuk || butuhUlasan} onClick={() => void beri(s.lapis, s.nama)}>
                  Beri stempel {s.nama}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <label>
        Catatan stempel (boleh kosong)
        <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </label>
      {umpan}
    </Kartu>
  )
}

function PanelCatatan({ n, muat }: { n: NaskahOrtu; muat: () => Promise<void> }) {
  const [teks, setTeks] = useState('')
  const { sibuk, jalankan, umpan } = useAksi(muat)
  const kirim = (e: FormEvent) => {
    e.preventDefault()
    if (!teks.trim()) return
    void jalankan(async () => {
      await tambahCatatan(n.id, teks.trim())
      setTeks('')
      return 'Catatan terkirim.'
    })
  }
  return (
    <Kartu judul="Catatan untuk penulis">
      {n.catatan.length > 0 && (
        <ul className="daftar-aktivitas">
          {n.catatan.map((c, i) => <li key={i}><time>{tgl(c.tanggal)}</time><span>{c.teks} <span className="kecil">— {c.oleh}</span></span></li>)}
        </ul>
      )}
      <form className="formulir" onSubmit={kirim}>
        <label>
          Catatan baru
          <textarea value={teks} onChange={(e) => setTeks(e.target.value)} />
        </label>
        <button className="btn btn-ghost" disabled={sibuk || !teks.trim()}>Kirim catatan</button>
      </form>
      {umpan}
    </Kartu>
  )
}

function PanelUlasan({ n, muat }: { n: NaskahOrtu; muat: () => Promise<void> }) {
  const kosong = { favorit: '', membingungkan: '', pertanyaan: '' }
  const [isi, setIsi] = useState(kosong)
  const { sibuk, jalankan, umpan, setGalat } = useAksi(muat)
  const kirim = (e: FormEvent) => {
    e.preventDefault()
    if (!isi.favorit.trim() || !isi.membingungkan.trim() || !isi.pertanyaan.trim())
      return setGalat('Isi ketiga bagian Kartu Ulasan.')
    void jalankan(async () => {
      await ulasanOrtu(n.id, isi)
      setIsi(kosong)
      return 'Kartu Ulasan terkirim.'
    })
  }
  const ubah = (k: keyof typeof kosong) => (e: { target: { value: string } }) => setIsi({ ...isi, [k]: e.target.value })
  return (
    <Kartu judul="Kartu Ulasan">
      {n.ulasan.map((u, i) => (
        <div key={i} className="kecil">
          <b>{u.oleh}</b> · Versi {u.versi} · {tgl(u.tanggal)}<br />
          Favorit: {u.favorit}<br />Bingung: {u.membingungkan}<br />Pertanyaan: {u.pertanyaan}
        </div>
      ))}
      {n.versi_terakhir ? (
        <form className="formulir" onSubmit={kirim}>
          <label>Bagian favoritku<textarea value={isi.favorit} onChange={ubah('favorit')} /></label>
          <label>Yang membuatku bingung<textarea value={isi.membingungkan} onChange={ubah('membingungkan')} /></label>
          <label>Satu pertanyaan untuk penulis<input type="text" value={isi.pertanyaan} onChange={ubah('pertanyaan')} /></label>
          <button className="btn btn-ghost" disabled={sibuk}>Kirim Kartu Ulasan</button>
        </form>
      ) : (
        <p className="kecil">Belum ada versi untuk diulas.</p>
      )}
      {umpan}
    </Kartu>
  )
}

function PanelBagikan({ n, muat }: { n: NaskahOrtu; muat: () => Promise<void> }) {
  const [username, setUsername] = useState('')
  const { sibuk, jalankan, umpan } = useAksi(muat)
  const kirim = (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    void jalankan(async () => {
      const r = await bagikanNaskah(n.id, username.trim())
      setUsername('')
      return `Versi ${r.versi} dibagikan ke ${r.dibagikan}.`
    })
  }
  return (
    <Kartu judul="Bagikan ke Editor Tamu">
      {n.dibagikan.length > 0 && <p className="kecil">Sudah dibagikan ke: {n.dibagikan.join(', ')}</p>}
      <form className="formulir" onSubmit={kirim}>
        <label>
          Nama pengguna akun yang sudah ada
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        </label>
        <button className="btn btn-ghost" disabled={sibuk || !username.trim() || !n.versi_terakhir}>Bagikan ke Editor Tamu</button>
      </form>
      {umpan}
    </Kartu>
  )
}

function PanelPoin({ n, muat }: { n: NaskahOrtu; muat: () => Promise<void> }) {
  const [catatan, setCatatan] = useState('')
  const [ejaan, setEjaan] = useState('')
  const { sibuk, jalankan, umpan } = useAksi(muat)
  useEffect(() => {
    if (n.jejak) setEjaan(String(n.jejak.kesalahan_ejaan_ortu ?? n.jejak.kesalahan_ejaan))
  }, [n.jejak])
  const poin = (fn: typeof beraniHapus, nama: string, jumlah: number) =>
    void jalankan(async () => {
      const r = await fn(n.id, catatan.trim())
      setCatatan('')
      return `${nama} +${jumlah}. Total poin sekarang ${r.total_poin}.`
    })
  return (
    <Kartu judul="Poin dan Jejak">
      <label>
        Alasan singkat (boleh kosong)
        <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </label>
      <div className="baris">
        <button type="button" className="btn btn-ghost btn-kecil" disabled={sibuk}
          onClick={() => poin(beraniHapus, 'Berani Hapus', 10)}>Berani Hapus +10</button>
        <button type="button" className="btn btn-ghost btn-kecil" disabled={sibuk}
          onClick={() => poin(logBagus, 'LOG bagus', 2)}>LOG bagus +2</button>
      </div>
      {n.jejak && (
        <form className="formulir" onSubmit={(e) => {
          e.preventDefault()
          void jalankan(async () => {
            const r = await ubahEjaan(n.id, ejaan.trim() === '' ? null : Number(ejaan))
            return `Kesalahan ejaan Draf Nol: ${r.kesalahan_ejaan}.`
          })
        }}>
          <label>
            Kesalahan ejaan di Draf Nol (hitungan sistem: {n.jejak.kesalahan_ejaan})
            <input type="number" min={0} value={ejaan} onChange={(e) => setEjaan(e.target.value)} />
          </label>
          <button className="btn btn-ghost btn-kecil" disabled={sibuk}>Simpan hitungan ejaan</button>
        </form>
      )}
      {umpan}
    </Kartu>
  )
}

function PanelTerbit({ n, muat }: { n: NaskahOrtu; muat: () => Promise<void> }) {
  const lengkap = n.stempel.filter((s) => s.punya).length
  const [judul, setJudul] = useState('')
  const [tentang, setTentang] = useState(n.tentang_penulis)
  const [sampul, setSampul] = useState<File | null>(null)
  const { sibuk, jalankan, umpan } = useAksi(muat)
  if (n.tahap === 'terbit') {
    return (
      <Kartu judul="Terbit">
        <p>Sudah terbit sebagai <b className="mono">{n.nomor_terbitan}</b>. <Link to={`/rak/${n.id}`}>Lihat di Rak Buku</Link></p>
        {umpan}
      </Kartu>
    )
  }
  const kirim = (e: FormEvent) => {
    e.preventDefault()
    const fd = new FormData()
    fd.set('tentang_penulis', tentang)
    if (judul.trim()) fd.set('judul', judul.trim())
    if (sampul) fd.set('sampul', sampul)
    void jalankan(async () => {
      const r = await terbitkan(n.id, fd)
      return `Terbit sebagai ${r.nomor_terbitan}.`
    })
  }
  return (
    <Kartu judul="Terbitkan">
      <form className="formulir" onSubmit={kirim}>
        <label>
          Gambar sampul
          <input type="file" accept="image/*" onChange={(e) => setSampul(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          Tentang Penulis
          <textarea value={tentang} onChange={(e) => setTentang(e.target.value)} />
        </label>
        <label>
          Judul akhir (boleh kosong, bawaan: {n.judul})
          <input type="text" value={judul} onChange={(e) => setJudul(e.target.value)} maxLength={150} />
        </label>
        <button className="btn btn-primary" disabled={sibuk || lengkap < 5}>
          Terbitkan{lengkap < 5 ? ` · perlu 5 stempel (${lengkap} dari 5)` : ''}
        </button>
        <p className="kecil">Nomor terbitan diberikan otomatis.</p>
      </form>
      {umpan}
    </Kartu>
  )
}

function PanelLaci({ n, muat }: { n: NaskahOrtu; muat: () => Promise<void> }) {
  const { sibuk, jalankan, umpan } = useAksi(muat)
  if (n.tahap !== 'laci') return null
  return (
    <Kartu judul="Laci">
      <p className="kecil">
        Naskah sedang di laci{n.laci?.buka ? ` sampai ${tgl(n.laci.buka)}` : ''}. Buka lebih awal hanya untuk keadaan khusus.
      </p>
      <button type="button" className="btn btn-ghost" disabled={sibuk}
        onClick={() => void jalankan(async () => { await bukaLaciOrtu(n.id); return 'Laci dibuka.' })}>
        Buka laci sekarang
      </button>
      {umpan}
    </Kartu>
  )
}

export default function NaskahPenulis() {
  const id = Number(useParams().id)
  const { data: n, error, muat } = useMuat(() => getNaskahOrtu(id), [id])
  if (error) return <main className="page"><Galat pesan={error} /></main>
  if (!n) return <main className="page"><Memuat /></main>
  const v = n.versi_terakhir
  const diminta = n.stempel.find((s) => s.lapis === n.stempel_diminta)
  return (
    <main className="page">
      <Link className="kembali" to="/ortu/naskah">← Semua naskah</Link>
      <h1 className="page-title">{n.judul || '(tanpa judul)'}</h1>
      <p className="kecil">
        {n.tahap_label}
        {v ? ` · Versi ${v.nomor}${v.lapis ? ` · ${v.lapis}` : ''}` : ''}
        {diminta ? ` · minta stempel ${diminta.nama}` : ''}
        {n.jumlah_kata_v1 ? ` · Versi 1: ${n.jumlah_kata_v1} kata` : ''}
      </p>
      <div className="dua-kolom bagian-ortu">
        <section aria-label="Versi terakhir">
          {v ? (
            <div className="teks-naskah">
              {paragraf(v.teks).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ) : (
            <p className="kecil">Belum ada versi tersimpan.</p>
          )}
          <p className="kecil" style={{ marginTop: 'var(--space-2)' }}>
            {v ? `Sorotan: ${v.sorotan.length} · sudah diperbaiki: ${v.sorotan.filter((s) => s.diperbaiki).length}. ` : ''}
            Pemeriksa tidak bisa mengubah teks. Semua masukan berupa catatan.
          </p>
        </section>
        <div className="panel-ortu">
          <PanelStempel n={n} muat={muat} />
          <PanelCatatan n={n} muat={muat} />
          <PanelUlasan n={n} muat={muat} />
          <PanelBagikan n={n} muat={muat} />
          <PanelLaci n={n} muat={muat} />
          <PanelPoin n={n} muat={muat} />
          <PanelTerbit n={n} muat={muat} />
        </div>
      </div>
    </main>
  )
}
