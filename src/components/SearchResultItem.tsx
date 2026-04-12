import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import type { SearchResult } from "../types/search";

export function SearchResultItem({
  item,
  onPress,
}: {
  item: SearchResult;
  onPress: () => void;
}) {
  const initials = item.title
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("");
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.thumb}>
        <Text style={styles.thumbText}>{initials}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.badgeRow}>
          <Text style={styles.typeBadge}>
            {item.type === "book" ? "BUKU" : "ARTIKEL"}
          </Text>
          {item.alreadyRead && (
            <Text style={styles.readBadge}>✓ Pernah dibaca</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  thumbText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  typeBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFF",
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: "hidden",
  },
  readBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.wordReadText,
    backgroundColor: colors.wordRead,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: "hidden",
  },
});
