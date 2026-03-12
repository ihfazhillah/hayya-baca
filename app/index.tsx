import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useChildren, useAddChild } from "../src/hooks/useChildren";
import { selectChild } from "../src/lib/session";
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
  const { data: children, isLoading } = useChildren();
  const addChild = useAddChild();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");

  const isTablet = width >= 600;
  const avatarSize = isTablet ? 120 : 80;
  const numColumns = isTablet ? 4 : 3;

  const handleSelectChild = (child: { id: number; name: string; age?: number }) => {
    selectChild(child);
    router.push("/home");
  };

  const handleAddChild = () => {
    if (!newName.trim()) return;
    addChild.mutate(
      { name: newName.trim(), age: newAge ? parseInt(newAge) : undefined },
      {
        onSuccess: () => {
          setNewName("");
          setNewAge("");
          setShowForm(false);
        },
      }
    );
  };

  return (
    <View style={styles.container}>
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
          ListFooterComponent={
            <Pressable
              style={styles.addButton}
              onPress={() => setShowForm(true)}
            >
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: colors.primaryLight,
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    borderWidth: 3,
                    borderColor: colors.primary,
                    borderStyle: "dashed",
                  },
                ]}
              >
                <Text style={[styles.avatarText, { fontSize: avatarSize * 0.4 }]}>
                  +
                </Text>
              </View>
              <Text style={styles.childName}>Tambah</Text>
            </Pressable>
          }
        />
      )}

      {showForm && (
        <View style={styles.formOverlay}>
          <View style={styles.form}>
            <Text style={styles.formTitle}>Anak baru</Text>
            <TextInput
              style={styles.input}
              placeholder="Nama"
              placeholderTextColor={colors.textLight}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Umur (opsional)"
              placeholderTextColor={colors.textLight}
              value={newAge}
              onChangeText={setNewAge}
              keyboardType="number-pad"
            />
            <View style={styles.formButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowForm(false)}
              >
                <Text style={{ color: colors.textSecondary }}>Batal</Text>
              </Pressable>
              <Pressable style={styles.submitBtn} onPress={handleAddChild}>
                <Text style={styles.submitText}>Tambah</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    paddingTop: 60,
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
  addButton: {
    alignItems: "center",
    width: 140,
    alignSelf: "center",
    marginTop: 8,
  },
  formOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 24,
    width: 300,
    elevation: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: colors.primary,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    color: colors.textPrimary,
  },
  formButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    padding: 12,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 12,
    paddingHorizontal: 24,
  },
  submitText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});
