import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

export const BADGE_ICONS: Record<string, string> = {
  none: "",
  seed: "\U0001f331",
  sprout: "\U0001f33f",
  bud: "\U0001f339",
  young: "\U0001f353",
  ripe: "\U0001f353",
  giant: "\U0001fc6",
  // Backend Indonesian names -- alias to same icons
  benih: "\U0001f331",
  tunas_hijau: "\U0001f33f",
  kuncup_merah: "\U0001f339",
  strawberry_muda: "\U0001f353",
  strawberry_manis: "\U0001f353",
  strawbarry_raksasa: "\U0001fc6",
  strawberry_raksasa: "\U0001fc6",
};

const BADGE_LABELS: Record<string, string> = {
  none: "",
  seed: "Benih",
  sprout: "Tunas Hijau",
  bud: "Kuncup Merah",
  young: "Strawberry Muda",
  ripe: "Strawberry Manis",
  giant: "Strawberry Raksasa",
  // Backend Indonesian names -- alias to same labels
  benih: "Benih",
  tunas_hijau: "Tunas Hijau",
  kuncup_merah: "Kuncup Merah",
  strawberry_muda: "Strawberry Muda",
  strawberry_manis: "Strawberry Manis",
  strawbarry_raksasa: "Strawberry Raksasa",
  strawberry_raksasa: "Strawberry Raksasa",
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
        <Text style={styles.flame}>{"\U0001f525"}</Text>
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
