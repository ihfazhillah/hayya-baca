import { useEffect, useMemo, useRef, useState } from 'react'
import type { HasilBait } from '@/lib/jenis'
import { sukuKata } from '@/lib/irama'

const PENDEK = 0.22
const PANJANG = 0.44

/** Putar irama bait: suku pendek ketukan singkat, suku panjang ketukan panjang; awal taf'ilah ditekan. */
export default function Irama({ hasil }: { hasil: HasilBait }) {
  const baris = useMemo(() => hasil.syathr.map(sukuKata), [hasil])
  const [aktif, setAktif] = useState<[number, number] | null>(null)
  const [pelan, setPelan] = useState(false)
  const ctx = useRef<AudioContext | null>(null)
  const timer = useRef<number[]>([])

  const henti = () => {
    timer.current.forEach((t) => window.clearTimeout(t))
    timer.current = []
    void ctx.current?.close()
    ctx.current = null
    setAktif(null)
  }
  useEffect(() => henti, [])

  const putar = () => {
    henti()
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    const ac = AC ? new AC() : null
    ctx.current = ac
    const skala = pelan ? 1.6 : 1
    let t = 0.1
    baris.forEach((suku, b) => {
      suku.forEach((s, i) => {
        const lama = (s.panjang ? PANJANG : PENDEK) * skala
        if (ac) {
          const o = ac.createOscillator()
          const g = ac.createGain()
          o.frequency.value = s.panjang ? 392 : 523
          const keras = s.awalKaki ? 0.32 : 0.16
          g.gain.setValueAtTime(0, ac.currentTime + t)
          g.gain.linearRampToValueAtTime(keras, ac.currentTime + t + 0.01)
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + lama * 0.85)
          o.connect(g).connect(ac.destination)
          o.start(ac.currentTime + t)
          o.stop(ac.currentTime + t + lama)
        }
        timer.current.push(window.setTimeout(() => setAktif([b, i]), t * 1000))
        t += lama
      })
      t += PANJANG * skala
    })
    timer.current.push(window.setTimeout(() => setAktif(null), t * 1000))
  }

  return (
    <div className="tumpuk-kecil">
      {baris.map((suku, b) => (
        <div className="irama" dir="rtl" lang="ar" key={b} aria-label={`Irama syathr ${b + 1}`}>
          {/* satu taf'ilah satu kelompok: baris hanya patah di antara taf'ilah */}
          {[...new Set(suku.map((s) => s.kaki))].map((kaki) => (
            <span className="irama-kaki" key={kaki}>
              {suku.map((s, i) => (s.kaki !== kaki ? null : (
                <span
                  key={i}
                  className={`suku${s.panjang ? ' panjang' : ''}${aktif?.[0] === b && aktif[1] === i ? ' aktif' : ''}`}
                  title={s.panjang ? 'panjang (10)' : 'pendek (1)'}
                >
                  {s.teks}
                </span>
              )))}
            </span>
          ))}
        </div>
      ))}
      <div className="baris">
        {aktif ? (
          <button type="button" className="tombol irama-tombol" onClick={henti}>Berhenti</button>
        ) : (
          <button type="button" className="tombol utama irama-tombol" onClick={putar}>Putar irama</button>
        )}
        <label className="centang-label">
          <input type="checkbox" checked={pelan} onChange={(e) => setPelan(e.target.checked)} />
          Pelan
        </label>
        <span className="redup kecil irama-kunci">Kotak lebar = suku panjang (10), sempit = pendek (1).</span>
      </div>
    </div>
  )
}
