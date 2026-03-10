import type { TtsAdapter } from "./types";
import { MhpdevAdapter } from "./mhpdev-adapter";

export type { TtsAdapter, TtsSpeakOptions, TtsWordEvent } from "./types";

// Singleton — swap adapter here to change TTS engine globally
let adapter: TtsAdapter = new MhpdevAdapter();

export function setTtsAdapter(a: TtsAdapter): void {
  adapter = a;
}

export function getTtsAdapter(): TtsAdapter {
  return adapter;
}

// Convenience re-exports matching old speech.ts API
export function speakWord(word: string): void {
  adapter.speakWord(word, "id-ID");
}

export function speakPage(
  text: string,
  onWord?: (wordIndex: number) => void,
  onDone?: () => void
): void {
  adapter.speakPage({
    text,
    language: "id-ID",
    rate: "0.85",
    onWord: onWord ? (e) => onWord(e.wordIndex) : undefined,
    onDone,
  });
}

export function stopSpeaking(): void {
  adapter.stop();
}
