import * as fuzzball from "fuzzball";

// TTS functions — delegated to tts/ adapter
export { speakWord, speakPage, stopSpeaking } from "./tts";

/**
 * Check if a single recognized token matches an expected word (fuzzy, 70% threshold)
 */
export function isWordMatch(token: string, expected: string): boolean {
  const clean = expected.toLowerCase().replace(/[.,!?؟"'()]/g, "");
  if (!clean) return false;
  if (token === clean) return true;
  return fuzzball.ratio(token, clean) >= 70;
}

/**
 * Calculate reading score based on matched words percentage
 */
export function calculateStars(
  matchedCount: number,
  totalWords: number
): number {
  if (totalWords === 0) return 0;
  const pct = matchedCount / totalWords;
  if (pct >= 0.75) return 4;
  if (pct >= 0.5) return 3;
  if (pct >= 0.25) return 2;
  if (pct > 0) return 1;
  return 0;
}

/**
 * Calculate coins earned for completing a book
 */
export function calculateCoins(totalPages: number): number {
  return Math.ceil(totalPages / 5);
}
