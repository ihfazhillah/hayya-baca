import type { ReactNode } from 'react'

/** Hudhud: jambul emas berujung hitam, badan perunggu, sayap bergaris, paruh panjang. */
export function WajahHudhud({ angguk }: { angguk?: number }) {
  return (
    <svg viewBox="0 0 60 60" className="hudhud-wajah" aria-hidden="true">
      <g className="angguk" key={angguk}>
        <path d="M22 18 L14 4 L20 15 L19 2 L25 14 L27 3 L29 15 L33 6 L31 17 Z" fill="#d4af37" />
        <path d="M14 4 L16 8 L17.6 7 Z M19 2 L20.3 6.6 L21.6 5.6 Z M27 3 L27.6 7.6 L28.9 7 Z M33 6 L31.4 9.4 L32.8 9.8 Z" fill="#0a1428" />
        <path d="M44 20 L58 16 L44 23 Z" fill="#3a2a1a" />
        <ellipse cx="34" cy="24" rx="11" ry="9" fill="#b08968" />
        <ellipse cx="28" cy="40" rx="17" ry="12" fill="#b08968" />
        <path d="M14 36 Q28 30 40 40 Q30 50 14 46 Z" fill="#faf3e0" />
        <path d="M16 37 L38 41 M15 41 L36 45 M16 45 L32 48" stroke="#0a1428" strokeWidth="2.6" />
        <path d="M12 44 L2 52 L14 48 Z" fill="#0a1428" />
        <circle cx="38" cy="22" r="2.2" fill="#0a1428" />
        <circle cx="38.7" cy="21.3" r=".7" fill="#faf3e0" />
        <path d="M26 52 L25 58 M32 52 L33 58" stroke="#6b4a2b" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** Gelembung kata Hudhud. `angguk` berganti → Hudhud mengangguk. */
export default function Hudhud({ children, angguk }: { children: ReactNode; angguk?: number }) {
  return (
    <section className="hudhud" aria-live="polite">
      <WajahHudhud angguk={angguk} />
      <div className="hudhud-isi">
        <span className="hudhud-nama">Hudhud</span>
        <p>{children}</p>
      </div>
    </section>
  )
}
