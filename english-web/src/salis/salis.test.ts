import { describe, expect, it } from 'vitest'
import type { Word } from '../stt/backend'
import { chunks, pauseMarkup } from './markup'
import { comparePauses, expectedPauses, measuredPauses } from './pauses'
import { fluencyScore, hesitations, wpm } from './fluency'
import { salisScore } from './score'

const w = (word: string, start: number, end: number): Word => ({ word, start, end })

describe('markup', () => {
  it('emits short/long pause marks from punctuation', () => {
    const t = pauseMarkup('Hello there, how are you?')
    expect(t.filter((x) => x.kind === 'word').map((x) => (x as { text: string }).text)).toEqual([
      'Hello', 'there', 'how', 'are', 'you',
    ])
    expect(t.some((x) => x.kind === 'pause' && x.strength === 'short')).toBe(true)
    expect(t.some((x) => x.kind === 'pause' && x.strength === 'long')).toBe(true)
  })

  it('chunks by punctuation', () => {
    expect(chunks('Hello there, how are you?')).toEqual([
      'Hello there,',
      'how are you?',
    ])
  })
})

describe('pauses', () => {
  it('expectedPauses indexes by preceding word', () => {
    expect(expectedPauses('Hello there, how are you?')).toEqual([
      { afterWordIndex: 1, strength: 'short' },
      { afterWordIndex: 4, strength: 'long' },
    ])
  })

  it('measuredPauses finds gaps ≥ threshold', () => {
    const words = [w('a', 0, 0.5), w('b', 0.9, 1.2), w('c', 1.3, 1.6)]
    expect(measuredPauses(words)).toEqual([{ afterWordIndex: 0, dur: expect.closeTo(0.4, 5) }])
  })

  it('scores missed pauses and tolerates ±1 index', () => {
    const exp = expectedPauses('Hello there, how are you?') // after 1 and 4
    const c1 = comparePauses(exp, [{ afterWordIndex: 2, dur: 0.5 }]) // ~1 (tol) matched, 4 missed
    expect(c1.missed).toEqual([4])
    expect(c1.score).toBe(50)
  })

  it('penalizes an extra mid-phrase pause', () => {
    const c = comparePauses([], [{ afterWordIndex: 2, dur: 0.5 }])
    expect(c.extra).toEqual([2])
    expect(c.score).toBe(80)
  })
})

describe('fluency', () => {
  it('wpm guards empty/degenerate', () => {
    expect(wpm([])).toBe(0)
    expect(wpm([w('a', 0, 1)])).toBe(0)
  })
  it('computes wpm over the spoken span', () => {
    const words = Array.from({ length: 10 }, (_, i) => w(`x${i}`, i * 0.5, i * 0.5 + 0.4))
    // span = 4.9 - 0 ; ~122 wpm
    expect(Math.round(wpm(words))).toBeGreaterThan(100)
  })
  it('counts hesitations off punctuation', () => {
    const words = [w('a', 0, 0.5), w('b', 1.3, 1.6)] // 0.8s gap, no expected pause
    expect(hesitations(words, [])).toBe(1)
  })
  it('fluencyScore: full in band, falls off below, penalizes hesitation', () => {
    expect(fluencyScore(120, 0)).toBe(100)
    expect(fluencyScore(60, 0)).toBe(55)
    expect(fluencyScore(120, 2)).toBe(76)
    expect(fluencyScore(0, 0)).toBe(0)
  })
})

describe('salisScore', () => {
  it('blends with default weights + verdict', () => {
    expect(salisScore({ accuracy: 100, pause: 100, fluency: 100 })).toEqual({
      score: 100,
      verdict: 'Sudah salis 👍',
    })
    expect(salisScore({ accuracy: 60, pause: 40, fluency: 40 }).score).toBe(50)
  })
})
