import { useState, useCallback, useRef, useEffect } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { matchWords } from "../lib/speech";

interface UseSpeechRecognitionOptions {
  expectedWords: string[];
  onMatch?: (matchedIndices: Set<number>) => void;
}

export function useSpeechRecognition({
  expectedWords,
  onMatch,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const allMatched = useRef<Set<number>>(new Set());
  const wordsRef = useRef(expectedWords);
  wordsRef.current = expectedWords;

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    setTranscript(text);

    const matched = matchWords(text, wordsRef.current);
    matched.forEach((i) => allMatched.current.add(i));
    onMatch?.(new Set(allMatched.current));
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

    allMatched.current = new Set();
    setTranscript("");

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
    allMatched.current = new Set();
    setTranscript("");
  }, []);

  return {
    isListening,
    transcript,
    start,
    stop,
    reset,
  };
}
