import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { getAllBooks } from "../src/lib/books";
import { getAllArticles } from "../src/lib/articles";
import { getSelectedChild } from "../src/lib/session";
import { colors } from "../src/theme";
import type { Book, Article } from "../src/types";

type Tab = "buku" | "artikel";

// Cover images mapped by book ID
const coverImages: Record<string, any> = {
  "1": require("../content/books/01-sahabat-yang-disebut-namanya-di-langit/cover.png"),
  "3": require("../content/books/03-terbunuhnya-singa-alloh/cover.png"),
  "4": require("../content/books/04-jarir-bin-abdillah-menghancurkan-ka-bah-yaman/cover.png"),
  "5": require("../content/books/05-keberanian-az-zubair-di-negri-habasyah/cover.png"),
  "6": require("../content/books/06-kisah-buhairo-sang-pendeta/cover.png"),
  "7": require("../content/books/07-bangganya-ummu-habibah-dengan-islam/cover.png"),
  "8": require("../content/books/08-amr-bin-salamah-si-imam-kecil/cover.png"),
  "9": require("../content/books/09-sahabat-cilik-nabi-yang-cerdas-1/cover.png"),
  "10": require("../content/books/10-nabi-muhammad/cover.png"),
  "11": require("../content/books/11-keberanian-umar-menampakkan-keislaman/cover.png"),
  "12": require("../content/books/12-al-asyaj-sang-pemilik-perangai-yang-alloh-cintai/cover.png"),
  "13": require("../content/books/13-sahabat-yang-tak-dihiraukan-oleh-orang-orang/cover.png"),
  "15": require("../content/books/15-keberanian-al-barro-bin-malik/cover.png"),
  "16": require("../content/books/16-keberanian-habib-bin-zaid/cover.png"),
  "17": require("../content/books/17-adab-abu-ayyub-al-anshori/cover.png"),
  "20": require("../content/books/20-kemuliaan-ammar-bin-yasir/cover.png"),
  "21": require("../content/books/21-kholid-bin-al-walid/cover.png"),
  "22": require("../content/books/22-sahabat-yang-tidak-ingin-ketinggalan-berperang/cover.png"),
  "23": require("../content/books/23-sahabat-yang-punya-2-sayap/cover.jpg"),
  "24": require("../content/books/24-sahabat-yang-memiliki-2-sayap/cover.png"),
};

function BookCard({ book, onPress, cardWidth }: { book: Book; onPress: () => void; cardWidth: number }) {
  const cover = coverImages[book.id];

  return (
    <Pressable style={[styles.card, { width: cardWidth }]} onPress={onPress}>
      {cover ? (
        <Image
          source={cover}
          style={[styles.bookCover, { width: cardWidth, height: cardWidth * 1.3 }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.coverPlaceholder, { width: cardWidth, height: cardWidth * 1.3 }]}>
          <Text style={styles.placeholderText}>{book.title.charAt(0)}</Text>
        </View>
      )}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={styles.cardMeta}>{book.pageCount} halaman</Text>
    </Pressable>
  );
}

function ArticleCard({ article, onPress, cardWidth }: { article: Article; onPress: () => void; cardWidth: number }) {
  const initials = article.title
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("");

  return (
    <Pressable style={[styles.card, { width: cardWidth }]} onPress={onPress}>
      <View style={[styles.articleCover, { width: cardWidth, height: cardWidth * 1.3 }]}>
        <Text style={styles.articleInitials}>{initials}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {article.title}
      </Text>
      <Text style={styles.cardMeta}>
        {article.quiz.length} soal kuis
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const child = getSelectedChild();
  const [tab, setTab] = useState<Tab>("buku");

  const books = useMemo(() => getAllBooks(), []);
  const articles = useMemo(() => getAllArticles(), []);

  const isTablet = width >= 600;
  const numColumns = isTablet ? 3 : 2;
  const gap = 20;
  const padding = 20;
  const cardWidth = (width - padding * 2 - gap * (numColumns - 1)) / numColumns;

  if (!child) {
    router.replace("/");
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/")} style={styles.backBtn}>
          <Text style={styles.backText}>Ganti</Text>
        </Pressable>
        <Text style={styles.greeting} numberOfLines={1}>Halo, {child.name}!</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === "buku" && styles.tabActive]}
          onPress={() => setTab("buku")}
        >
          <Text style={[styles.tabText, tab === "buku" && styles.tabTextActive]}>
            Buku
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "artikel" && styles.tabActive]}
          onPress={() => setTab("artikel")}
        >
          <Text style={[styles.tabText, tab === "artikel" && styles.tabTextActive]}>
            Artikel
          </Text>
        </Pressable>
      </View>

      {tab === "buku" ? (
        <FlatList
          data={books}
          numColumns={numColumns}
          key={`buku-${numColumns}`}
          contentContainerStyle={[styles.list, { paddingHorizontal: padding }]}
          columnWrapperStyle={{ gap, paddingHorizontal: 0 }}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          renderItem={({ item }) => (
            <BookCard
              book={item}
              cardWidth={cardWidth}
              onPress={() => router.push(`/read/${item.id}`)}
            />
          )}
          keyExtractor={(item) => item.id}
        />
      ) : (
        <FlatList
          data={articles}
          numColumns={numColumns}
          key={`artikel-${numColumns}`}
          contentContainerStyle={[styles.list, { paddingHorizontal: padding }]}
          columnWrapperStyle={{ gap, paddingHorizontal: 0 }}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          renderItem={({ item }) => (
            <ArticleCard
              article={item}
              cardWidth={cardWidth}
              onPress={() => router.push(`/article/${item.id}`)}
            />
          )}
          keyExtractor={(item) => item.id}
        />
      )}
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
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: colors.primary,
  },
  backBtn: {
    marginRight: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
  },
  backText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  greeting: {
    flex: 1,
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  tabActive: {
    backgroundColor: "#FFF",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  tabTextActive: {
    color: colors.primary,
  },
  list: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    paddingBottom: 4,
  },
  bookCover: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  coverPlaceholder: {
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 40,
    color: "#FFF",
    fontWeight: "bold",
  },
  articleCover: {
    backgroundColor: colors.secondary,
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  articleInitials: {
    fontSize: 36,
    color: "#FFF",
    fontWeight: "bold",
    opacity: 0.9,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
});
