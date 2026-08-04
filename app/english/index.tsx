import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { colors } from "../../src/theme";
import {
  EnglishLessonListItem,
  fetchEnglishLessons,
} from "../../src/lib/english";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Pemula",
  intermediate: "Menengah",
  advanced: "Lanjutan",
};

export default function EnglishHome() {
  const [lessons, setLessons] = useState<EnglishLessonListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLessons(await fetchEnglishLessons());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>🇦🇺 English Practice</Text>
      <Text style={styles.subtitle}>
        Listening & speaking bahasa Inggris aksen Australia
      </Text>

      <Pressable
        style={styles.customCard}
        onPress={() => router.push("/english/custom")}
      >
        <Text style={styles.customTitle}>✍️ Latihan Teks Sendiri</Text>
        <Text style={styles.customDesc}>
          Ketik teks apa pun, dengarkan dengan aksen Australia, lalu tirukan.
        </Text>
      </Pressable>

      <Text style={styles.sectionTitle}>📚 Lessons</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={lessons}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={load} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              Belum ada lesson yang dipublish. Buat lewat
              tools/english-pipeline lalu import di backend.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.lessonCard}
              onPress={() => router.push(`/english/${item.id}`)}
            >
              <Text style={styles.lessonTitle}>
                {item.source === "youtube" ? "▶️ " : "🎧 "}
                {item.title}
              </Text>
              <Text style={styles.lessonMeta}>
                {LEVEL_LABEL[item.level] ?? item.level} ·{" "}
                {item.segment_count} segmen
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginBottom: 16 },
  customCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  customTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  customDesc: { color: "#EDEBFF", marginTop: 4 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  lessonCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  lessonTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  lessonMeta: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
  empty: { color: colors.textSecondary, marginTop: 16 },
  error: { color: colors.accentRed, marginTop: 16 },
});
