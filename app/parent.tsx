import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../src/theme";
import { getSetting, setSetting } from "../src/lib/database";
import { login, logout, isLoggedIn } from "../src/lib/api";
import { syncAll } from "../src/lib/sync";
import { getChildren } from "../src/lib/children";
import { getRewardHistory } from "../src/lib/rewards";
import { getAllReadingProgress } from "../src/lib/rewards";
import type { Child, RewardHistory } from "../src/types";
import Constants from "expo-constants";

type Screen = "pin" | "set_pin" | "dashboard";

export default function ParentScreen() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("pin");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const savedPin = await getSetting("parent_pin");
      if (!savedPin) {
        setScreen("set_pin");
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (screen === "set_pin") {
    return <SetPinScreen onDone={() => setScreen("dashboard")} />;
  }

  if (screen === "pin") {
    return (
      <PinGateScreen
        pin={pin}
        setPin={setPin}
        onSuccess={() => setScreen("dashboard")}
        onBack={() => router.back()}
      />
    );
  }

  return <Dashboard onBack={() => router.back()} />;
}

function SetPinScreen({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const handleNext = async () => {
    if (step === 1) {
      if (pin.length !== 4) {
        Alert.alert("PIN harus 4 digit");
        return;
      }
      setStep(2);
    } else {
      if (pin !== confirm) {
        Alert.alert("PIN tidak cocok");
        setConfirm("");
        return;
      }
      await setSetting("parent_pin", pin);
      onDone();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.gateTitle}>
        {step === 1 ? "Buat PIN Orang Tua" : "Konfirmasi PIN"}
      </Text>
      <Text style={styles.gateSubtitle}>Masukkan 4 digit angka</Text>
      <TextInput
        style={styles.pinInput}
        value={step === 1 ? pin : confirm}
        onChangeText={step === 1 ? setPin : setConfirm}
        keyboardType="number-pad"
        maxLength={4}
        secureTextEntry
        autoFocus
        placeholder="----"
        placeholderTextColor={colors.textLight}
      />
      <Pressable style={styles.primaryBtn} onPress={handleNext}>
        <Text style={styles.primaryBtnText}>
          {step === 1 ? "Lanjut" : "Simpan"}
        </Text>
      </Pressable>
    </View>
  );
}

function PinGateScreen({
  pin,
  setPin,
  onSuccess,
  onBack,
}: {
  pin: string;
  setPin: (v: string) => void;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const handleSubmit = async () => {
    const saved = await getSetting("parent_pin");
    if (pin === saved) {
      onSuccess();
    } else {
      Alert.alert("PIN salah");
      setPin("");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.gateTitle}>Halaman Orang Tua</Text>
      <Text style={styles.gateSubtitle}>Masukkan PIN</Text>
      <TextInput
        style={styles.pinInput}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        maxLength={4}
        secureTextEntry
        autoFocus
        placeholder="----"
        placeholderTextColor={colors.textLight}
      />
      <View style={styles.gateButtons}>
        <Pressable style={styles.secondaryBtn} onPress={onBack}>
          <Text style={styles.secondaryBtnText}>Kembali</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={handleSubmit}>
          <Text style={styles.primaryBtnText}>Masuk</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Dashboard({ onBack }: { onBack: () => void }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [rewards, setRewards] = useState<RewardHistory[]>([]);
  const [progress, setProgress] = useState<
    Record<string, { lastPage: number; completed: boolean; completedCount: number }>
  >({});

  const loadData = useCallback(async () => {
    const li = await isLoggedIn();
    setLoggedIn(li);
    const kids = await getChildren();
    setChildren(kids);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      await login(username, password);
      setLoggedIn(true);
      setUsername("");
      setPassword("");
      setSyncStatus("Login berhasil, sinkronisasi...");
      await syncAll();
      await loadData();
      setSyncStatus("Selesai");
    } catch (e: any) {
      Alert.alert("Login Gagal", e.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setLoggedIn(false);
    setSyncStatus("");
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus("Sinkronisasi...");
    try {
      await syncAll();
      await loadData();
      setSyncStatus("Selesai");
    } catch {
      setSyncStatus("Gagal");
    } finally {
      setSyncing(false);
    }
  };

  const viewChildDetail = async (child: Child) => {
    setSelectedChild(child);
    const [r, p] = await Promise.all([
      getRewardHistory(child.id),
      getAllReadingProgress(child.id),
    ]);
    setRewards(r);
    setProgress(p);
  };

  const version = Constants.expoConfig?.version ?? "?";

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Orang Tua</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Auth section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Akun</Text>
        {loggedIn ? (
          <View style={styles.row}>
            <Text style={styles.label}>Sudah login</Text>
            <Pressable style={styles.secondaryBtn} onPress={handleLogout}>
              <Text style={styles.secondaryBtnText}>Logout</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.textLight}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Pressable
              style={[styles.primaryBtn, loginLoading && styles.disabledBtn]}
              onPress={handleLogin}
              disabled={loginLoading}
            >
              <Text style={styles.primaryBtnText}>
                {loginLoading ? "Masuk..." : "Login"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Sync section */}
      {loggedIn && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sinkronisasi</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{syncStatus || "Siap"}</Text>
            <Pressable
              style={[styles.primaryBtn, syncing && styles.disabledBtn]}
              onPress={handleSync}
              disabled={syncing}
            >
              <Text style={styles.primaryBtnText}>
                {syncing ? "..." : "Sync"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Children summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Anak-anak</Text>
        {children.length === 0 ? (
          <Text style={styles.label}>Belum ada anak</Text>
        ) : (
          children.map((child) => (
            <Pressable
              key={child.id}
              style={[
                styles.childRow,
                selectedChild?.id === child.id && styles.childRowSelected,
              ]}
              onPress={() => viewChildDetail(child)}
            >
              <View
                style={[styles.miniAvatar, { backgroundColor: child.avatarColor }]}
              >
                <Text style={styles.miniAvatarText}>
                  {child.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.childStats}>
                  {child.coins} koin · {child.stars} bintang
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      {/* Child detail */}
      {selectedChild && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Detail: {selectedChild.name}
          </Text>
          <Text style={styles.label}>
            Buku dibaca: {Object.keys(progress).length}
          </Text>
          <Text style={styles.label}>
            Buku selesai:{" "}
            {Object.values(progress).filter((p) => p.completed).length}
          </Text>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            Riwayat Reward (terakhir 20)
          </Text>
          {rewards.slice(0, 20).map((r) => (
            <View key={r.id} style={styles.rewardRow}>
              <Text style={styles.rewardType}>
                {r.type === "coin" ? "Koin" : "Bintang"} +{r.count}
              </Text>
              <Text style={styles.rewardDesc}>{r.description}</Text>
            </View>
          ))}
          {rewards.length === 0 && (
            <Text style={styles.label}>Belum ada reward</Text>
          )}
        </View>
      )}

      {/* App info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aplikasi</Text>
        <Text style={styles.label}>Versi: {version}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.primary,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: "600",
  },
  gateTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 8,
  },
  gateSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  pinInput: {
    fontSize: 32,
    textAlign: "center",
    letterSpacing: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    width: 200,
    color: colors.textPrimary,
    marginBottom: 24,
  },
  gateButtons: {
    flexDirection: "row",
    gap: 12,
  },
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    color: colors.textPrimary,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  disabledBtn: {
    opacity: 0.6,
  },
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  childRowSelected: {
    backgroundColor: colors.bgPrimary,
  },
  miniAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  miniAvatarText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 18,
  },
  childName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  childStats: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rewardRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rewardType: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
  },
  rewardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
