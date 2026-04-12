import { Pressable, Text, StyleSheet } from "react-native";

export function BookmarkStar({
  bookmarked,
  onToggle,
  size = 26,
}: {
  bookmarked: boolean;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityLabel="Bookmark"
      accessibilityRole="button"
      accessibilityState={{ selected: bookmarked }}
      style={styles.btn}
      hitSlop={10}
    >
      <Text style={[styles.icon, { fontSize: size }, bookmarked ? styles.filled : styles.outline]}>
        {bookmarked ? "\u2605" : "\u2606"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  icon: {
    fontWeight: "bold",
  },
  filled: {
    color: "#FFD24A",
  },
  outline: {
    color: "#FFFFFF",
  },
});
