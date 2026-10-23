import { useMemo, useState } from 'react'
import type { Bahr } from '@/lib/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { DAFTAR_BAHR } from '@/lib/bahr'
import { tebakBahr, timbangBait } from '@/lib/timbang'
import { periksaPotong, pilihanKitabah } from '@/lib/latihan'
import Pilihan from './Pilihan'
import TandaiBit from './TandaiBit'
import Papan from './Papan'
import HasilTimbang from './HasilTimbang'

type Tahap = 'kitabah' | 'tanda' | 'potong'
const TAHAP: { kode: Tahap; judul: string; petunjuk: string }[] = [
  { kode: 'kitabah', judul: "Kitabah 'arudhiyyah", petunjuk: 'Pilih tulisan yang sesuai bunyinya: yang diucapkan ditulis, yang tidak diucapkan tidak ditulis.' },
  { kode: 'tanda', judul: 'Beri tanda', petunjuk: 'Ketuk kotak di bawah setiap huruf: 1 untuk huruf hidup, 0 untuk huruf mati (sukun atau mad).' },
  { kode: 'potong', judul: "Potong per taf'ilah", petunjuk: "Ketuk celah di antara dua huruf untuk memotong. Setiap potongan harus menjadi taf'ilah yang dikenal." },
]

interface Props {
  bait: string[]
  /** Bahr sasaran; kosong = ditebak dari bait. */
  bahr?: Bahr
  judulDiwan?: string
}

/**
 * Taqthi' bertahap (metode Abu Qudamah): per syathr, kitabah → tanda → potong; lalu menentukan bahr.
 * Pemeriksa menunjukkan letak salah, jawaban baru dibuka setelah mencoba.
 */
export default function TaqthiBertahap({ bait, bahr, judulDiwan }: Props) {
  const kitabah = useMemo(() => kitabahBait(bait), [bait])
  const [syathr, setSyathr] = useState(0)
  const [tahap, setTahap] = useState(0)
  const [selesaiSyathr, setSelesaiSyathr] = useState(false)
  const [batas, setBatas] = useState<number[]>([])
  const [cekPotong, setCekPotong] = useState<ReturnType<typeof periksaPotong> | null>(null)
  const [lihatPotong, setLihatPotong] = useState(false)
  const [bahrBenar, setBahrBenar] = useState(false)

  if (!kitabah.ok) return <div className="pesan salah">{kitabah.galat}</div>
  const hasil = bahr ? timbangBait(kitabah.syathr, bahr) : tebakBahr(kitabah.syathr)
  const sasaran = hasil.bahr
  const huruf = kitabah.syathr[syathr]
  const slot = sasaran.slot[syathr === bait.length - 1 && bait.length > 1 ? 1 : 0]
  const semuaSyathrSelesai = syathr === bait.length - 1 && selesaiSyathr
  const t = TAHAP[tahap]

  const lanjutTahap = () => {
    if (tahap < TAHAP.length - 1) {
      setTahap(tahap + 1)
    } else {
      setSelesaiSyathr(true)
    }
  }
  const syathrBerikut = () => {
    setSyathr(syathr + 1)
    setTahap(0)
    setSelesaiSyathr(false)
    setBatas([])
    setCekPotong(null)
    setLihatPotong(false)
  }
  const celah = (i: number) => {
    setCekPotong(null)
    setBatas((b) => (b.includes(i) ? b.filter((x) => x !== i) : [...b, i]))
  }

  if (semuaSyathrSelesai && bahrBenar) {
    return (
      <div className="tumpuk">
        <div className="pesan ok">Selesai. Inilah timbangan lengkapnya.</div>
        <HasilTimbang hasil={hasil} bait={bait} salin judulDiwan={judulDiwan} />
      </div>
    )
  }

  if (semuaSyathrSelesai) {
    const pilihan = DAFTAR_BAHR.map((b) => b.nama)
    return (
      <div className="tumpuk">
        <span className="label">Langkah terakhir · Tentukan bahr</span>
        <Pilihan
          soal="Dari taf'ilah yang Anda temukan, bait ini dari bahr apa?"
          pilihan={pilihan}
          jawaban={DAFTAR_BAHR.findIndex((b) => b.kode === sasaran.kode)}
          onBenar={() => setBahrBenar(true)}
        />
      </div>
    )
  }

  const pilihanK = pilihanKitabah(bait, syathr)
  return (
    <div className="tumpuk">
      <div className="baris-antara">
        <span className="label">
          {bait.length > 1 ? `Syathr ${syathr + 1} dari ${bait.length} · ` : ''}Langkah {tahap + 1} dari {TAHAP.length}: {t.judul}
        </span>
      </div>
      <div className="papan-bait" lang="ar" style={{ fontSize: 24 }}>
        {bait.map((s, i) => <div key={i} className={i !== syathr ? 'redup-ar' : undefined}>{s}</div>)}
      </div>
      <p>{t.petunjuk}</p>

      {selesaiSyathr ? (
        <div className="tumpuk">
          <div className="pesan ok">Syathr {syathr + 1} selesai ditimbang.</div>
          <div className="baris"><button type="button" className="tombol utama" onClick={syathrBerikut}>Lanjut ke syathr {syathr + 2}</button></div>
        </div>
      ) : t.kode === 'kitabah' ? (
        <Pilihan key={`k-${syathr}`} pilihan={pilihanK.pilihan} jawaban={pilihanK.benar} arab onBenar={() => setTimeout(lanjutTahap, 600)} />
      ) : t.kode === 'tanda' ? (
        <TandaiBit key={`t-${syathr}`} huruf={huruf} onBenar={() => setTimeout(lanjutTahap, 600)} />
      ) : (
        <div className="tumpuk">
          <div className="papan">
            {lihatPotong
              ? <Papan huruf={huruf} kaki={hasil.syathr[syathr].potongan} tanda="tampil" mizan status />
              : <Papan huruf={huruf} tanda="tampil" batas={batas} onCelah={celah} />}
          </div>
          {cekPotong && !lihatPotong && (
            <div className={`pesan ${cekPotong.benar ? 'ok' : 'salah'}`}>
              {cekPotong.benar
                ? `Tepat: ${cekPotong.segmen.map((x) => x.cocok!.nama).join(' · ')}`
                : `Belum: ${cekPotong.segmen.map((x) => x.cocok ? `${x.bit} ✓` : `${x.bit} ✗`).join(' · ')}. Butuh ${slot.length} taf'ilah yang dikenal.`}
            </div>
          )}
          <div className="baris">
            {cekPotong?.benar || lihatPotong ? (
              <button type="button" className="tombol utama" onClick={lanjutTahap}>Lanjut</button>
            ) : (
              <>
                <button type="button" className="tombol utama" onClick={() => setCekPotong(periksaPotong(huruf, batas, slot))} disabled={batas.length === 0}>
                  Periksa potongan
                </button>
                <button type="button" className="tombol" onClick={() => setLihatPotong(true)} disabled={!cekPotong}>Lihat jawaban</button>
              </>
            )}
            <span className="redup kecil">{batas.length} kali dipotong</span>
          </div>
        </div>
      )}
    </div>
  )
}
