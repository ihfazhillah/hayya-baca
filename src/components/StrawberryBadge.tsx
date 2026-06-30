import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

// 6 strawberry growth stages
const BADGE_CONFIGS: Record<string, { emoji: string; label: string; bgColor: string }> = {
  none: { emoji: "", label: "", bgColor: "" },
  seed: { emoji: "🌰", label: "Benih", bgColor: "#FFF3E0" },
  sprout: { emoji: "🌱", label: "Tunas", bgColor: "#E8F5E9" },
  bud: { emoji: "🌹", label: "Kuncup", bgColor: "#FCE4EC" },
  young: { emoji: "🍓", label: "Strawberry Muda", bgColor: "#F8BBD0" },
  ripe: { emoji: "🍓", label: "Strawberry Manis", bgColor: "#F48FB1" },
  giant: { emoji: "🏆", label: "Strawberry Raksasa", bgColor: "#CE93D8" },
};

interface StrawberryBadgeProps {
  badgeLevel: string;
  size?: number; // icon size in px
  showLabel?: boolean;
  dimmed?: boolean; // for grace period
}

export function StrawberryBadge({
  badgeLevel,
  size = 24,
  showLabel = false,
  dimmed = false,
}: StrawberryBadgeProps) {
  const config = BADGE_CONFIGS[badgeLevel] ?? BADGE_CONFIGS.none;

  if (badgeLevel === "none") return null;

  return (
    <View style={[styles.container, showLabel && styles.wideContainer]}>
      <View style={[styles.badgeWrapper, { backgroundColor: config.bgColor }]}>
        <Text style={[styles.emoji, { fontSize: size }]}>{config.emoji}</Text>
      </View>
      {showLabel && config.label && (
        <Text style={[styles.label, dimmed && styles.dimmedText]}>
          {config.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  wideContainer: {
    gap: 6,
  },
  badgeWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: {
    fontSize: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  dimmedText: {
    color: "#E65100",
    opacity: 0.7,
  },
});
