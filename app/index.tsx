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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChildren } from "../src/hooks/useChildren";
import { selectChild } from "../src/lib/session";
import { getSetting } from "../src/lib/database";
import { colors } from "../src/theme";

function Avatar({
  name,
  color,
  size = 80,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        { backgroundColor: color, width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

export default function ChildSelectScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { data: children, isLoading } = useChildren();
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    getSetting("last_sync_status").then((status) => {
      setSyncError(status && status !== "ok" ? status : null);
    });
  }, [children]); // re-check when children data updates

  const isTablet = width >= 600;
  const avatarSize = isTablet ? 120 : 80;
  const numColumns = isTablet ? 4 : 3;

  const handleSelectChild = (child: { id: number; name: string; age?: number }) => {
    selectChild(child);
    router.push("/home");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={[styles.title, isTablet && styles.titleTablet]}>
        Hayya Baca!
      </Text>
      <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
        Siapa yang mau baca?
      </Text>

      {isLoading ? (
        <Text style={styles.loading}>Memuat...</Text>
      ) : (
        <FlatList
          data={children}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <Pressable
              style={styles.childCard}
              onPress={() => handleSelectChild(item)}
            >
              <Avatar name={item.name} color={item.avatarColor} size={avatarSize} />
              <Text style={styles.childName}>{item.name}</Text>
              <Text style={styles.childCoins}>{item.coins} koin</Text>
            </Pressable>
          )}
          keyExtractor={(item) => String(item.id)}
        />
      )}

      {syncError && (
        <Text style={styles.syncError}>Sync bermasalah - bilang ke Ayah/Bunda</Text>
      )}

      <Pressable
        style={[styles.parentButton, { bottom: insets.bottom + 8 }]}
        onPress={() => router.push("/parent")}
      >
        <Text style={styles.parentButtonText}>Orang Tua</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    alignItems: "center",
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  titleTablet: { fontSize: 56 },
  subtitle: {
    fontSize: 20,
    color: colors.textSecondary,
    marginBottom: 40,
  },
  subtitleTablet: { fontSize: 26 },
  loading: { fontSize: 18, color: colors.textLight, marginTop: 40 },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  row: {
    justifyContent: "center",
    gap: 24,
    marginBottom: 24,
  },
  childCard: {
    alignItems: "center",
    width: 140,
  },
  avatar: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  avatarText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  childName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  childCoins: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
    marginTop: 2,
  },
  parentButton: {
    position: "absolute",
    right: 24,
    backgroundColor: colors.bgCard,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  parentButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  syncError: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
});
