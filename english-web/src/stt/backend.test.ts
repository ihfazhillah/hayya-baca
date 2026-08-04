import { describe, expect, it } from 'vitest'
import { normalizeWords, pickBackend, type RawChunk } from './backend'

describe('pickBackend', () => {
  it('prefers wasm (WebGPU whisper is unstable on this stack)', () => {
    expect(pickBackend({ webgpu: true, wasm: true })).toBe('wasm')
    expect(pickBackend({ webgpu: false, wasm: true })).toBe('wasm')
  })
  it('uses webgpu only when wasm is unavailable', () => {
    expect(pickBackend({ webgpu: true, wasm: false })).toBe('webgpu')
  })
  it('falls back to server when neither is available', () => {
    expect(pickBackend({ webgpu: false, wasm: false })).toBe('server')
  })
})

describe('normalizeWords', () => {
  it('returns [] for undefined/empty', () => {
    expect(normalizeWords(undefined)).toEqual([])
    expect(normalizeWords([])).toEqual([])
  })

  it('maps chunks to trimmed words with timestamps', () => {
    const chunks: RawChunk[] = [
      { text: ' Hello', timestamp: [0, 0.5] },
      { text: 'there ', timestamp: [0.5, 1.0] },
    ]
    expect(normalizeWords(chunks)).toEqual([
      { word: 'Hello', start: 0, end: 0.5 },
      { word: 'there', start: 0.5, end: 1.0 },
    ])
  })

  it('defaults a null end to the start, and a null start to 0', () => {
    const chunks: RawChunk[] = [
      { text: 'end-null', timestamp: [1.2, null] },
      { text: 'start-null', timestamp: [null, 2.0] },
    ]
    expect(normalizeWords(chunks)).toEqual([
      { word: 'end-null', start: 1.2, end: 1.2 },
      { word: 'start-null', start: 0, end: 2.0 },
    ])
  })

  it('drops empty/whitespace words', () => {
    const chunks: RawChunk[] = [
      { text: '   ', timestamp: [0, 0.1] },
      { text: 'ok', timestamp: [0.1, 0.2] },
    ]
    expect(normalizeWords(chunks)).toEqual([{ word: 'ok', start: 0.1, end: 0.2 }])
  })
})
