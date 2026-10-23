import { useId, useMemo, useState } from 'react'
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

const polos = (t: string) => t.replace(/[\u064B-\u0652\u0670\u0640]/g, '')

/** Laci kata: dikelompokkan per laci, dengan pola bit dan asal katanya. */
export default function Laci({ kata = BANK_KATA, pilihLaci = true }: { kata?: KataBank[]; pilihLaci?: boolean }) {
  const id = useId()
  const [laci, setLaci] = useState<JenisLaci | 'semua'>('semua')
  const [cari, setCari] = useState('')
  const isi = useMemo(() => kata.map((k) => ({ ...k, pola: pola(k.teks) })), [kata])
  const q = cari.trim().toLowerCase()
  const cocok = q
    ? isi.filter((k) => k.arti.toLowerCase().includes(q) || polos(k.teks).includes(polos(q)) || k.pola.startsWith(q))
    : isi
  const ada = URUT.filter((l) => isi.some((k) => (k.laci ?? 'umum') === l))
  const tampil = (laci === 'semua' ? ada : [laci]).filter((l) => cocok.some((k) => (k.laci ?? 'umum') === l))

  return (
    <div className="tumpuk">
      {pilihLaci && (
        <div className="laci-cari">
          <input id={id} type="text" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kata, arti, atau pola bit" aria-label="Cari di laci" />
          <span className="redup kecil" aria-live="polite">{cocok.length} kata</span>
        </div>
      )}
      {pilihLaci && ada.length > 1 && (
        <div className="baris" role="group" aria-label="Pilih laci" style={{ gap: 'var(--s-2)' }}>
          {(['semua', ...ada] as const).map((l) => (
            <button key={l} type="button" className={`tombol kecil${laci === l ? ' utama' : ''}`} aria-pressed={laci === l} onClick={() => setLaci(l)}>
              {l === 'semua' ? 'Semua' : NAMA_LACI[l]}
            </button>
          ))}
        </div>
      )}
      {tampil.length === 0 && <p className="pesan info">Tidak ada kata yang cocok.</p>}
      {tampil.map((l) => {
        const baris = cocok.filter((k) => (k.laci ?? 'umum') === l)
        return (
          <div className="tabel-wrap" key={l}>
            <table className="tabel-tetap laci">
              <caption>{NAMA_LACI[l]} <span className="redup">· {baris.length}</span></caption>
              <colgroup><col className="laci-k-kata" /><col className="laci-k-pola" /><col /></colgroup>
              <thead><tr><th className="ar-kepala">Kata</th><th className="laci-k-pola">Pola</th><th>Arti</th></tr></thead>
              <tbody>
                {baris.map((k) => (
                  <tr key={k.teks}>
                    <td className="ar" lang="ar">
                      {k.teks}
                      <div className="bit laci-pola-sel" dir="ltr">{k.pola}</div>
                    </td>
                    <td className="bit laci-k-pola">{k.pola}</td>
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
        )
      })}
    </div>
  )
}
