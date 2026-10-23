import { Fragment, type ReactNode } from 'react'

/** Rangkaian huruf Arab (beserta harakat dan spasi di antaranya). */
const ARAB = /([؀-ۿ](?:[؀-ۿ\s]*[؀-ۿ])?)/g

function arab(teks: string, kunci: string): ReactNode[] {
  return teks.split(ARAB).map((bagian, i) =>
    i % 2 === 1
      ? <span key={`${kunci}-${i}`} className="ar-in" lang="ar" dir="rtl">{bagian}</span>
      : <Fragment key={`${kunci}-${i}`}>{bagian}</Fragment>,
  )
}

/** Teks isi course: `**tebal**`, baris baru, dan huruf Arab otomatis memakai font Arab. */
export default function Teks({ children }: { children: string }) {
  return (
    <>
      {children.split('\n').map((baris, b) => (
        <Fragment key={b}>
          {b > 0 && <br />}
          {baris.split(/\*\*(.+?)\*\*/g).map((bagian, i) =>
            i % 2 === 1 ? <strong key={i}>{arab(bagian, `${b}-${i}`)}</strong> : <Fragment key={i}>{arab(bagian, `${b}-${i}`)}</Fragment>,
          )}
        </Fragment>
      ))}
    </>
  )
}
