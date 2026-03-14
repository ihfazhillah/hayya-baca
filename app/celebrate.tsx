import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState, useMemo } from "react";
import { Image } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../src/theme";
import { getAllBooks } from "../src/lib/books";
import { getSimilarBooks } from "../src/lib/recommendation";
import type { Book } from "../src/types";

export default function CelebrateScreen() {
  const { coins, stars, bookTitle, bookId, quizScore } = useLocalSearchParams<{
    coins: string;
    stars: string;
    bookTitle: string;
    bookId?: string;
    quizScore?: string;
  }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 600;

  const titleScale = useSharedValue(0);
  const coinsScale = useSharedValue(0);
  const starsScale = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  // Get a recommendation (similar book, or first unread)
  const recommendation = useMemo(() => {
    if (!bookId || quizScore) return null; // only for books, not articles
    const allBooks = getAllBooks();
    const similar = getSimilarBooks(bookId, allBooks as any);
    if (similar.length > 0) return similar[0] as Book;
    // Fallback: first book that isn't the current one
    const other = allBooks.find(b => b.id !== bookId);
    return other ?? null;
  }, [bookId, quizScore]);

  useEffect(() => {
    titleScale.value = withSpring(1, { damping: 8 });
    coinsScale.value = withDelay(300, withSpring(1, { damping: 8 }));
    starsScale.value = withDelay(600, withSpring(1, { damping: 8 }));
    buttonOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  const coinsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coinsScale.value }],
  }));

  const starsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starsScale.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Animated.View style={titleStyle}>
        <Text style={[styles.congrats, isTablet && styles.congratsTablet]}>
          Alhamdulillah!
        </Text>
        <Text style={[styles.bookDone, isTablet && styles.bookDoneTablet]}>
          Kamu sudah selesai membaca
        </Text>
        <Text style={[styles.bookTitle, isTablet && styles.bookTitleTablet]}>
          {bookTitle}
        </Text>
      </Animated.View>

      <View style={styles.rewards}>
        <Animated.View style={[styles.rewardCard, coinsStyle]}>
          <Text style={styles.rewardEmoji}>coin</Text>
          <Text style={[styles.rewardCount, isTablet && styles.rewardCountTablet]}>
            +{coins}
          </Text>
          <Text style={styles.rewardLabel}>Koin</Text>
        </Animated.View>

        {Number(stars) > 0 && (
          <Animated.View style={[styles.rewardCard, starsStyle]}>
            <Text style={styles.rewardEmoji}>star</Text>
            <Text style={[styles.rewardCount, isTablet && styles.rewardCountTablet]}>
              +{stars}
            </Text>
            <Text style={styles.rewardLabel}>Bintang</Text>
          </Animated.View>
        )}
      </View>

      {quizScore && (
        <Text style={styles.quizScore}>
          Skor kuis: {quizScore} benar
        </Text>
      )}

      {recommendation && (
        <Animated.View style={buttonStyle}>
          <Pressable
            style={styles.recCard}
            onPress={() => router.replace(`/read/${recommendation.id}`)}
          >
            <View style={styles.recCover}>
              <Text style={styles.recInitial}>{recommendation.title.charAt(0)}</Text>
            </View>
            <View style={styles.recInfo}>
              <Text style={styles.recLabel}>Baca Selanjutnya</Text>
              <Text style={styles.recTitle} numberOfLines={2}>{recommendation.title}</Text>
            </View>
          </Pressable>
        </Animated.View>
      )}

      <Animated.View style={buttonStyle}>
        <Pressable
          style={styles.button}
          onPress={() => router.replace("/home")}
        >
          <Text style={styles.buttonText}>
            {quizScore ? "Baca artikel lain" : "Kembali"}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  congrats: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
  },
  congratsTablet: { fontSize: 56 },
  bookDone: {
    fontSize: 18,
    color: colors.primaryLight,
    textAlign: "center",
    marginTop: 8,
  },
  bookDoneTablet: { fontSize: 22 },
  bookTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginTop: 4,
  },
  bookTitleTablet: { fontSize: 28 },
  rewards: {
    flexDirection: "row",
    gap: 24,
    marginTop: 48,
    marginBottom: 48,
  },
  rewardCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    minWidth: 120,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  rewardEmoji: {
    fontSize: 14,
    color: colors.coin,
    marginBottom: 4,
  },
  rewardCount: {
    fontSize: 36,
    fontWeight: "bold",
    color: colors.coin,
  },
  rewardCountTablet: { fontSize: 48 },
  rewardLabel: {
    fontSize: 16,
    color: colors.primaryLight,
    marginTop: 4,
  },
  quizScore: {
    fontSize: 18,
    color: colors.primaryLight,
    textAlign: "center",
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textOnAccent,
  },
  recCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    maxWidth: 320,
  },
  recCover: {
    width: 56,
    height: 72,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recInitial: {
    fontSize: 24,
    color: "#FFF",
    fontWeight: "bold",
  },
  recInfo: {
    flex: 1,
  },
  recLabel: {
    fontSize: 12,
    color: colors.primaryLight,
    marginBottom: 4,
  },
  recTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
  },
});
