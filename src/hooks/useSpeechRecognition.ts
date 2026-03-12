import { useState, useCallback, useRef, useEffect } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { isWordMatch, isNonIndonesian } from "../lib/speech";

const MAX_ATTEMPTS = 4;

interface UseGuidedReadingOptions {
  words: string[];
  onWordRead?: (index: number, success: boolean) => void;
  onAllDone?: () => void;
}

export function useSpeechRecognition({
  words,
  onWordRead,
  onAllDone,
}: UseGuidedReadingOptions) {
  const [isListening, setIsListening] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [readWords, setReadWords] = useState<Map<number, boolean>>(new Map()); // index → success

  const wordsRef = useRef(words);
  const currentIndexRef = useRef(currentWordIndex);
  const attemptsRef = useRef(attempts);
  const readWordsRef = useRef(readWords);

  wordsRef.current = words;
  currentIndexRef.current = currentWordIndex;
  attemptsRef.current = attempts;
  readWordsRef.current = readWords;

  const advanceWord = useCallback((success: boolean) => {
    const idx = currentIndexRef.current;
    onWordRead?.(idx, success);

    setReadWords((prev) => {
      const next = new Map(prev);
      next.set(idx, success);
      return next;
    });

    const nextIdx = idx + 1;
    if (nextIdx >= wordsRef.current.length) {
      // All words done
      setCurrentWordIndex(nextIdx);
      setAttempts(0);
      ExpoSpeechRecognitionModule.stop();
      onAllDone?.();
    } else {
      setCurrentWordIndex(nextIdx);
      setAttempts(0);
    }
  }, [onWordRead, onAllDone]);

  // Auto-skip non-Indonesian words (Arabic script, punctuation-only)
  useEffect(() => {
    if (!isListening) return;
    if (currentWordIndex >= words.length) return;
    const word = words[currentWordIndex];
    if (isNonIndonesian(word)) {
      // Small delay so the highlight is visible briefly
      const timer = setTimeout(() => {
        advanceWord(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentWordIndex, isListening, words, advanceWord]);

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    if (!text.trim()) return;

    const idx = currentIndexRef.current;
    if (idx >= wordsRef.current.length) return;

    const expectedWord = wordsRef.current[idx];
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);

    // Check if any recognized token matches the expected word
    const matched = tokens.some((token) => isWordMatch(token, expectedWord));

    if (matched) {
      advanceWord(true);
    } else {
      const newAttempts = attemptsRef.current + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        // Too many attempts, skip this word
        advanceWord(false);
      }
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.warn("Speech recognition error:", event.error);
    setIsListening(false);
  });

  const start = useCallback(async () => {
    const { granted } =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      console.warn("Microphone permission not granted");
      return;
    }

    ExpoSpeechRecognitionModule.start({
      lang: "id-ID",
      interimResults: true,
      continuous: true,
    });
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const reset = useCallback(() => {
    setCurrentWordIndex(0);
    setAttempts(0);
    setReadWords(new Map());
  }, []);

  return {
    isListening,
    currentWordIndex,
    attempts,
    readWords,
    start,
    stop,
    reset,
  };
}
