import { useEffect, useRef, useState } from 'react'

type Status = 'siap' | 'merekam' | 'selesai' | 'ditolak'

/** Perekam suara di halaman. Rekaman hanya ada di memori tablet dan hilang saat halaman ditutup. */
export default function Perekam() {
  const [status, setStatus] = useState<Status>('siap')
  const [url, setUrl] = useState<string | null>(null)
  const perekam = useRef<MediaRecorder | null>(null)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return (
      <p className="callout callout-info">
        Tablet ini belum bisa merekam dari halaman ini. Pakai aplikasi perekam suara di tablet atau HP Ayah,
        lalu kembali ke sini.
      </p>
    )
  }

  async function mulai() {
    let aliran: MediaStream
    try {
      aliran = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setStatus('ditolak')
      return
    }
    const potongan: Blob[] = []
    const r = new MediaRecorder(aliran)
    r.ondataavailable = (e) => { if (e.data.size) potongan.push(e.data) }
    r.onstop = () => {
      aliran.getTracks().forEach((t) => t.stop())
      setUrl(URL.createObjectURL(new Blob(potongan, { type: potongan[0]?.type || 'audio/webm' })))
      setStatus('selesai')
    }
    perekam.current = r
    r.start()
    setStatus('merekam')
  }

  return (
    <div className="ph-perekam">
      {status === 'merekam' ? (
        <button type="button" className="btn-besar" onClick={() => perekam.current?.stop()}>
          <span aria-hidden="true">⏹️</span> Berhenti
        </button>
      ) : (
        <button type="button" className={`btn-besar${status === 'selesai' ? ' sekunder' : ''}`} onClick={mulai}>
          <span aria-hidden="true">🎙️</span> {status === 'selesai' ? 'Rekam lagi' : 'Rekam'}
        </button>
      )}
      {status === 'merekam' && <p className="kecil" role="status">Sedang merekam… baca keras-keras.</p>}
      {status === 'ditolak' && (
        <p className="kecil" role="alert">
          Mikrofon belum diizinkan. Minta Ayah atau Ummah menekan Izinkan, lalu coba lagi.
        </p>
      )}
      {url && status === 'selesai' && (
        <div>
          <p className="kecil" style={{ fontWeight: 600 }}>Dengarkan rekamanmu:</p>
          <audio controls src={url} aria-label="Rekamanmu" />
        </div>
      )}
    </div>
  )
}
