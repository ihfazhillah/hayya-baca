import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../src/theme";

export default function CelebrateScreen() {
  const { coins, stars, bookTitle, quizScore } = useLocalSearchParams<{
    coins: string;
    stars: string;
    bookTitle: string;
    quizScore?: string;
  }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const titleScale = useSharedValue(0);
  const coinsScale = useSharedValue(0);
  const starsScale = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

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
    <View style={styles.container}>
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

      <Animated.View style={buttonStyle}>
        <Pressable
          style={styles.button}
          onPress={() => router.replace("/home")}
        >
          <Text style={styles.buttonText}>
            {quizScore ? "Baca artikel lain" : "Baca buku lain"}
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
});
