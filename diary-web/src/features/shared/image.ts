// Client-side image compression before upload (Spec 060 §4.3): resize + re-encode
// to WebP in the browser so the full-resolution original never leaves the device.
// Mirrors the server's re-encode (MAX_SIDE 1600, quality 0.8) but happens up front
// to cut upload size/bandwidth. Falls back to the original file if anything is
// unsupported (e.g. HEIC on some browsers) — the server still validates + re-encodes.

const MAX_SIDE = 1600
const QUALITY = 0.8

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', QUALITY),
    )
    // If the browser can't encode WebP, or the result somehow got bigger, keep
    // the original and let the server handle it.
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
    return new File([blob], name, { type: 'image/webp' })
  } catch {
    return file
  }
}
