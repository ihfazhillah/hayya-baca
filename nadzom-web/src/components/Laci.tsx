import { useEffect, useId, useMemo, useState } from 'react'
import type { JenisLaci, KataBank, KodeBahr } from '@/content/jenis'
import { BANK_KATA, laciUntuk } from '@/content'
import { kitabahBait } from '@/lib/kitabah'
import { PERISTIWA, bacaLaci, hapusKata, imporMarkdown, keMarkdown, type KataSaya } from '@/lib/laciSaya'
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

interface Props {
  /** Daftar kata tetap (mis. laci satu modul); tanpa Laci saya. */
  kata?: KataBank[]
  pilihLaci?: boolean
  /** Saring: hanya kata dari modul yang sudah dibuka sampai modul ini. */
  sampai?: number
  /** Saring: hanya kata dari bahr ini (dan kata umum). */
  bahr?: KodeBahr
  /** Saring: hanya kata bertema ini (Fase E). */
  tema?: string
  /** Hanya Laci saya; laci bawaan tidak ditampilkan (Ujian Akhir). */
  hanyaSaya?: boolean
}

/** Laci kata: Laci saya (hasil panen sendiri) lalu laci bawaan, dikelompokkan per laci, dengan pola bit dan asalnya. */
export default function Laci({ kata, pilihLaci = true, sampai, bahr, tema, hanyaSaya }: Props) {
  const id = useId()
  const [laci, setLaci] = useState<JenisLaci | 'semua'>('semua')
  const [cari, setCari] = useState('')
  const sumber = useMemo(() => {
    const dasar = kata ?? (sampai === undefined ? BANK_KATA : laciUntuk(sampai, bahr))
    return tema ? dasar.filter((k) => k.tema?.includes(tema)) : dasar
  }, [kata, sampai, bahr, tema])
  const isi = useMemo(() => sumber.map((k) => ({ ...k, pola: pola(k.teks) })), [sumber])
  const q = cari.trim().toLowerCase()
  const cocok = q
    ? isi.filter((k) => k.arti.toLowerCase().includes(q) || polos(k.teks).includes(polos(q)) || k.pola.startsWith(q))
    : isi
  const ada = URUT.filter((l) => isi.some((k) => (k.laci ?? 'umum') === l))
  const tampil = (laci === 'semua' ? ada : [laci]).filter((l) => cocok.some((k) => (k.laci ?? 'umum') === l))

  if (hanyaSaya) return <LaciSaya cari={q} />
  return (
    <div className="tumpuk">
      {!kata && <LaciSaya cari={q} />}
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

/** Laci saya: kata yang dipanen sendiri. Ekspor dan impor Markdown karena data browser bisa hilang. */
function LaciSaya({ cari }: { cari: string }) {
  const [daftar, setDaftar] = useState<KataSaya[]>(bacaLaci)
  const [ekspor, setEkspor] = useState(false)
  const [impor, setImpor] = useState('')
  const [pesan, setPesan] = useState('')
  useEffect(() => {
    const segar = () => setDaftar(bacaLaci())
    window.addEventListener(PERISTIWA, segar)
    return () => window.removeEventListener(PERISTIWA, segar)
  }, [])
  const tampil = cari ? daftar.filter((k) => k.arti.toLowerCase().includes(cari) || polos(k.teks).includes(polos(cari)) || k.pola.startsWith(cari)) : daftar

  return (
    <section className="kartu tumpuk" aria-label="Laci saya">
      <div className="baris-antara">
        <span className="label">Laci saya · {daftar.length} kata</span>
        <div className="baris" style={{ gap: 'var(--s-2)' }}>
          <button type="button" className="tombol kecil" onClick={() => setEkspor(!ekspor)} aria-expanded={ekspor}>Ekspor Laci saya</button>
        </div>
      </div>
      {daftar.length === 0 && <p className="redup kecil">Belum ada. Panen kata dari bait yang Anda baca atau dengar: pilih potongan yang pas satu taf'ilah, beri arti, simpan.</p>}
      {tampil.length > 0 && (
        <div className="tabel-wrap">
          <table className="tabel-tetap laci">
            <colgroup><col className="laci-k-kata" /><col className="laci-k-pola" /><col /></colgroup>
            <thead><tr><th className="ar-kepala">Kata</th><th className="laci-k-pola">Pola</th><th>Arti</th></tr></thead>
            <tbody>
              {tampil.map((k) => (
                <tr key={k.teks}>
                  <td className="ar" lang="ar">
                    {k.teks}
                    <div className="bit laci-pola-sel" dir="ltr">{k.pola}</div>
                  </td>
                  <td className="bit laci-k-pola">{k.pola}</td>
                  <td>
                    {k.arti}
                    <div className="redup kecil">
                      {[k.cocok, k.sumber.length ? `dari ${k.sumber.join('; ')}` : ''].filter(Boolean).join(' · ')}{' '}
                      <button type="button" className="tombol-teks" onClick={() => hapusKata(k.teks)} aria-label={`Hapus ${k.teks}`}>hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ekspor && (
        <div className="tumpuk-kecil">
          <textarea readOnly rows={6} value={keMarkdown(daftar)} aria-label="Markdown Laci saya" onFocus={(e) => e.target.select()} />
          <span className="bantu">Salin dan simpan di Obsidian atau catatan. Data di browser bisa hilang bila dibersihkan.</span>
          <label className="bantu" htmlFor="impor-laci">Impor: tempel tabel Markdown hasil ekspor</label>
          <textarea id="impor-laci" rows={3} value={impor} onChange={(e) => setImpor(e.target.value)} />
          <div className="baris">
            <button type="button" className="tombol kecil" disabled={!impor.trim()} onClick={() => { setPesan(`${imporMarkdown(impor)} kata diimpor.`); setImpor('') }}>Impor</button>
            {pesan && <span className="chip ok">{pesan}</span>}
          </div>
        </div>
      )}
    </section>
  )
}
