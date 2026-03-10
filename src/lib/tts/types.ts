/**
 * TTS Adapter interface — swap implementations without touching consumers.
 *
 * Implementations:
 * - MhpdevAdapter: @mhpdev/react-native-speech (current)
 * - Future: expo-speech, react-native-tts, audio file playback, etc.
 */

export interface TtsWordEvent {
  /** Index of the word currently being spoken */
  wordIndex: number;
}

export interface TtsSpeakOptions {
  /** Full text to speak */
  text: string;
  /** Language code, e.g. "id-ID" */
  language?: string;
  /** Speech rate (0.0–2.0, default 1.0) */
  rate?: string;
  /** Called when each word starts being spoken */
  onWord?: (event: TtsWordEvent) => void;
  /** Called when speech finishes naturally */
  onDone?: () => void;
  /** Called if speech is stopped/cancelled */
  onStopped?: () => void;
}

export interface TtsAdapter {
  /** Speak a single word (e.g. when user taps a word) */
  speakWord(word: string, language?: string): void;
  /** Speak full text with word-level progress callbacks */
  speakPage(options: TtsSpeakOptions): void;
  /** Stop any ongoing speech */
  stop(): void;
}
