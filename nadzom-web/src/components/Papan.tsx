import { Fragment } from 'react'
import type { Bentuk, Huruf, Status } from '@/lib/jenis'
import { pecahJuz } from '@/lib/juz'

export interface Kaki {
  mulai: number
  akhir: number
  bentuk?: Bentuk
  status?: Status
}

interface Props {
  huruf: Huruf[]
  /** Potongan taf'ilah. Tanpa potongan: satu baris huruf dengan jeda antar kata. */
  kaki?: Kaki[]
  tanda?: 'tidak' | 'tampil' | 'muncul'
  juz?: boolean
  mizan?: boolean
  status?: boolean
  /** Mode tandai: jawaban per huruf dan pemeriksaannya. */
  jawab?: (0 | 1 | null)[]
  onKetuk?: (i: number) => void
  periksa?: boolean[] | null
  /** Mode potong: celah sebelum huruf ke-i (1..n-1) aktif bila ada di `batas`. */
  batas?: number[]
  onCelah?: (i: number) => void
  sorotTambahan?: boolean
}

const NAMA_JUZ = { sabab: 'sabab', watad: 'watad', tunggal: '' } as const
const LABEL_STATUS: Record<Status, string> = { utuh: 'utuh', berubah: 'berubah', patah: 'patah' }

/** Papan huruf kitabah 'arudhiyyah: sel per huruf, tanda 1/0 di bawahnya, dikelompokkan per taf'ilah. */
export default function Papan({
  huruf, kaki, tanda = 'tidak', juz, mizan, status, jawab, onKetuk, periksa, batas, onCelah, sorotTambahan,
}: Props) {
  const kelompok: Kaki[] = kaki ?? [{ mulai: 0, akhir: huruf.length }]
  const pakaiJeda = !kaki
  let urutan = 0

  const sel = (i: number) => {
    const h = huruf[i]
    const berikut = huruf[i + 1]
    const jeda = pakaiJeda && berikut && berikut.kata !== h.kata
    let isiBit: React.ReactNode = null
    if (onKetuk && jawab) {
      const v = jawab[i]
      const cek = periksa ? (periksa[i] ? ' benar' : ' salah') : ''
      isiBit = (
        <button
          type="button"
          className={`sel-b${v !== null && v !== undefined ? ' terisi' : ''}${cek}`}
          onClick={() => onKetuk(i)}
          aria-label={`Huruf ${h.h}: ${v === null || v === undefined ? 'belum ditandai' : v}`}
        >
          {v ?? '·'}
        </button>
      )
    } else if (tanda !== 'tidak') {
      const d = urutan++
      isiBit = (
        <span className={`sel-b${tanda === 'muncul' ? ' muncul' : ''}`} style={tanda === 'muncul' ? { animationDelay: `${d * 80}ms` } : undefined}>
          {h.bit}
        </span>
      )
    } else {
      isiBit = <span className="sel-b" />
    }
    return (
      <Fragment key={i}>
        {onCelah && i > 0 && (
          <button
            type="button"
            className={`celah${batas?.includes(i) ? ' aktif' : ''}`}
            onClick={() => onCelah(i)}
            aria-label={`Potong sebelum huruf ${h.h}`}
            aria-pressed={batas?.includes(i) ?? false}
          />
        )}
        <div className={`sel${jeda ? ' jeda' : ''}${periksa && periksa[i] === false ? ' ditandai' : ''}`}>
          <span className={`sel-h${sorotTambahan && h.tambahan ? ' tambah' : ''}`} lang="ar">{h.h}</span>
          {isiBit}
        </div>
      </Fragment>
    )
  }

  return (
    <div className="sel-baris">
      {kelompok.map((k, ki) => {
        const bit = huruf.slice(k.mulai, k.akhir).map((h) => h.bit).join('')
        return (
          <div className={`kaki${status && k.status === 'patah' ? ' patah' : ''}`} key={ki}>
            <div className="kaki-sel">
              {Array.from({ length: k.akhir - k.mulai }, (_, j) => sel(k.mulai + j))}
            </div>
            {juz && (
              <div className="juz" aria-label="sabab dan watad">
                {pecahJuz(bit).map((j, x) => (
                  <span key={x} className={`juz-item ${j.jenis}`} style={{ width: `calc(var(--sel) * ${j.bit.length} - 2px)` }}>
                    <span className="bit">{j.bit}</span>
                    {NAMA_JUZ[j.jenis]}
                  </span>
                ))}
              </div>
            )}
            {mizan && k.bentuk && (
              <div className="mizan" lang="ar">
                {k.bentuk.nama}
                {k.bentuk.namaLain && k.status !== 'patah' && <span className="mizan-lain">{k.bentuk.namaLain}</span>}
              </div>
            )}
            {status && k.status && (
              <span className={`status-kaki ${k.status}${k.bentuk?.nilai === 'qabih' && k.status === 'berubah' ? ' qabih' : ''}`}>
                {LABEL_STATUS[k.status]}
                {k.status === 'berubah' && k.bentuk?.zihaf ? ` · ${k.bentuk.illah ? "'illah " : ''}${k.bentuk.zihaf}` : ''}
                {k.status === 'berubah' && k.bentuk?.nilai === 'qabih' ? ' (kurang baik)' : ''}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
