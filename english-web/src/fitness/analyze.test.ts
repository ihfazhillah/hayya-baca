import { describe, expect, it } from 'vitest'
import { analyzeAttempt, targetPhonemesForWord } from './analyze'

const fake = (w: string): string[] =>
  (({ think: ['TH'], right: ['R'], light: ['R', 'L'], sink: [] }) as Record<
    string,
    string[]
  >)[w] ?? []

describe('targetPhonemesForWord', () => {
  it('detects TH in "think"', () => {
    expect(targetPhonemesForWord('think')).toContain('TH')
  })
  it('detects V and R in "very"', () => {
    const t = targetPhonemesForWord('very')
    expect(t).toEqual(expect.arrayContaining(['V', 'R']))
  })
  it('ignores punctuation/case and returns [] for empties', () => {
    expect(targetPhonemesForWord('  ,. ')).toEqual([])
    expect(targetPhonemesForWord('THINK!')).toContain('TH')
  })
})

describe('analyzeAttempt', () => {
  it('marks a wrong word’s phonemes as fail, correct as pass', () => {
    const d = analyzeAttempt(['think', 'right'], [false, true], fake)
    expect(d).toContainEqual({ phoneme: 'TH', pass: 0, fail: 1 })
    expect(d).toContainEqual({ phoneme: 'R', pass: 1, fail: 0 })
  })

  it('fail wins when a phoneme appears in both a wrong and a right word', () => {
    // light(wrong)→R,L ; right(ok)→R  → R must be a single fail delta
    const d = analyzeAttempt(['light', 'right'], [false, true], fake)
    const r = d.filter((x) => x.phoneme === 'R')
    expect(r).toEqual([{ phoneme: 'R', pass: 0, fail: 1 }])
    expect(d).toContainEqual({ phoneme: 'L', pass: 0, fail: 1 })
  })

  it('skips OOV / no-target words', () => {
    expect(analyzeAttempt(['sink'], [false], fake)).toEqual([])
  })

  it('all-correct → only pass deltas', () => {
    const d = analyzeAttempt(['think', 'right'], [true, true], fake)
    expect(d).toContainEqual({ phoneme: 'TH', pass: 1, fail: 0 })
    expect(d).toContainEqual({ phoneme: 'R', pass: 1, fail: 0 })
    expect(d.every((x) => x.fail === 0)).toBe(true)
  })
})
