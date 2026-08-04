import { SALIS_WEIGHTS, clamp } from './config'

export interface SalisParts {
  accuracy: number
  pause: number
  fluency: number
}
export interface SalisResult {
  score: number
  verdict: string
}

/** Weighted blend of the three dimensions → a single Salis score + verdict. */
export function salisScore(
  parts: SalisParts,
  weights = SALIS_WEIGHTS,
): SalisResult {
  const raw =
    parts.accuracy * weights.accuracy +
    parts.pause * weights.pause +
    parts.fluency * weights.fluency
  const score = clamp(Math.round(raw), 0, 100)
  const verdict =
    score >= 85
      ? 'Sudah salis 👍'
      : score >= 65
        ? 'Hampir — rapikan jeda & ritme'
        : 'Latih lagi pelan-pelan'
  return { score, verdict }
}
