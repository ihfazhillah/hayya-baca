import { View, Text, Pressable, StyleSheet } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { colors } from "../theme";
import { onDataChange } from "../lib/db-events";
import { getStreakStatus } from "../lib/streak";

interface StreakReminderBannerProps {
  childId: number;
  visible: boolean;
  onDismiss?: () => void;
}

export function StreakReminderBanner({
  childId,
  visible,
  onDismiss,
}: StreakReminderBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [graceDaysRemaining, setGraceDaysRemaining] = useState<number | null>(null);

  const checkStreak = useCallback(async () => {
    if (dismissed) return;
    const status = await getStreakStatus(childId);
    // If streak is now active (read today), auto-dismiss
    if (status.graceActive === false && status.currentStreak > 0) {
      setDismissed(true);
      onDismiss?.();
    }
    setGraceDaysRemaining(status.graceDaysRemaining);
  }, [childId, dismissed, onDismiss]);

  useEffect(() => {
    return onDataChange("streak", checkStreak);
  }, [checkStreak]);

  if (!visible || dismissed) return null;

  const countdownText = graceDaysRemaining != null && graceDaysRemaining > 0
    ? `Sisa ${graceDaysRemaining} hari sebelum streakmu putus`
    : 'Streakmu hampir putus! Baca buku sekarang untuk lanjutkan streakmu.';

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerIcon}>⚠️</Text>
      <Text style={styles.bannerText}>
        {countdownText}
      </Text>
      <Pressable onPress={onDismiss ?? (() => setDismissed(true))} style={styles.dismissBtn}>
        <Text style={styles.dismissText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    borderBottomColor: "#FFB74D",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  bannerIcon: {
    fontSize: 18,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: "#E65100",
    fontWeight: "600",
  },
  dismissBtn: {
    padding: 4,
  },
  dismissText: {
    fontSize: 16,
    color: colors.textLight,
  },
});
