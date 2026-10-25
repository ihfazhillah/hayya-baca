import type { HasilSyathr } from '@/lib/jenis'
import { juzBentuk } from '@/lib/lagu'

/** Satu syathr dipotong per taf'ilah: teks kitabah tiap kotak beserta lagunya (لا/نعم). */
export default function KotakTafilah({ syathr, label }: { syathr: HasilSyathr; label: string }) {
  return (
    <div className="pola-kotak-baris" dir="rtl" aria-label={label}>
      {syathr.potongan.map((p, x) => (
        <span key={x} className="pola-kotak">
          <span lang="ar">{syathr.huruf.slice(p.mulai, p.akhir).map((h) => h.h).join('')}</span>
          <span className="juz-lagu" lang="ar">{juzBentuk(p.bit, p.bentuk).map((j) => j.lagu ?? j.bit).join(' ')}</span>
        </span>
      ))}
    </div>
  )
}
