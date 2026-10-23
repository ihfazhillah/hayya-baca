import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

const KUNCI_DENGAR_DULU = 'penerbit-dengar-dulu'

function suaraIndonesia(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    return null
  }
  const daftar = window.speechSynthesis.getVoices?.() ?? []
  return daftar.find((v) => v.lang?.replace('_', '-').toLowerCase().startsWith('id')) ?? null
}

/** Suara bahasa Indonesia di perangkat ini; daftar suara di Chrome baru terisi setelah `voiceschanged`. */
function useSuaraIndonesia() {
  const [suara, setSuara] = useState<SpeechSynthesisVoice | null>(suaraIndonesia)
  useEffect(() => {
    const ss = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!ss?.addEventListener) return
    const segarkan = () => setSuara(suaraIndonesia())
    ss.addEventListener('voiceschanged', segarkan)
    return () => ss.removeEventListener('voiceschanged', segarkan)
  }, [])
  return suara
}

function bacaPilihan() {
  try {
    return localStorage.getItem(KUNCI_DENGAR_DULU) === '1'
  } catch {
    return false
  }
}

/** Tombol 🔊 yang membacakan `teks` dengan suara perangkat (spec 075 K1), dan pilihan
 *  "Dengarkan dulu, lalu teksnya muncul". Tanpa suara Indonesia: hanya `children`, teks langsung tampil.
 *  `children` tetap terpasang saat disembunyikan supaya keadaan misi tidak hilang. */
export default function Dengar({ teks, children }: { teks: string; children: ReactNode }) {
  const id = useId()
  const suara = useSuaraIndonesia()
  const [dengarDulu, setDengarDulu] = useState(bacaPilihan)
  const [sudahDengar, setSudahDengar] = useState(false)
  const [membaca, setMembaca] = useState(false)
  const aktif = useRef(true)

  useEffect(() => {
    aktif.current = true
    return () => {
      aktif.current = false
      window.speechSynthesis?.cancel()
    }
  }, [])

  if (!suara) return <>{children}</>

  function dengarkan() {
    const ss = window.speechSynthesis
    ss.cancel()
    const u = new SpeechSynthesisUtterance(teks)
    u.lang = 'id-ID'
    u.voice = suara
    u.rate = 0.9
    // Selesai atau gagal: teks tetap muncul, misi tetap bisa diselesaikan.
    u.onend = u.onerror = () => {
      if (!aktif.current) return
      setMembaca(false)
      setSudahDengar(true)
    }
    setMembaca(true)
    ss.speak(u)
  }

  function ubahPilihan(nilai: boolean) {
    setDengarDulu(nilai)
    if (nilai) setSudahDengar(false)
    try {
      localStorage.setItem(KUNCI_DENGAR_DULU, nilai ? '1' : '0')
    } catch {
      // Penyimpanan tidak tersedia: pilihan hanya berlaku di halaman ini.
    }
  }

  const sembunyi = dengarDulu && !sudahDengar
  return (
    <div className="tumpuk">
      <div className="baris dengar">
        <button type="button" className="btn-besar sekunder" onClick={dengarkan}>
          🔊 Dengarkan{membaca ? ' lagi' : ''}
        </button>
        <label htmlFor={`${id}-dulu`} className="dengar-pilihan">
          <input id={`${id}-dulu`} type="checkbox" checked={dengarDulu} onChange={(e) => ubahPilihan(e.target.checked)} />
          {' '}Dengarkan dulu, lalu teksnya muncul
        </label>
      </div>
      {sembunyi && (
        <p className="callout callout-info" role="status">
          👂 Teksnya muncul setelah kamu mendengarnya. Tekan 🔊 Dengarkan.
        </p>
      )}
      <div hidden={sembunyi}>{children}</div>
    </div>
  )
}
