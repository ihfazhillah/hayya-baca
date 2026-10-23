import { Link } from 'react-router-dom'

type TitikPeta = { nomor: number; judul: string; status: 'selesai' | 'aktif' | 'terkunci' }

const STATUS = { selesai: 'selesai', aktif: 'sedang dikerjakan', terkunci: 'terkunci' } as const

/** Titik modul bernomor di nav. Modul terkunci tampil dengan gembok dan tidak bisa diklik. */
export function TitikModul({ peta, nomor }: { peta: TitikPeta[]; nomor?: number }) {
  if (!peta.length) return null
  return (
    <div className="nav-modul" aria-label="Modul">
      <span className="nav-modul-label" aria-hidden="true">Modul</span>
      {peta.map((t) => {
        const label = `Modul ${t.nomor}, ${t.judul}, ${STATUS[t.status]}`
        const di = nomor === t.nomor || (nomor === undefined && t.status === 'aktif')
        if (t.status === 'terkunci') {
          return <span key={t.nomor} className="nav-modul-titik terkunci" aria-label={label} title={label}>{t.nomor}</span>
        }
        return (
          <Link key={t.nomor} to={`/modul/${t.nomor}`} aria-label={label} title={label}
            aria-current={t.status === 'aktif' ? 'step' : undefined}
            className={`nav-modul-titik ${t.status}${di ? ' di-sini' : ''}`}>
            {t.nomor}
          </Link>
        )
      })}
    </div>
  )
}

/** Tombol ke modul sebelumnya dan berikutnya di halaman modul. */
export function SebelumBerikut({ peta, nomor }: { peta: TitikPeta[]; nomor: number }) {
  const i = peta.findIndex((t) => t.nomor === nomor)
  if (i < 0) return null
  const sebelum = peta[i - 1]
  const berikut = peta[i + 1]
  return (
    <nav className="nav-sebelum-berikut" aria-label="Modul lain">
      {sebelum ? (
        <Link className="btn btn-ghost" to={`/modul/${sebelum.nomor}`}>← Modul {sebelum.nomor} · {sebelum.judul}</Link>
      ) : <span />}
      {berikut && (berikut.status === 'terkunci' ? (
        <span className="btn btn-ghost terkunci" aria-disabled="true">🔒 Modul {berikut.nomor} · {berikut.judul}</span>
      ) : (
        <Link className="btn btn-ghost" to={`/modul/${berikut.nomor}`}>Modul {berikut.nomor} · {berikut.judul} →</Link>
      ))}
    </nav>
  )
}
