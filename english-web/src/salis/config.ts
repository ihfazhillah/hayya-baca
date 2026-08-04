/** Salis (fluency) thresholds & weights — one place to tune (Spec 067). */
export const PAUSE_GAP_S = 0.3 // gap ≥ this between words = a pause
export const HESITATION_S = 0.6 // long gap NOT at a punctuation point = hesitation
export const WPM_MIN = 90 // comfortable learner speaking band…
export const WPM_MAX = 150 // …full fluency marks inside [MIN, MAX]

export const SALIS_WEIGHTS = { accuracy: 0.5, pause: 0.25, fluency: 0.25 }

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, x))

/** True if some index in `set` is within `tol` of `i` (timestamps can attach a
 *  pause to an adjacent word). */
export function nearIndex(i: number, set: Set<number>, tol = 1): boolean {
  for (let d = -tol; d <= tol; d++) if (set.has(i + d)) return true
  return false
}
