import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { fetchGames } from "../src/lib/api";
import { getSelectedChild } from "../src/lib/session";
import { getChildren } from "../src/lib/children";
import { colors } from "../src/theme";
import type { Game, Child } from "../src/types";

export default function GamesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const selectedChild = getSelectedChild();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [childData, setChildData] = useState<Child | null>(null);

  const isTablet = width >= 600;
  const padding = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gamesData, children] = await Promise.all([
        fetchGames(),
        selectedChild ? getChildren() : Promise.resolve([]),
      ]);
      setGames(gamesData);
      if (selectedChild) {
        const found = children.find((c) => c.id === selectedChild.id);
        if (found) setChildData(found);
      }
    } catch (e: any) {
      setError(e.message || "Gagal memuat permainan");
    } finally {
      setLoading(false);
    }
  }, [selectedChild?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!selectedChild) {
    router.replace("/");
    return null;
  }

  function GameCard({ game }: { game: Game }) {
    const initials = game.title
      .split(" ")
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join("");

    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/game/${game.id}`)}
      >
        <View style={styles.cardIcon}>
          <Text style={styles.cardIconText}>{initials}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {game.title}
          </Text>
          <Text style={styles.cardDesc} numberOfLines={2}>
            {game.description}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>{game.cost_per_play} koin</Text>
            <Text style={styles.metaDot}> / </Text>
            <Text style={styles.metaText}>{game.session_minutes} menit</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Kembali</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Permainan</Text>
        {childData && (
          <View style={styles.coinBadge}>
            <Text style={styles.coinText}>{childData.coins} koin</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Memuat permainan...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={games}
          contentContainerStyle={[
            styles.list,
            isTablet && { paddingHorizontal: 64 },
          ]}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <GameCard game={item} />}
          ListEmptyComponent={
            <Text style={styles.empty}>Belum ada permainan tersedia</Text>
          }
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
    marginRight: 12,
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
  },
  coinBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.accent,
    borderRadius: 14,
  },
  coinText: {
    fontSize: 14,
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
  list: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cardIconText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
  },
  cardContent: {
    flex: 1,
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: "600",
  },
  metaDot: {
    fontSize: 12,
    color: colors.textLight,
  },
  empty: {
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: 40,
    fontSize: 16,
  },
});
