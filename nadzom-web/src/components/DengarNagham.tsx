import type { DengarBahr } from '@/lib/jenis'

/** Nagham bahr dari ahlinya: video asli diputar lewat embed YouTube, tidak disalin. */
export default function DengarNagham({ dengar }: { dengar: DengarBahr }) {
  return (
    <div className="kartu dengar-nagham">
      <span className="label">Dengar dari ahlinya</span>
      <div className="video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${dengar.youtube}`}
          title={`${dengar.judul} · ${dengar.sumber}`}
          loading="lazy"
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      <span className="redup kecil">{dengar.judul} · {dengar.sumber}</span>
    </div>
  )
}
