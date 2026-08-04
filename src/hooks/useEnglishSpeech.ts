/**
 * Free-form English (en-AU) speech recognition for shadowing/speaking practice.
 *
 * Unlike useSpeechRecognition (word-by-word guided reading in Indonesian),
 * this captures a full utterance transcript, which is then compared against
 * the target text with scoreAttempt() from src/lib/english.
 */

import { useCallback, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export function useEnglishSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const finalRef = useRef("");

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    setError(null);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results?.[0]?.transcript ?? "";
    if (event.isFinal) {
      finalRef.current = (finalRef.current + " " + text).trim();
      setTranscript(finalRef.current);
    } else {
      setTranscript((finalRef.current + " " + text).trim());
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    if (event.error !== "no-speech") {
      setError(event.message ?? event.error ?? "Speech error");
    }
  });

  const start = useCallback(async () => {
    finalRef.current = "";
    setTranscript("");
    setError(null);
    const perms =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) {
      setError("Izin mikrofon ditolak");
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: "en-AU",
      interimResults: true,
      continuous: false,
      // prefer on-device where available (offline-first)
      requiresOnDeviceRecognition: false,
    });
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setError(null);
  }, []);

  return { isListening, transcript, error, start, stop, reset };
}
