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
                    backgroundColor: "#DDD",
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                  },
                ]}
              >
                <Text style={[styles.avatarText, { fontSize: avatarSize * 0.4, color: "#888" }]}>
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
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Umur (opsional)"
              value={newAge}
              onChangeText={setNewAge}
              keyboardType="number-pad"
            />
            <View style={styles.formButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowForm(false)}
              >
                <Text>Batal</Text>
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
    backgroundColor: "#E6F4FE",
    paddingTop: 60,
    alignItems: "center",
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#1A73E8",
    marginBottom: 4,
  },
  titleTablet: { fontSize: 56 },
  subtitle: {
    fontSize: 20,
    color: "#555",
    marginBottom: 40,
  },
  subtitleTablet: { fontSize: 26 },
  loading: { fontSize: 18, color: "#888", marginTop: 40 },
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
  },
  avatarText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  childName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  childCoins: {
    fontSize: 13,
    color: "#888",
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
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  form: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 24,
    width: 300,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
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
    backgroundColor: "#1A73E8",
    padding: 12,
    borderRadius: 8,
    paddingHorizontal: 24,
  },
  submitText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});
