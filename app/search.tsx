import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../src/theme";
import { getSelectedChild } from "../src/lib/session";
import {
  searchContent,
  searchSuggest,
  logSearchClick,
} from "../src/lib/api";
import type { SearchResult, Suggestion } from "../src/types/search";
import { SearchResultItem } from "../src/components/SearchResultItem";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const child = getSelectedChild();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Initial popular suggestions
  useEffect(() => {
    searchSuggest("").then(setSuggestions).catch(() => {});
  }, []);

  useEffect(() => {
    const q = query.trim();
    const id = ++reqId.current;
    setError(null);
    if (q.length < MIN_CHARS) {
      setResults([]);
      setLoading(false);
      searchSuggest("")
        .then((s) => {
          if (reqId.current === id) setSuggestions(s);
        })
        .catch(() => {});
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const [s, r] = await Promise.all([
          searchSuggest(q),
          searchContent(q, child?.id),
        ]);
        if (reqId.current !== id) return;
        setSuggestions(s);
        setResults(r);
      } catch {
        if (reqId.current !== id) return;
        setError("Perlu internet untuk cari. Coba lagi ya!");
        setResults([]);
      } finally {
        if (reqId.current === id) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, child?.id]);

  const onTapResult = (item: SearchResult) => {
    if (child) {
      logSearchClick(child.id, query.trim(), item.slug, item.type);
    }
    if (item.type === "book") {
      router.push(`/read/${item.slug}`);
    } else {
      router.push(`/article/${item.slug}`);
    }
  };

  const onTapSuggestion = (s: Suggestion) => {
    setQuery(s.phrase);
  };

  const showPopular = query.trim().length < MIN_CHARS;
  const showEmptyResults =
    !showPopular && !loading && !error && results.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Cari buku atau artikel…"
          placeholderTextColor="rgba(255,255,255,0.7)"
          autoFocus
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          testID="search-input"
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {loading && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginBottom: 12 }}
          />
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {suggestions.length > 0 && (
          <View style={styles.suggestSection}>
            <Text style={styles.sectionTitle}>
              {showPopular ? "Pencarian populer" : "Saran"}
            </Text>
            <View style={styles.chipRow}>
              {suggestions.map((s) => (
                <Pressable
                  key={`${s.source}-${s.phrase}`}
                  style={styles.chip}
                  onPress={() => onTapSuggestion(s)}
                >
                  <Text style={styles.chipText}>{s.phrase}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!showPopular && results.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Hasil</Text>
            <FlatList
              data={results}
              scrollEnabled={false}
              keyExtractor={(it) => `${it.type}-${it.slug}`}
              renderItem={({ item }) => (
                <SearchResultItem item={item} onPress={() => onTapResult(item)} />
              )}
            />
          </View>
        )}

        {showEmptyResults && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>
              Tidak ditemukan. Coba kata lain ya!
            </Text>
          </View>
        )}

        {showPopular && suggestions.length === 0 && !error && (
          <Text style={styles.tip}>
            Ketik judul buku atau artikel yang ingin kamu cari.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  backBtn: {
    padding: 8,
  },
  backText: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
  },
  input: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
  },
  body: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  suggestSection: {
    marginBottom: 20,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: colors.accentRed,
    textAlign: "center",
    marginBottom: 12,
  },
  tip: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 16,
  },
});
