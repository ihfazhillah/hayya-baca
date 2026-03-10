import Speech from "@mhpdev/react-native-speech";
import type { TtsAdapter, TtsSpeakOptions } from "./types";

/**
 * TTS adapter using @mhpdev/react-native-speech.
 * Provides native word-boundary events via onProgress for accurate highlighting.
 */
export class MhpdevAdapter implements TtsAdapter {
  private subs: Array<{ remove(): void }> = [];
  private currentId: string | null = null;

  speakWord(word: string, language = "id-ID"): void {
    this.stop();
    Speech.speak(word, { language, rate: 0.8 });
  }

  speakPage(options: TtsSpeakOptions): void {
    this.stop();

    const { text, language = "id-ID", rate = "0.85", onWord, onDone, onStopped } = options;
    const words = text.split(/\s+/).filter(Boolean);

    // Build char-offset → word-index map for onProgress translation
    if (onWord) {
      const charToWord = new Map<number, number>();
      let offset = 0;
      for (let i = 0; i < words.length; i++) {
        charToWord.set(offset, i);
        offset += words[i].length + 1;
      }

      this.subs.push(
        Speech.onProgress(({ id, location }) => {
          if (id !== this.currentId) return;
          // Find closest word for this character position
          let bestIdx = 0;
          let bestDist = Infinity;
          for (const [charOffset, wordIdx] of charToWord) {
            const dist = Math.abs(location - charOffset);
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = wordIdx;
            }
          }
          onWord({ wordIndex: bestIdx });
        })
      );
    }

    if (onDone) {
      this.subs.push(
        Speech.onFinish(({ id }) => {
          if (id !== this.currentId) return;
          this.cleanup();
          onDone();
        })
      );
    }

    if (onStopped) {
      this.subs.push(
        Speech.onStopped(({ id }) => {
          if (id !== this.currentId) return;
          this.cleanup();
          onStopped();
        })
      );
    }

    Speech.speak(text, { language, rate: parseFloat(rate) }).then((id) => {
      this.currentId = id;
    });
  }

  stop(): void {
    this.cleanup();
    Speech.stop();
  }

  private cleanup(): void {
    for (const sub of this.subs) sub.remove();
    this.subs = [];
    this.currentId = null;
  }
}
