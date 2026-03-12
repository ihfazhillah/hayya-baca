import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { getChildren } from "../src/lib/children";
import { getSelectedChild } from "../src/lib/session";
import { colors } from "../src/theme";
import type { Child } from "../src/types";

type SortBy = "coins" | "stars";

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <Text style={styles.medal}>1</Text>;
  if (rank === 2) return <Text style={styles.medal}>2</Text>;
  if (rank === 3) return <Text style={styles.medal}>3</Text>;
  return <Text style={styles.rankNum}>{rank}</Text>;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const currentChild = getSelectedChild();

  const [children, setChildren] = useState<Child[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("coins");

  useEffect(() => {
    getChildren().then(setChildren);
  }, []);

  const sorted = [...children].sort((a, b) =>
    sortBy === "coins" ? b.coins - a.coins : b.stars - a.stars
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Kembali</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Peringkat</Text>
      </View>

      {/* Sort toggle */}
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, sortBy === "coins" && styles.toggleActive]}
          onPress={() => setSortBy("coins")}
        >
          <Text style={[styles.toggleText, sortBy === "coins" && styles.toggleTextActive]}>
            Koin
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, sortBy === "stars" && styles.toggleActive]}
          onPress={() => setSortBy("stars")}
        >
          <Text style={[styles.toggleText, sortBy === "stars" && styles.toggleTextActive]}>
            Bintang
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={sorted}
        contentContainerStyle={[styles.list, isTablet && { paddingHorizontal: 64 }]}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => {
          const isMe = currentChild?.id === item.id;
          return (
            <View style={[styles.row, isMe && styles.rowMe]}>
              <View style={styles.rankCol}>
                <Medal rank={index + 1} />
              </View>
              <View
                style={[styles.avatar, { backgroundColor: item.avatarColor }]}
              >
                <Text style={styles.avatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.nameCol}>
                <Text style={[styles.name, isMe && styles.nameMe]}>
                  {item.name}
                  {isMe ? " (kamu)" : ""}
                </Text>
                {item.age != null && (
                  <Text style={styles.age}>{item.age} tahun</Text>
                )}
              </View>
              <View style={styles.scoreCol}>
                <Text style={styles.scoreNum}>
                  {sortBy === "coins" ? item.coins : item.stars}
                </Text>
                <Text style={styles.scoreLabel}>
                  {sortBy === "coins" ? "koin" : "bintang"}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Belum ada data</Text>
        }
      />
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
  toggleRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.border,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: "#FFF",
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  rowMe: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  rankCol: {
    width: 36,
    alignItems: "center",
  },
  medal: {
    fontSize: 22,
  },
  rankNum: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textSecondary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  avatarText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  nameCol: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  nameMe: {
    color: colors.primary,
  },
  age: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scoreCol: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  scoreNum: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.accent,
  },
  scoreLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  empty: {
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: 40,
    fontSize: 16,
  },
});
