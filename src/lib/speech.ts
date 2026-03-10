import * as Speech from "expo-speech";
import * as fuzzball from "fuzzball";

/**
 * Speak a single word using TTS
 */
export function speakWord(word: string) {
  Speech.stop();
  Speech.speak(word, {
    language: "id-ID",
    rate: 0.8,
  });
}

/**
 * Speak a full page/paragraph text using TTS (read-to-me mode)
 */
export function speakPage(
  text: string,
  onWord?: (wordIndex: number) => void,
  onDone?: () => void
) {
  Speech.stop();

  const words = text.split(/\s+/).filter(Boolean);
  let wordIdx = 0;

  // expo-speech doesn't have per-word callback,
  // so we speak word by word with small delays for highlighting
  function speakNext() {
    if (wordIdx >= words.length) {
      onDone?.();
      return;
    }

    const idx = wordIdx;
    onWord?.(idx);

    Speech.speak(words[idx], {
      language: "id-ID",
      rate: 0.85,
      onDone: () => {
        wordIdx++;
        speakNext();
      },
    });
  }

  speakNext();
}

export function stopSpeaking() {
  Speech.stop();
}

/**
 * Match recognized speech against expected words.
 * Returns indices of words that were matched.
 */
export function matchWords(
  recognized: string,
  expectedWords: string[]
): Set<number> {
  const matched = new Set<number>();
  const recognizedLower = recognized.toLowerCase();
  const recognizedTokens = recognizedLower.split(/\s+/).filter(Boolean);

  for (let i = 0; i < expectedWords.length; i++) {
    const expected = expectedWords[i].toLowerCase().replace(/[.,!?؟"'()]/g, "");
    if (!expected) continue;

    // Exact match in recognized tokens
    if (recognizedTokens.includes(expected)) {
      matched.add(i);
      continue;
    }

    // Fuzzy match against each recognized token
    for (const token of recognizedTokens) {
      const ratio = fuzzball.ratio(expected, token);
      if (ratio >= 70) {
        matched.add(i);
        break;
      }
    }
  }

  return matched;
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
