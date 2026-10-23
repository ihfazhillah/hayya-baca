import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getPemeriksaan, getStikerOrtu, listPemeriksaan, simpanPemeriksaan } from '../../api'
import { EMOJI_TINGKAT, Galat, Memuat } from '../../components/ui'
import type { HadiahBaru, Tingkat } from '../../types'
import { pesanGalat, STATUS_LEMBAR, TINGKAT, tgl, useKeDaftarSaatGantiPenulis, useMuat } from './umum'
import '../../styles/ortu-halaman.css'

function ringkasHadiah(h: HadiahBaru[]): string {
  return h
    .map((x) => (x.jenis === 'stiker' ? `stiker ${x.tingkat} ${x.nama ?? ''}`.trim()
      : x.jenis === 'pangkat' ? `pangkat ${x.nama}` : `+${x.jumlah} poin`))
    .join(', ')
}

export default function PemeriksaanLembar() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data, error, muat } = useMuat(() => getPemeriksaan(id), [id])
  useKeDaftarSaatGantiPenulis('/ortu/lembar')
  const [hasil, setHasil] = useState<'bagus' | 'coba_lagi' | ''>('')
  const [catatan, setCatatan] = useState('')
  const [stiker, setStiker] = useState<Tingkat | ''>('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const lokasi = useLocation()
  // Pesan hasil lembar sebelumnya ("Simpan dan lembar berikutnya") ikut dibawa lewat state navigasi.
  const [pesan, setPesan] = useState<string | null>(null)
  useEffect(() => {
    setPesan((lokasi.state as { pesan?: string } | null)?.pesan ?? null)
  }, [lokasi.key, lokasi.state])
  const [sudahPunya, setSudahPunya] = useState<Tingkat[]>([])
  const alat = data?.alat ?? null

  // Stiker yang sudah dimiliki tidak bisa diberikan lagi (server diam-diam mengabaikannya).
  useEffect(() => {
    setSudahPunya([])
    if (!alat) return
    let batal = false
    getStikerOrtu()
      .then((r) => {
        if (batal) return
        const a = r.alat.find((x) => x.kode === alat)
        setSudahPunya(a ? a.slot.filter((s) => s.punya).map((s) => s.tingkat) : [])
      })
      .catch(() => {})
    return () => { batal = true }
  }, [alat, data])

  useEffect(() => {
    if (!data) return
    setHasil(data.status === 'menunggu' ? '' : data.status)
    setCatatan(data.catatan)
    setStiker('')
    setGalat(null)
  }, [data])

  const simpan = async (lanjut: boolean) => {
    if (!hasil) return setGalat('Pilih Sudah bagus atau Coba lagi.')
    if (hasil === 'coba_lagi' && !catatan.trim()) return setGalat('Tulis satu kalimat catatan untuk anak.')
    setSibuk(true)
    setGalat(null)
    setPesan(null)
    try {
      const r = await simpanPemeriksaan(id, { status: hasil, catatan: catatan.trim(), stiker: stiker || null })
      const hadiahTeks = r.hadiah_baru.length ? ` Hadiah: ${ringkasHadiah(r.hadiah_baru)}.` : ''
      if (lanjut) {
        const menunggu = await listPemeriksaan({ status: 'menunggu' })
        const berikut = menunggu
          .filter((p) => p.id !== id)
          .sort((a, b) => b.tanggal_cetak.localeCompare(a.tanggal_cetak))[0]
        const state = { pesan: `Lembar ${data?.kode ?? ''} tersimpan.${hadiahTeks}` }
        if (berikut) {
          navigate(`/ortu/lembar/${berikut.id}`, { state })
        } else {
          navigate('/ortu/lembar?status=menunggu', { state })
        }
        return
      }
      setPesan(`Tersimpan.${hadiahTeks}`)
      await muat()
    } catch (e) {
      setGalat(pesanGalat(e))
    } finally {
      setSibuk(false)
    }
  }

  if (error) return <main className="page"><Galat pesan={error} /></main>
  // Saat pindah ke lembar berikutnya, jangan tampilkan formulir lembar lama dengan id baru.
  if (!data || data.id !== id) return <main className="page"><Memuat /></main>
  const lb = data.lembar

  return (
    <main className="page">
      <Link className="kembali" to="/ortu/lembar">← Daftar lembar</Link>
      <h1 className="page-title">{data.kode} · {data.judul}</h1>
      {pesan && <p className="pesan-ok" role="status">{pesan}</p>}
      <p className="kecil">
        Modul {lb.modul.nomor} · {lb.modul.judul}{data.misi ? ` · ${data.misi}` : ''} · dicetak {tgl(data.tanggal_cetak)}
        {' · '}{STATUS_LEMBAR[data.status]}{data.diperiksa_oleh ? ` oleh ${data.diperiksa_oleh}` : ''}
        {' · '}<a href={`/cetak/${encodeURIComponent(data.kode)}?lihat=1`} target="_blank" rel="noreferrer">Lihat lembar asli</a>
      </p>

      <div className="dua-kolom bagian-ortu">
        <div className="bagian-ortu">
          <section>
            <h2 className="judul-bagian">Soal</h2>
            {lb.petunjuk && <p><i>{lb.petunjuk}</i></p>}
            <p className="teks-soal">{lb.soal}</p>
          </section>
          <section>
            <h2 className="judul-bagian">Kriteria</h2>
            <p>{lb.kriteria || '—'}</p>
          </section>
          <section>
            <h2 className="judul-bagian">Contoh jawaban</h2>
            <p className="teks-soal">{lb.contoh_jawaban || '—'}</p>
            {lb.saran_stiker && <p className="kecil">{lb.saran_stiker}</p>}
          </section>
        </div>

        <form className="kartu formulir kartu-hasil" aria-label="Hasil pemeriksaan" onSubmit={(e) => { e.preventDefault(); void simpan(true) }}>
          <fieldset className="pilihan" style={{ border: 0, padding: 0 }}>
            <legend className="judul-bagian">Hasil</legend>
            <label><input type="radio" name="hasil" checked={hasil === 'bagus'} onChange={() => setHasil('bagus')} /> Sudah bagus</label>
            <label><input type="radio" name="hasil" checked={hasil === 'coba_lagi'} onChange={() => setHasil('coba_lagi')} /> Coba lagi</label>
          </fieldset>
          <label>
            Catatan untuk anak{hasil === 'coba_lagi' ? ' (satu kalimat, wajib)' : ' (boleh kosong)'}
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={300}
              placeholder={hasil === 'coba_lagi' ? 'mis. Kalimat keduanya masih bilang "senang". Coba tunjukkan lewat wajahnya.' : ''} />
          </label>
          {data.alat && (
            <fieldset className="pilihan" style={{ border: 0, padding: 0 }}>
              <legend className="legenda-kecil">Stiker yang ikut diberikan</legend>
              <label><input type="radio" name="stiker" checked={stiker === ''} onChange={() => setStiker('')} /> Tanpa stiker</label>
              {TINGKAT.map((t) => {
                const punya = sudahPunya.includes(t.kode)
                return (
                  <label key={t.kode} className={punya ? 'sudah' : undefined}>
                    <input type="radio" name="stiker" checked={stiker === t.kode} disabled={punya}
                      onChange={() => setStiker(t.kode)} />
                    {EMOJI_TINGKAT[t.kode]} {t.nama}{punya ? ' (sudah)' : ''}
                  </label>
                )
              })}
            </fieldset>
          )}
          <Galat pesan={galat} />
          <div className="baris">
            <button type="button" className="btn btn-ghost" disabled={sibuk} onClick={() => void simpan(false)}>Simpan</button>
            <button type="submit" className="btn btn-primary" disabled={sibuk}>Simpan dan lembar berikutnya</button>
          </div>
        </form>
      </div>
    </main>
  )
}
