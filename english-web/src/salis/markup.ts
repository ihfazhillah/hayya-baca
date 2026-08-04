/** Reference-text markup for rhythm training (Spec 067) — pure, no timestamps. */

export type MarkupToken =
  | { kind: 'word'; text: string; index: number }
  | { kind: 'pause'; strength: 'short' | 'long' }

const clean = (raw: string) => raw.replace(/[^A-Za-z0-9']/g, '')

/** Words interleaved with pause marks from punctuation: comma/;/: → short `/`,
 *  sentence end → long `//`. `index` counts words (aligns with normalizeWords). */
export function pauseMarkup(target: string): MarkupToken[] {
  const tokens: MarkupToken[] = []
  let wi = 0
  for (const raw of target.trim().split(/\s+/)) {
    if (!raw) continue
    const word = clean(raw)
    if (word) {
      tokens.push({ kind: 'word', text: word, index: wi })
      wi++
    }
    if (/[.?!]+$/.test(raw)) tokens.push({ kind: 'pause', strength: 'long' })
    else if (/[,;:]+$/.test(raw)) tokens.push({ kind: 'pause', strength: 'short' })
  }
  return tokens
}

/** Breath-groups: split at punctuation so each chunk is one phrase. */
export function chunks(target: string): string[] {
  return target
    .split(/(?<=[,;:.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
