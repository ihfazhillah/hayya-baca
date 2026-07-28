import { useEffect, useRef, useState } from 'react'

// Minimal typing for the native BarcodeDetector (not in the default TS lib).
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (opts?: {
  formats?: string[]
}) => BarcodeDetectorLike

function getDetectorCtor(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  return w.BarcodeDetector ?? null
}

export function isQrScanSupported(): boolean {
  return (
    getDetectorCtor() !== null &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

/**
 * Live camera QR scanner. Calls `onDetect(rawValue)` once a code is read, then
 * stops the camera. Renders a fallback message when the device can't scan.
 */
export function QrScanner({
  onDetect,
  onCancel,
}: {
  onDetect: (value: string) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const supported = isQrScanSupported()

  useEffect(() => {
    if (!supported) return
    const Ctor = getDetectorCtor()!
    const detector = new Ctor({ formats: ['qr_code'] })
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false

    const stop = () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }

    const scan = async () => {
      const video = videoRef.current
      if (stopped || !video || video.readyState < 2) {
        if (!stopped) raf = requestAnimationFrame(scan)
        return
      }
      try {
        const codes = await detector.detect(video)
        if (codes.length > 0 && codes[0].rawValue) {
          stop()
          onDetect(codes[0].rawValue)
          return
        }
      } catch {
        /* transient decode error — keep trying */
      }
      if (!stopped) raf = requestAnimationFrame(scan)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current
        if (video) {
          video.srcObject = s
          void video.play()
          raf = requestAnimationFrame(scan)
        }
      })
      .catch(() => setError('Tidak bisa membuka kamera. Izinkan akses kamera.'))

    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported])

  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-purple-50 p-4 text-center">
        <p className="text-sm text-purple-600">
          Perangkat ini tidak bisa memindai QR. Ketik kode dari orang tua saja.
        </p>
        <button onClick={onCancel} className="text-sm text-purple-400 underline">
          Kembali
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          className="h-64 w-64 object-cover"
          muted
          playsInline
        />
      </div>
      {error ? (
        <p className="text-center text-sm text-red-600">{error}</p>
      ) : (
        <p className="text-sm text-purple-500">
          Arahkan kamera ke QR dari orang tua
        </p>
      )}
      <button onClick={onCancel} className="text-sm text-purple-400 underline">
        Batal
      </button>
    </div>
  )
}
