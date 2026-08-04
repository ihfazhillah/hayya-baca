import { describe, expect, it } from 'vitest'
import { wrongWordDeltas } from './collect'
import type { AttemptScore } from '../scoring'

const score = (marks: AttemptScore['marks']): AttemptScore => ({
  score: 0,
  correct: 0,
  total: 0,
  marks,
})

describe('wrongWordDeltas', () => {
  it('collects wrong words (normalized), skips correct/extra', () => {
    const d = wrongWordDeltas(
      score([
        { kind: 'wrong', word: 'Attribution' },
        { kind: 'correct', word: 'the' },
        { kind: 'extra', word: 'um' },
        { kind: 'wrong', word: 'nuanced.' },
      ]),
    )
    expect(d).toEqual([
      { word: 'attribution', fail: 1 },
      { word: 'nuanced', fail: 1 },
    ])
  })

  it('dedupes repeated wrong words', () => {
    const d = wrongWordDeltas(
      score([
        { kind: 'wrong', word: 'the' },
        { kind: 'wrong', word: 'The' },
      ]),
    )
    expect(d).toEqual([{ word: 'the', fail: 1 }])
  })

  it('returns [] when nothing wrong', () => {
    expect(wrongWordDeltas(score([{ kind: 'correct', word: 'ok' }]))).toEqual([])
  })
})
