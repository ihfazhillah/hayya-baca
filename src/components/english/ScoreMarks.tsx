import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";
import type { AttemptScore } from "../../lib/english";

export function ScoreMarks({ result }: { result: AttemptScore }) {
  return (
    <View style={styles.container}>
      <Text style={styles.score}>
        Skor: {result.score}% — {result.correct}/{result.total} kata benar
      </Text>
      <View style={styles.words}>
        {result.marks.map((m, i) => {
          if (m.kind === "correct") {
            return (
              <Text key={i} style={[styles.word, styles.correct]}>
                {m.word}
              </Text>
            );
          }
          if (m.kind === "wrong") {
            return (
              <Text key={i} style={[styles.word, styles.wrong]}>
                {m.word}
              </Text>
            );
          }
          return (
            <Text key={i} style={[styles.word, styles.extra]}>
              +{m.word}
            </Text>
          );
        })}
      </View>
      <Text style={styles.legend}>
        hijau = benar · merah = salah/terlewat · abu = kata ekstra
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  score: {
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  words: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  word: {
    fontSize: 16,
    marginRight: 4,
    lineHeight: 26,
  },
  correct: { color: colors.secondary, fontWeight: "600" },
  wrong: { color: colors.accentRed, textDecorationLine: "line-through" },
  extra: { color: colors.textSecondary, fontStyle: "italic" },
  legend: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
