import { useState } from 'react'

/** Salin ke clipboard, cadangan execCommand untuk browser lama. "Tersalin ✓" 1,5 detik. */
export async function salinTeks(teks: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(teks)
      return true
    }
  } catch {
    /* cadangan di bawah */
  }
  const ta = document.createElement('textarea')
  ta.value = teks
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(ta)
  return ok
}

export default function TombolSalin({ ambilTeks, disabled, label = 'Salin prompt' }: {
  ambilTeks: () => string | Promise<string>
  disabled?: boolean
  label?: string
}) {
  const [keadaan, setKeadaan] = useState<'diam' | 'tersalin' | 'gagal'>('diam')
  async function klik() {
    const ok = await salinTeks(await ambilTeks())
    // Gagal menyalin (izin clipboard ditolak): beri tahu, jangan diam saja.
    setKeadaan(ok ? 'tersalin' : 'gagal')
    setTimeout(() => setKeadaan('diam'), ok ? 1500 : 3000)
  }
  return (
    <button type="button" className="salin-prompt" onClick={klik} disabled={disabled}>
      {keadaan === 'tersalin' ? 'Tersalin ✓' : keadaan === 'gagal' ? 'Belum tersalin, coba lagi' : label}
    </button>
  )
}
