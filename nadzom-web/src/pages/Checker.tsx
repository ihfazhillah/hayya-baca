import { useId, useState } from 'react'
import { kitabahBait, pisahBait } from '@/lib/kitabah'
import { apakahLatin, latinKeHuruf } from '@/lib/latin'
import { DAFTAR_BAHR, cariBahr } from '@/lib/bahr'
import { tebakBahr, timbangBait } from '@/lib/timbang'
import type { HasilBait } from '@/lib/jenis'
import HasilTimbang from '@/components/HasilTimbang'
import TaqthiBertahap from '@/components/TaqthiBertahap'

const CONTOH = 'دَارٌ لِسَلْمَى إِذْ سُلَيْمَى جَارَةٌ\nقَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ'

type Mode = 'cepat' | 'bertahap'

export default function Checker() {
  const idTeks = useId()
  const idBahr = useId()
  const [teks, setTeks] = useState(CONTOH)
  const [kodeBahr, setKodeBahr] = useState('otomatis')
  const [mode, setMode] = useState<Mode>('cepat')
  const [dikirim, setDikirim] = useState<{ teks: string; kodeBahr: string; mode: Mode; nonce: number }>({ teks: CONTOH, kodeBahr: 'otomatis', mode: 'cepat', nonce: 0 })

  const bait = pisahBait(dikirim.teks)
  const bahr = dikirim.kodeBahr === 'otomatis' ? undefined : cariBahr(dikirim.kodeBahr)
  const latin = apakahLatin(dikirim.teks)
  let hasil: HasilBait | null = null
  let galat = ''
  if (latin) {
    const syathr = bait.map(latinKeHuruf)
    hasil = bahr ? timbangBait(syathr, bahr) : tebakBahr(syathr)
  } else {
    const k = kitabahBait(bait)
    if (k.ok) hasil = bahr ? timbangBait(k.syathr, bahr) : tebakBahr(k.syathr)
    else galat = k.galat
  }

  const timbang = () => setDikirim({ teks, kodeBahr, mode, nonce: dikirim.nonce + 1 })

  return (
    <>
      <section className="judul-halaman">
        <span className="label">Alat</span>
        <h1>Timbang bait</h1>
        <p className="lead">Tulis bait berharakat, satu syathr per baris. Suku kata Latin juga bisa: <span className="bit">daa-run-li-sal-maa</span>.</p>
      </section>

      <section className="kartu" aria-label="Masukan">
        <div className="isian">
          <label htmlFor={idTeks}>Bait</label>
          <textarea id={idTeks} className={apakahLatin(teks) ? '' : 'ar'} dir="auto" rows={3} value={teks} onChange={(e) => setTeks(e.target.value)} />
          <span className="bantu">Pemisah syathr: baris baru atau tanda |. Kata tanpa harakat akan ditolak, bukan ditebak.</span>
        </div>
        <div className="baris" style={{ alignItems: 'flex-end' }}>
          <div className="isian" style={{ flex: '1 1 200px' }}>
            <label htmlFor={idBahr}>Bahr sasaran</label>
            <select id={idBahr} value={kodeBahr} onChange={(e) => setKodeBahr(e.target.value)}>
              <option value="otomatis">Tebak otomatis</option>
              {DAFTAR_BAHR.map((b) => <option key={b.kode} value={b.kode}>{b.nama}</option>)}
            </select>
          </div>
          <div className="isian">
            <span className="kecil" style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Mode</span>
            <div className="segmen" role="group" aria-label="Mode">
              <button type="button" aria-pressed={mode === 'cepat'} onClick={() => setMode('cepat')}>Cepat</button>
              <button type="button" aria-pressed={mode === 'bertahap'} onClick={() => setMode('bertahap')} disabled={apakahLatin(teks)}>Bertahap</button>
            </div>
          </div>
          <button type="button" className="tombol utama" onClick={timbang} disabled={!teks.trim()}>Timbang</button>
        </div>
      </section>

      <section className="tumpuk" aria-label="Hasil">
        {galat && <div className="pesan salah">{galat}</div>}
        {hasil && (dikirim.mode === 'bertahap' && !latin
          ? <div className="kartu"><TaqthiBertahap key={dikirim.nonce} bait={bait} bahr={bahr} /></div>
          : <HasilTimbang key={dikirim.nonce} hasil={hasil} bait={bait} salin />)}
      </section>
    </>
  )
}
