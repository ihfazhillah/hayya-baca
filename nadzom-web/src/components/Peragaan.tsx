import { useMemo, useState } from 'react'
import type { Bahts, LangkahPeragaan } from '@/content/jenis'
import type { Huruf } from '@/lib/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { timbangBait } from '@/lib/timbang'
import Hudhud from './Hudhud'
import Papan from './Papan'
import Teks from './Teks'
import TandaiBit from './TandaiBit'
import HasilTimbang from './HasilTimbang'

/** Kitabah per kata; huruf tambahan (tanwin, syaddah, isyba', alif khanjariyah) digarisbawahi emas. */
export function KitabahTeks({ huruf }: { huruf: Huruf[] }) {
  const kata: Huruf[][] = []
  for (const h of huruf) {
    if (!kata.length || kata[kata.length - 1][0].kata !== h.kata) kata.push([])
    kata[kata.length - 1].push(h)
  }
  return (
    <div className="kitabah" lang="ar">
      {kata.map((k, i) => (
        <span key={i}>
          {i > 0 && ' '}
          {k.map((h, j) => (h.tambahan ? <span key={j} className="tambah">{h.h}</span> : <span key={j}>{h.h}</span>))}
        </span>
      ))}
    </div>
  )
}

function BaitPapan({ bait, sorot }: { bait: string[]; sorot?: number }) {
  return (
    <div className="papan-bait" lang="ar">
      {bait.map((s, i) => <div key={i} className={sorot !== undefined && sorot !== i ? 'redup-ar' : undefined}>{s}</div>)}
    </div>
  )
}

/** Peragaan langkah demi langkah oleh Hudhud, lalu giliran pengguna (البحث). */
export default function Peragaan({ bahts, onGiliranBenar }: { bahts: Bahts; onGiliranBenar?: () => void }) {
  const [ke, setKe] = useState(0)
  const bahr = cariBahr(bahts.bahr)!
  const total = bahts.langkah.length + 1
  const giliran = ke === bahts.langkah.length

  const dasar = useMemo(() => {
    const k = kitabahBait(bahts.bait)
    if (!k.ok) throw new Error(k.galat)
    return timbangBait(k.syathr, bahr)
  }, [bahts.bait, bahr])
  const s = dasar.syathr[bahts.syathr]

  const papan = (l: LangkahPeragaan) => {
    switch (l.tampil) {
      case 'bait':
        return <BaitPapan bait={l.bait ?? bahts.bait} sorot={l.bait ? undefined : bahts.syathr} />
      case 'kitabah':
        return (
          <>
            <div className="papan-bait" lang="ar"><div className="redup-ar">{bahts.bait[bahts.syathr]}</div></div>
            <span className="papan-panah">ditulis seperti diucapkan</span>
            <KitabahTeks huruf={s.huruf} />
          </>
        )
      case 'huruf':
        return <><KitabahTeks huruf={s.huruf} /><Papan huruf={s.huruf} /></>
      case 'tanda':
        return <><KitabahTeks huruf={s.huruf} /><Papan huruf={s.huruf} tanda="muncul" /></>
      case 'kelompok':
        return <Papan huruf={s.huruf} kaki={s.potongan} tanda="tampil" juz />
      case 'mizan':
        return <Papan huruf={s.huruf} kaki={s.potongan} tanda="tampil" juz mizan />
      case 'bahr':
        return (
          <>
            <h3 className="ar" style={{ fontSize: 32 }}>{bahr.namaAr}</h3>
            <div className="papan-bait redup" lang="ar" style={{ fontSize: 21 }}>
              {bahr.kunci.map((k, i) => <div key={i}>{k}</div>)}
            </div>
            <BaitPapan bait={bahts.bait} />
          </>
        )
      case 'timbang': {
        const k = kitabahBait(l.bait ?? bahts.bait)
        if (!k.ok) return <p>{k.galat}</p>
        return <HasilTimbang hasil={timbangBait(k.syathr, bahr)} bait={l.bait ?? bahts.bait} />
      }
      case 'teks':
        return <div className="papan-teks"><Teks>{l.papan ?? ''}</Teks></div>
    }
  }

  const l = bahts.langkah[ke]
  return (
    <div className="tumpuk">
      <div className="langkah-bar" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => <span key={i} className={i <= ke ? 'aktif' : ''} />)}
      </div>
      {giliran ? (
        <>
          <Hudhud angguk={ke}><Teks>{bahts.giliran.petunjuk}</Teks></Hudhud>
          <TandaiBit huruf={dasar.syathr[bahts.giliran.syathr].huruf} onBenar={onGiliranBenar} />
        </>
      ) : (
        <>
          {l.tampil === 'timbang' ? <div>{papan(l)}</div> : <div className="papan" key={ke}>{papan(l)}</div>}
          <Hudhud angguk={ke}><Teks>{l.kata}</Teks></Hudhud>
        </>
      )}
      <div className="baris-antara">
        <span className="redup kecil" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {giliran ? 'Giliran Anda' : `Langkah ${ke + 1} dari ${bahts.langkah.length}`}
        </span>
        <div className="baris">
          <button type="button" className="tombol" onClick={() => setKe(ke - 1)} disabled={ke === 0}>Kembali</button>
          {!giliran && (
            <button type="button" className="tombol utama" onClick={() => setKe(ke + 1)}>
              {ke === bahts.langkah.length - 1 ? 'Giliran saya' : 'Lanjut'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
