import { useState } from 'react'
import type { JenisLaci, KataBank } from '@/content/jenis'
import { BANK_KATA } from '@/content'
import { kitabahBait } from '@/lib/kitabah'
import Teks from './Teks'

export const NAMA_LACI: Record<JenisLaci, string> = {
  hasyw: 'Laci hasyw (frasa pengisi)',
  wazan: 'Laci wazan sharaf',
  qafiyah: 'Laci qafiyah',
  umum: 'Kata umum',
}
const URUT: JenisLaci[] = ['hasyw', 'wazan', 'qafiyah', 'umum']

const pola = (teks: string) => {
  const r = kitabahBait([teks], { tanpaAkhir: true })
  return r.ok ? r.syathr[0].map((h) => h.bit).join('') : ''
}

/** Laci kata: dikelompokkan per laci, dengan pola bit dan asal katanya. */
export default function Laci({ kata = BANK_KATA, pilihLaci = true }: { kata?: KataBank[]; pilihLaci?: boolean }) {
  const [laci, setLaci] = useState<JenisLaci | 'semua'>('semua')
  const ada = URUT.filter((l) => kata.some((k) => (k.laci ?? 'umum') === l))
  const tampil = laci === 'semua' ? ada : [laci]

  return (
    <div className="tumpuk">
      {pilihLaci && ada.length > 1 && (
        <div className="baris" role="group" aria-label="Pilih laci">
          {(['semua', ...ada] as const).map((l) => (
            <button key={l} type="button" className={`tombol kecil${laci === l ? ' utama' : ''}`} aria-pressed={laci === l} onClick={() => setLaci(l)}>
              {l === 'semua' ? 'Semua' : NAMA_LACI[l]}
            </button>
          ))}
        </div>
      )}
      {tampil.map((l) => (
        <div className="tabel-wrap" key={l}>
          <table>
            <thead><tr><th>{NAMA_LACI[l]}</th><th>Pola</th><th>Arti</th></tr></thead>
            <tbody>
              {kata.filter((k) => (k.laci ?? 'umum') === l).map((k) => (
                <tr key={k.teks}>
                  <td className="ar" lang="ar">{k.teks}</td>
                  <td className="bit">{pola(k.teks)}</td>
                  <td>
                    {k.arti}
                    {(k.catatan || k.dari) && (
                      <div className="redup kecil">
                        {k.catatan && <Teks>{k.catatan}</Teks>}
                        {k.catatan && k.dari && ' · '}
                        {k.dari && <>dari {k.dari}</>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
