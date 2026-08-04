import type { Word } from '../stt/backend'
import { HESITATION_S, WPM_MAX, WPM_MIN, clamp, nearIndex } from './config'
import type { ExpectedPause } from './pauses'

/** Words per minute over the spoken span (0 if too short/degenerate). */
export function wpm(words: Word[]): number {
  if (words.length < 2) return 0
  const dur = words[words.length - 1].end - words[0].start
  if (dur <= 0) return 0
  return (words.length / dur) * 60
}

/** Long gaps that are NOT at an expected pause = hesitations/stalls. */
export function hesitations(
  words: Word[],
  expected: ExpectedPause[],
  gap = HESITATION_S,
): number {
  const expSet = new Set(expected.map((e) => e.afterWordIndex))
  let count = 0
  for (let i = 0; i < words.length - 1; i++) {
    const d = words[i + 1].start - words[i].end
    if (d >= gap && !nearIndex(i, expSet)) count++
  }
  return count
}

/** Full marks inside the WPM band; linear falloff outside; minus hesitations. */
export function fluencyScore(w: number, hes: number): number {
  if (w <= 0) return 0
  let base: number
  if (w >= WPM_MIN && w <= WPM_MAX) base = 100
  else if (w < WPM_MIN) base = 100 - (WPM_MIN - w) * 1.5
  else base = 100 - (w - WPM_MAX) * 1.5
  return clamp(Math.round(base - hes * 12), 0, 100)
}
