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
  const [tersalin, setTersalin] = useState(false)
  async function klik() {
    const ok = await salinTeks(await ambilTeks())
    if (ok) {
      setTersalin(true)
      setTimeout(() => setTersalin(false), 1500)
    }
  }
  return (
    <button type="button" className="salin-prompt" onClick={klik} disabled={disabled}>
      {tersalin ? 'Tersalin ✓' : label}
    </button>
  )
}
