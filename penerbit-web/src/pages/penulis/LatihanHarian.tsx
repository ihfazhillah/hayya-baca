import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  berhentiLatihan, getLatihan, klikLatihan, periksaGuntingLatihan, periksaKembarLatihan, pilihAlatLatihan,
} from '../../api'
import type { AlatRingkas, HadiahBaru, HasilGunting, HasilKembar, HasilKlik, Jawaban, KartuLatihan } from '../../types'
import { Galat, KepalaHalaman, Memuat, PerayaanHadiah } from '../../components/ui'
import { useNavPenulis } from '../../components/LayoutPenulis'
import { formatMenit, useTimer } from '../../components/Timer'
import TeksKlik from '../../components/TeksKlik'
import Gunting from '../../components/Gunting'
import DetektorKembar from '../../components/DetektorKembar'
import '../../styles/penulis-halaman.css'

type Hasil = { kartu: number; alat: AlatRingkas | null; betul: boolean }

/** Cara mengerjakan per jenis kartu, supaya anak tahu apa yang harus diklik. */
const CARA: Partial<Record<KartuLatihan['jenis'], string>> = {
  klik: 'Klik kata yang salah.',
  gunting: 'Klik celah di antara kata untuk memotong kalimatnya, lalu tekan Periksa.',
  kembar: 'Klik kata yang paling sering muncul.',
}

export default function LatihanHarian() {
  const [kartu, setKartu] = useState<KartuLatihan[] | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    getLatihan()
      .then((r) => { setKartu(r.kartu); setPesan(r.pesan ?? null) })
      .catch((e: Error) => setGalat(e.message))
  }, [])

  return (
    <main className="page ph-halaman">
      <KepalaHalaman judul="Pemanasan 3 menit" sub="Tiga kalimat dari alat lama, supaya kamu tidak lupa." />
      <Galat pesan={galat} />
      {!kartu && !galat && <Memuat />}
      {kartu && kartu.length === 0 && (
        <div className="tumpuk">
          <p style={{ fontSize: 'var(--text-lg)' }} role="status">{pesan ?? 'Hari ini tidak ada pemanasan. Langsung lanjut, yuk!'}</p>
          <TombolLanjut />
        </div>
      )}
      {kartu && kartu.length > 0 && <Sesi kartu={kartu} />}
    </main>
  )
}

function TombolLanjut() {
  const { peta } = useNavPenulis()
  const aktif = peta.find((p) => p.status === 'aktif')
  return aktif ? (
    <Link className="btn-besar ph-tautan-tombol" to={`/modul/${aktif.nomor}`}>Lanjut ke Modul {aktif.nomor}</Link>
  ) : (
    <Link className="btn-besar ph-tautan-tombol" to="/">Kembali ke Beranda</Link>
  )
}

function TimerKecil() {
  const { sisa, berjalan, selesai, mulai } = useTimer(180)
  return (
    <div className="baris">
      {berjalan || selesai ? (
        <>
          <span className="ph-timer-kecil" role="timer" aria-live="off">{formatMenit(sisa)}</span>
          <span className="kecil">{selesai ? 'Waktunya habis. Tidak apa-apa kalau lewat.' : 'tidak apa-apa kalau lewat'}</span>
        </>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={mulai}>⏱️ Pakai timer 3 menit</button>
      )}
    </div>
  )
}

function Sesi({ kartu }: { kartu: KartuLatihan[] }) {
  const sisa = kartu.filter((k) => !k.selesai)
  const [i, setI] = useState(0)
  const [hasil, setHasil] = useState<Hasil[]>([])

  if (sisa.length === 0) {
    return (
      <div className="tumpuk">
        <p style={{ fontSize: 'var(--text-lg)' }}>Pemanasan hari ini sudah selesai. Hebat!</p>
        <TombolLanjut />
      </div>
    )
  }

  if (i >= sisa.length) {
    const betul = hasil.filter((h) => h.betul).length
    return (
      <section className="tumpuk" aria-labelledby="judul-hasil">
        <div className="ph-selesai">
          <h2 id="judul-hasil">{betul} dari {hasil.length}!</h2>
          <p>{betul === hasil.length ? 'Semua betul. Alat lamamu masih tajam!' : 'Bagus sudah berlatih. Alat ini akan muncul lagi supaya makin kuat.'}</p>
        </div>
        <ul className="ph-baris-daftar">
          {hasil.map((h, n) => (
            <li key={h.kartu}>
              <span>Kartu {n + 1}{h.alat ? ` · ${h.alat.emoji} ${h.alat.nama}` : ''}</span>
              <span className={h.betul ? 'lencana selesai' : 'lencana'}>{h.betul ? 'Betul' : 'Sudah dilatih'}</span>
            </li>
          ))}
        </ul>
        <TombolLanjut />
      </section>
    )
  }

  const k = sisa[i]
  return (
    <>
      <div className="ph-antara">
        <TimerKecil />
      </div>
      <ol className="ph-langkah-kartu" aria-label={`Kartu ${i + 1} dari ${sisa.length}`}>
        {sisa.map((x, n) => (
          <li key={x.id} className={n < i ? 'selesai' : n === i ? 'sekarang' : undefined} />
        ))}
      </ol>
      <KartuSatu key={k.id} kartu={k} nomor={i + 1} jumlah={sisa.length}
        onSelesai={(h) => setHasil((s) => [...s, h])}
        onLanjut={() => setI((x) => x + 1)} terakhir={i + 1 >= sisa.length} />
    </>
  )
}

