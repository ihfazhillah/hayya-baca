import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Audio } from "expo-av";

import { colors } from "../../src/theme";
import {
  AttemptScore,
  EnglishLessonDetail,
  fetchEnglishLesson,
  scoreAttempt,
} from "../../src/lib/english";
import { useEnglishSpeech } from "../../src/hooks/useEnglishSpeech";
import { ScoreMarks } from "../../src/components/english/ScoreMarks";

type Mode = "listen" | "dictation" | "shadowing";

export default function LessonPlayer() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [lesson, setLesson] = useState<EnglishLessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("listen");
  const [showText, setShowText] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<AttemptScore | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const speech = useEnglishSpeech();

  useEffect(() => {
    fetchEnglishLesson(lessonId)
      .then(setLesson)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"));
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, [lessonId]);

  const segment = lesson?.segments[index];

  const play = useCallback(async () => {
    if (!segment) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: segment.audio_url },
        { shouldPlay: true }
      );
      soundRef.current = sound;
    } catch {
      setError("Gagal memutar audio segmen");
    }
  }, [segment]);

  const goto = (next: number) => {
    if (!lesson) return;
    const clamped = Math.max(0, Math.min(lesson.segments.length - 1, next));
    setIndex(clamped);
    setShowText(false);
    setTyped("");
    setResult(null);
    speech.reset();
  };

  const checkDictation = () => {
    if (!segment) return;
    setResult(scoreAttempt(segment.text, typed));
    setShowText(true);
  };

  useEffect(() => {
    if (mode === "shadowing" && !speech.isListening && speech.transcript && segment) {
      setResult(scoreAttempt(segment.text, speech.transcript));
      setShowText(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.isListening]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!lesson || !segment) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.meta}>
        Segmen {index + 1} / {lesson.segments.length}
      </Text>

      <Pressable style={styles.playBtn} onPress={play}>
        <Text style={styles.btnText}>🔊 Putar Segmen</Text>
      </Pressable>

      <View style={styles.navRow}>
        <Pressable style={styles.navBtn} onPress={() => goto(index - 1)}>
          <Text style={styles.navText}>← Sebelumnya</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => goto(index + 1)}>
          <Text style={styles.navText}>Berikutnya →</Text>
        </Pressable>
      </View>

      <View style={styles.modeRow}>
        {(
          [
            ["listen", "🎧 Dengar"],
            ["dictation", "✍️ Dikte"],
            ["shadowing", "🎤 Shadowing"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <Pressable
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => {
              setMode(m);
              setResult(null);
              speech.reset();
            }}
          >
            <Text style={mode === m ? styles.modeTextActive : styles.modeText}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === "listen" && (
        <Pressable onPress={() => setShowText((s) => !s)}>
          <Text style={styles.toggleText}>
            {showText ? "Sembunyikan teks" : "Tampilkan teks"}
          </Text>
        </Pressable>
      )}

      {mode === "dictation" && (
        <View>
          <TextInput
            style={styles.input}
            multiline
            value={typed}
            onChangeText={setTyped}
            placeholder="Ketik yang kamu dengar…"
          />
          <Pressable style={styles.checkBtn} onPress={checkDictation}>
            <Text style={styles.btnText}>✅ Periksa</Text>
          </Pressable>
        </View>
      )}

      {mode === "shadowing" && (
        <View>
          {!speech.isListening ? (
            <Pressable style={styles.recordBtn} onPress={speech.start}>
              <Text style={styles.btnText}>● Rekam Tiruanmu</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.checkBtn} onPress={speech.stop}>
              <Text style={styles.btnText}>■ Selesai & Nilai</Text>
            </Pressable>
          )}
          {speech.transcript ? (
            <Text style={styles.transcript}>
              Terdengar: “{speech.transcript}”
            </Text>
          ) : null}
          {speech.error ? (
            <Text style={styles.error}>{speech.error}</Text>
          ) : null}
        </View>
      )}

      {result ? <ScoreMarks result={result} /> : null}

      {showText ? (
        <View style={styles.textCard}>
          <Text style={styles.metaSmall}>Teks asli:</Text>
          <Text style={styles.segmentText}>{segment.text}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
  meta: { color: colors.textSecondary, marginBottom: 12 },
  metaSmall: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  playBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  navRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  navBtn: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  navText: { color: colors.textPrimary, fontWeight: "600" },
  modeRow: { flexDirection: "row", gap: 8, marginVertical: 16 },
  modeBtn: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: "center",
  },
  modeBtnActive: { backgroundColor: colors.secondary },
  modeText: { color: colors.textSecondary, fontSize: 13 },
  modeTextActive: { color: "#fff", fontWeight: "700", fontSize: 13 },
  toggleText: {
    color: colors.primary,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 16,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
  checkBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 10,
  },
  recordBtn: {
    backgroundColor: colors.accentRed,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  textCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  segmentText: { fontSize: 17, lineHeight: 26, color: colors.textPrimary },
  transcript: {
    marginTop: 10,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  error: { color: colors.accentRed, marginTop: 8 },
});
