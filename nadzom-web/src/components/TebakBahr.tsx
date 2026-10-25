import { useMemo } from 'react'
import type { KodeBahr, SoalPilih } from '@/content/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { timbangBait } from '@/lib/timbang'
import Kenali from './Kenali'

interface Props {
  petunjuk: string
  pilihan: KodeBahr[]
  baris: { bait: string[]; bahr: KodeBahr; sumber: string }[]
}

/** Tebak bahr: setiap bait asing jadi satu soal; alasan berisi taf'ilah hasil timbangan mesin. */
export default function TebakBahr({ petunjuk, pilihan, baris }: Props) {
  const soal = useMemo<SoalPilih[]>(
    () =>
      baris.map((b) => {
        const bahr = cariBahr(b.bahr)!
        const k = kitabahBait(b.bait)
        const kaki = k.ok ? timbangBait(k.syathr, bahr).syathr[0].potongan.map((p) => p.bentuk.nama).join(' ') : ''
        return {
          soal: b.bait.join(' / '),
          pilihan: pilihan.map((x) => cariBahr(x)!.nama),
          jawaban: pilihan.indexOf(b.bahr),
          alasan: `${bahr.nama}. Syathr pertama: ${kaki}. ${b.sumber}`,
        }
      }),
    [baris, pilihan],
  )
  return <Kenali petunjuk={petunjuk} soal={soal} />
}