function KartuSatu({ kartu: k, nomor, jumlah, onSelesai, onLanjut, terakhir }: {
  kartu: KartuLatihan
  nomor: number
  jumlah: number
  onSelesai: (h: Hasil) => void
  onLanjut: () => void
  terakhir: boolean
}) {
  const { segarkan } = useNavPenulis()
  const [alat, setAlat] = useState<AlatRingkas | null>(k.alat)
  const [pesanAlat, setPesanAlat] = useState<string | null>(null)
  const [salahPilih, setSalahPilih] = useState<string[]>([])
  const [meleset, setMeleset] = useState(0)
  const [selesai, setSelesai] = useState(false)
  const [hadiah, setHadiah] = useState<HadiahBaru[]>([])
  const tutup = useCallback(() => setHadiah([]), [])
  const campuran = k.alat === null

  async function pilih(a: AlatRingkas) {
    try {
      const r = await pilihAlatLatihan(k.id, a.kode)
      if (r.benar) {
        setAlat(r.alat ?? a)
        setPesanAlat(`Betul, ${(r.alat ?? a).nama}!`)
      } else {
        setSalahPilih((s) => [...s, a.kode])
        setPesanAlat(r.pesan ?? 'Hmm, coba baca sekali lagi. Masalahnya apa?')
      }
    } catch (e) {
      setPesanAlat(e instanceof Error ? e.message : 'Coba lagi, ya.')
    }
  }

  function selesaikan(betul: boolean, h: Jawaban & { hadiah_baru?: HadiahBaru[] }) {
    setSelesai(true)
    if (h.hadiah_baru?.length) setHadiah(h.hadiah_baru)
    onSelesai({ kartu: k.id, alat, betul })
    segarkan()
  }

  async function periksaKembar(kata: string): Promise<HasilKembar> {
    const r = await periksaKembarLatihan(k.id, kata)
    if (r.hasil === 'belum') setMeleset((m) => m + 1)
    return r
  }

  const teksPolos = (k.tokens ?? []).map((t) => t.t).join('')
  const tokens = k.tokens ?? []

  return (
    <section className="kartu tumpuk ph-kartu-latihan" aria-label={`Kartu ${nomor} dari ${jumlah}`}>
      <div>
        <p className="ph-label-kecil ph-ungu">
          Kartu {nomor} dari {jumlah} · {alat ? `${alat.emoji} ${alat.nama}` : 'Latihan campuran'}
        </p>
        {alat?.pertanyaan && <p className="ph-sub">“{alat.pertanyaan}”</p>}
        {alat && !selesai && CARA[k.jenis] && <p className="kecil">{CARA[k.jenis]}</p>}
      </div>

      {!alat ? (
        <>
          <div className="teks-latihan" aria-label="Teks latihan">{teksPolos}</div>
          <fieldset style={{ border: 0 }}>
            <legend style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-xl)', marginBottom: 'var(--space-3)' }}>
              Alat apa yang kamu perlukan?
            </legend>
            <div className="ph-pilih-baris">
              {k.pilihan_alat.map((a) => (
                <button key={a.kode} type="button" className="ph-pilih" onClick={() => pilih(a)} disabled={salahPilih.includes(a.kode)}>
                  {a.emoji} {a.nama}
                </button>
              ))}
            </div>
          </fieldset>
          {pesanAlat && <p role="status">{pesanAlat}</p>}
        </>
      ) : (
        <>
          {campuran && pesanAlat && <p role="status">{pesanAlat}</p>}
          {k.jenis === 'klik' && (
            <TeksKlik tokens={tokens} celah={k.celah} jumlah={k.jumlah}
              onKlik={(t) => klikLatihan(k.id, t)} onBerhenti={() => berhentiLatihan(k.id)}
              onSelesai={(h) => selesaikan('total' in h && (h as HasilKlik).ditemukan === (h as HasilKlik).total, h)} />
          )}
          {k.jenis === 'gunting' && (
            <Gunting tokens={tokens} onPeriksa={(p) => periksaGuntingLatihan(k.id, p)}
              onSelesai={(h: HasilGunting) => selesaikan(h.kurang === 0 && h.tidak_perlu.length === 0, h)} />
          )}
          {k.jenis === 'kembar' && (
            <DetektorKembar tokens={tokens} kataUmum={k.kata_umum} onPeriksa={periksaKembar}
              onSelesai={(h) => selesaikan(meleset === 0, h)} />
          )}
        </>
      )}

      {selesai && (
        <button type="button" className="btn-besar" onClick={onLanjut}>
          {terakhir ? 'Lihat hasil' : 'Kartu berikutnya'}
        </button>
      )}
      {hadiah.length > 0 && <PerayaanHadiah hadiah={hadiah} onTutup={tutup} />}
    </section>
  )
}
