import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

const BADGE_ICONS: Record<string, string> = {
  none: "",
  seedling: "🌱",
  sprout: "🌿",
  tree: "🌳",
  forest: "🌲",
};

const BADGE_LABELS: Record<string, string> = {
  none: "",
  seedling: "Bibit",
  sprout: "Tunas",
  tree: "Pohon",
  forest: "Hutan",
};

interface StreakBadgeProps {
  streak: number;
  badgeLevel: string;
  graceActive?: boolean;
  showLabel?: boolean;
}

export function StreakBadge({
  streak,
  badgeLevel,
  graceActive = false,
  showLabel = false,
}: StreakBadgeProps) {
  if (streak <= 0) return null;

  const icon = BADGE_ICONS[badgeLevel] ?? "";
  const label = BADGE_LABELS[badgeLevel] ?? "";

  return (
    <View
      style={[
        styles.container,
        graceActive && styles.graceContainer,
        showLabel && styles.wideContainer,
      ]}
    >
      <View style={styles.mainRow}>
        <Text style={styles.flame}>🔥</Text>
        <Text style={[styles.count, graceActive && styles.graceText]}>
          {streak}
        </Text>
        {icon !== "" && <Text style={styles.icon}>{icon}</Text>}
      </View>
      {showLabel && label && (
        <Text style={[styles.label, graceActive && styles.graceText]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  graceContainer: {
    backgroundColor: "#FFF8E1",
    borderColor: "#FFB300",
  },
  wideContainer: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  flame: {
    fontSize: 16,
  },
  count: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  graceText: {
    color: "#E65100",
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 2,
  },
});
