import { describe, expect, it } from 'vitest'
import { compressImage } from './image'

describe('compressImage', () => {
  it('returns non-image files unchanged', async () => {
    const f = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    expect(await compressImage(f)).toBe(f)
  })

  it('falls back to the original image when encoding is unavailable', async () => {
    // jsdom has no real canvas/createImageBitmap → must return the original file
    // so the server can still validate + re-encode it.
    const f = new File([new Uint8Array([1, 2, 3])], 'photo.png', {
      type: 'image/png',
    })
    expect(await compressImage(f)).toBe(f)
  })
})
