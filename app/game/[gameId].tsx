import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { WebView } from "react-native-webview";
import { playGame, extendGameSession, endGameSession } from "../../src/lib/api";
import { getSelectedChild } from "../../src/lib/session";
import { getChildren } from "../../src/lib/children";
import { colors } from "../../src/theme";
import type { GameSession, Child } from "../../src/types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function GamePlayScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const selectedChild = getSelectedChild();

  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showExtend, setShowExtend] = useState(false);
  const [extending, setExtending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<string | null>(null);

  const startTimer = useCallback((expiresAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const update = () => {
      const now = Date.now();
      const end = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((end - now) / 1000));
      setSecondsLeft(remaining);
      setShowExtend(remaining <= 60 && remaining > 0);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleSessionEnd();
      }
    };

    update();
    timerRef.current = setInterval(update, 1000);
  }, []);

  const startGame = useCallback(async () => {
    if (!selectedChild || !gameId) return;

    setLoading(true);
    setError(null);
    try {
      // Check coin balance first
      const children = await getChildren();
      const child = children.find((c) => c.id === selectedChild.id);
      if (!child) {
        setError("Data anak tidak ditemukan");
        setLoading(false);
        return;
      }

      const gameSession = await playGame(Number(gameId), selectedChild.id);
      setSession(gameSession);
      sessionRef.current = gameSession.session_id;
      startTimer(gameSession.expires_at);
    } catch (e: any) {
      setError(e.message || "Gagal memulai permainan");
    } finally {
      setLoading(false);
    }
  }, [selectedChild?.id, gameId, startTimer]);

  useEffect(() => {
    startGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startGame]);

  const handleExtend = async () => {
    if (!session) return;
    setExtending(true);
    try {
      const updated = await extendGameSession(session.session_id);
      setSession(updated);
      startTimer(updated.expires_at);
      setShowExtend(false);
    } catch (e: any) {
      Alert.alert("Gagal", e.message || "Gagal memperpanjang sesi");
    } finally {
      setExtending(false);
    }
  };

  const handleSessionEnd = useCallback(async () => {
    if (sessionRef.current) {
      try {
        await endGameSession(sessionRef.current);
      } catch {
        // ignore
      }
      sessionRef.current = null;
    }
  }, []);

  const handleBack = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    await handleSessionEnd();
    router.back();
  };

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      // Handle game events from WebView
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
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Kembali</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Permainan</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Memulai permainan...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Kembali</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Permainan</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={startGame}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top bar with timer and controls */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Kembali</Text>
        </Pressable>

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

        {showExtend && (
          <Pressable
            onPress={handleExtend}
            style={styles.extendBtn}
            disabled={extending}
          >
            <Text style={styles.extendText}>
              {extending ? "..." : "Perpanjang"}
            </Text>
          </Pressable>
        )}

        {session && (
          <View style={styles.coinBadge}>
            <Text style={styles.coinText}>{session.coins_remaining} koin</Text>
          </View>
        )}
      </View>

      {/* WebView */}
      {session && (
        <WebView
          source={{ uri: session.game_url }}
          style={styles.webview}
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
    paddingTop: 50,
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
    paddingTop: 50,
    paddingBottom: 8,
    backgroundColor: colors.primary,
    gap: 10,
  },
  timerContainer: {
    flex: 1,
    alignItems: "center",
  },
  timerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFF",
  },
  timerWarning: {
    color: colors.accentRed,
  },
  extendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.secondary,
    borderRadius: 10,
  },
  extendText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  coinBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.accent,
    borderRadius: 14,
  },
  coinText: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textOnAccent,
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
