import type { Word } from '../stt/backend'
import { PAUSE_GAP_S, clamp, nearIndex } from './config'

export interface ExpectedPause {
  afterWordIndex: number
  strength: 'short' | 'long'
}
export interface MeasuredPause {
  afterWordIndex: number
  dur: number
}
export interface PauseComparison {
  missed: number[] // expected pause the learner didn't make
  extra: number[] // pause where none was expected (mid-phrase break)
  score: number
}

const clean = (raw: string) => raw.replace(/[^A-Za-z0-9']/g, '')

/** Expected pauses from punctuation, indexed by the word they follow. */
export function expectedPauses(target: string): ExpectedPause[] {
  const out: ExpectedPause[] = []
  let wi = -1
  for (const raw of target.trim().split(/\s+/)) {
    if (!raw) continue
    if (clean(raw)) wi++
    if (wi < 0) continue
    if (/[.?!]+$/.test(raw)) out.push({ afterWordIndex: wi, strength: 'long' })
    else if (/[,;:]+$/.test(raw))
      out.push({ afterWordIndex: wi, strength: 'short' })
  }
  return out
}

/** Pauses the learner actually made, from Whisper word timestamps. */
export function measuredPauses(words: Word[], gap = PAUSE_GAP_S): MeasuredPause[] {
  const out: MeasuredPause[] = []
  for (let i = 0; i < words.length - 1; i++) {
    const dur = words[i + 1].start - words[i].end
    if (dur >= gap) out.push({ afterWordIndex: i, dur })
  }
  return out
}

/** Compare expected vs measured (±1 word tolerance) → missed/extra + a score. */
export function comparePauses(
  expected: ExpectedPause[],
  measured: MeasuredPause[],
): PauseComparison {
  const expSet = new Set(expected.map((e) => e.afterWordIndex))
  const measSet = new Set(measured.map((m) => m.afterWordIndex))
  const missed = [...expSet].filter((i) => !nearIndex(i, measSet))
  const extra = [...measSet].filter((i) => !nearIndex(i, expSet))
  const matched = expected.length - missed.length

  let score: number
  if (expected.length === 0) {
    score = extra.length === 0 ? 100 : clamp(100 - 20 * extra.length, 0, 100)
  } else {
    const base = (100 * matched) / expected.length
    score = clamp(Math.round(base - 15 * extra.length), 0, 100)
  }
  return { missed, extra, score }
}
