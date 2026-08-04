import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "../../src/theme";
import { getTtsAdapter } from "../../src/lib/tts";
import { useEnglishSpeech } from "../../src/hooks/useEnglishSpeech";
import { AttemptScore, scoreAttempt } from "../../src/lib/english";
import { ScoreMarks } from "../../src/components/english/ScoreMarks";

const DEFAULT_TEXT =
  "G'day! I reckon we should head to the beach this arvo.";

export default function CustomPractice() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [rate, setRate] = useState<"0.7" | "0.85" | "1.0">("0.85");
  const [result, setResult] = useState<AttemptScore | null>(null);
  const speech = useEnglishSpeech();

  // stop any TTS when leaving screen
  useEffect(() => () => getTtsAdapter().stop(), []);

  const listen = () => {
    getTtsAdapter().speakPage({
      text,
      language: "en-AU", // system Australian voice, offline
      rate,
    });
  };

  const startSpeaking = () => {
    getTtsAdapter().stop();
    setResult(null);
    speech.start();
  };

  const stopAndScore = () => {
    speech.stop();
  };

  useEffect(() => {
    // score when listening has ended and we have a transcript
    if (!speech.isListening && speech.transcript) {
      setResult(scoreAttempt(text, speech.transcript));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.isListening]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>✍️ Latihan Teks Sendiri</Text>
      <Text style={styles.label}>Teks (English)</Text>
      <TextInput
        style={styles.input}
        multiline
        value={text}
        onChangeText={(t) => {
          setText(t);
          setResult(null);
          speech.reset();
        }}
        placeholder="Tulis teks bahasa Inggris di sini…"
      />

      <Text style={styles.label}>Kecepatan</Text>
      <View style={styles.rateRow}>
        {(["0.7", "0.85", "1.0"] as const).map((r) => (
          <Pressable
            key={r}
            style={[styles.rateBtn, rate === r && styles.rateBtnActive]}
            onPress={() => setRate(r)}
          >
            <Text style={rate === r ? styles.rateTextActive : styles.rateText}>
              {r === "0.7" ? "Lambat" : r === "0.85" ? "Normal" : "Cepat"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryBtn} onPress={listen}>
        <Text style={styles.primaryBtnText}>🔊 Dengarkan (aksen AU)</Text>
      </Pressable>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>🎤 Sekarang tirukan</Text>

      {!speech.isListening ? (
        <Pressable style={styles.recordBtn} onPress={startSpeaking}>
          <Text style={styles.primaryBtnText}>● Mulai Rekam</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.stopBtn} onPress={stopAndScore}>
          <Text style={styles.primaryBtnText}>■ Selesai & Nilai</Text>
        </Pressable>
      )}

      {speech.transcript ? (
        <Text style={styles.transcript}>
          Terdengar: “{speech.transcript}”
        </Text>
      ) : null}
      {speech.error ? <Text style={styles.error}>{speech.error}</Text> : null}
      {result ? <ScoreMarks result={result} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  label: { color: colors.textSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    fontSize: 16,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
  rateRow: { flexDirection: "row", gap: 8 },
  rateBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
  },
  rateBtnActive: { backgroundColor: colors.primary },
  rateText: { color: colors.textSecondary },
  rateTextActive: { color: "#fff", fontWeight: "700" },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  recordBtn: {
    backgroundColor: colors.accentRed,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  stopBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  divider: {
    height: 1,
    backgroundColor: "#E5E1FF",
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  transcript: {
    marginTop: 12,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  error: { color: colors.accentRed, marginTop: 8 },
});
