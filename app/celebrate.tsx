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
  withSequence,
  withTiming,
} from "react-native-reanimated";

export default function CelebrateScreen() {
  const { coins, stars, bookTitle } = useLocalSearchParams<{
    coins: string;
    stars: string;
    bookTitle: string;
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
          <Text style={styles.rewardIcon}>coin</Text>
          <Text style={[styles.rewardCount, isTablet && styles.rewardCountTablet]}>
            +{coins}
          </Text>
          <Text style={styles.rewardLabel}>Koin</Text>
        </Animated.View>

        {Number(stars) > 0 && (
          <Animated.View style={[styles.rewardCard, starsStyle]}>
            <Text style={styles.rewardIcon}>star</Text>
            <Text style={[styles.rewardCount, isTablet && styles.rewardCountTablet]}>
              +{stars}
            </Text>
            <Text style={styles.rewardLabel}>Bintang</Text>
          </Animated.View>
        )}
      </View>

      <Animated.View style={buttonStyle}>
        <Pressable
          style={styles.button}
          onPress={() => router.replace("/home")}
        >
          <Text style={styles.buttonText}>Baca buku lain</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A73E8",
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
    color: "#BBD5F8",
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
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    minWidth: 120,
  },
  rewardIcon: {
    fontSize: 14,
    color: "#FFD54F",
    marginBottom: 4,
  },
  rewardCount: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FFD54F",
  },
  rewardCountTablet: { fontSize: 48 },
  rewardLabel: {
    fontSize: 16,
    color: "#BBD5F8",
    marginTop: 4,
  },
  button: {
    backgroundColor: "#FFF",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A73E8",
  },
});
