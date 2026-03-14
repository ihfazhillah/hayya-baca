import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useRef, useCallback } from "react";
import { WebView } from "react-native-webview";
import { fetchGames } from "../../src/lib/api";
import { getSelectedChild } from "../../src/lib/session";
import { getChildren, updateChildCoins } from "../../src/lib/children";
import { getActiveSession, createSession, endSession } from "../../src/lib/game-session";
import { colors } from "../../src/theme";
import type { Game } from "../../src/types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function GamePlayScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const selectedChild = getSelectedChild();
  const insets = useSafeAreaInsets();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameStarted = useRef(false);

  const loadGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const games = await fetchGames();
      const found = games.find((g) => g.slug === gameId);
      if (!found) {
        setError("Permainan tidak ditemukan");
        setLoading(false);
        return;
      }
      if (!found.bundle_url) {
        setError("Permainan belum tersedia");
        setLoading(false);
        return;
      }

      // Check for active session (resume without charging)
      if (selectedChild) {
        const active = await getActiveSession(selectedChild.id, gameId);
        if (active) {
          const remaining = Math.max(
            0,
            Math.floor((active.expiresAt - Date.now()) / 1000)
          );
          if (remaining > 0) {
            setGame(found);
            setSecondsLeft(remaining);
            gameStarted.current = true;
            return;
          }
        }

        // No active session — check coin balance and deduct
        const children = await getChildren();
        const child = children.find((c) => c.id === selectedChild.id);
        if (!child || child.coins < found.coin_cost) {
          setError(`Koin tidak cukup (perlu ${found.coin_cost}, punya ${child?.coins ?? 0})`);
          setLoading(false);
          return;
        }
        await updateChildCoins(selectedChild.id, -found.coin_cost);
        await createSession(selectedChild.id, found.slug, found.session_minutes);
      }

      setGame(found);
      setSecondsLeft(found.session_minutes * 60);
      gameStarted.current = true;
    } catch (e: any) {
      setError(e.message || "Gagal memuat permainan");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadGame]);

  // Start countdown when game is loaded
  useEffect(() => {
    if (!game) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [game]);

  // End session when timer reaches 0
  useEffect(() => {
    if (gameStarted.current && secondsLeft === 0 && game && selectedChild) {
      endSession(selectedChild.id, game.slug).catch(() => {});
      gameStarted.current = false;
    }
  }, [secondsLeft]);

  const handleBack = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    router.back();
  };

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "game_complete") {
        handleBack();
      }
    } catch {
      // ignore non-JSON messages
    }
  };

  if (!selectedChild) {
    router.replace("/");
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Kembali</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Permainan</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Memuat permainan...</Text>
        </View>
      </View>
    );
  }

  if (error || !game) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Kembali</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Permainan</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || "Permainan tidak ditemukan"}</Text>
          <Pressable style={styles.retryBtn} onPress={loadGame}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top bar with timer */}
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={handleBack} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Kembali</Text>
        </Pressable>

        <Text style={styles.topTitle} numberOfLines={1}>{game.title}</Text>

        <View style={styles.timerContainer}>
          <Text
            style={[
              styles.timerText,
              secondsLeft <= 60 && styles.timerWarning,
            ]}
          >
            {formatTime(secondsLeft)}
          </Text>
        </View>
      </View>

      {/* WebView */}
      {secondsLeft > 0 ? (
        <WebView
          source={{ uri: game.bundle_url! }}
          style={[styles.webview, { marginBottom: insets.bottom }]}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.timeUpText}>Waktu habis!</Text>
          <Pressable style={styles.retryBtn} onPress={handleBack}>
            <Text style={styles.retryText}>Kembali</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.primary,
  },
  headerBtn: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
  },
  headerBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFF",
    marginLeft: 12,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: colors.primary,
    gap: 10,
  },
  topTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  timerContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
  },
  timerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFF",
  },
  timerWarning: {
    color: "#FFD700",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: colors.accentRed,
    textAlign: "center",
    marginBottom: 16,
  },
  timeUpText: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  retryText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgPrimary,
  },
});
