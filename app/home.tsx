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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/core";
import { getAllBooks } from "../src/lib/books";
import { getAllArticles, fetchAllArticles } from "../src/lib/articles";
import { getSelectedChild } from "../src/lib/session";
import { getAllReadingProgress } from "../src/lib/rewards";
import { getLockedBooks, sortForDisplay, getNewContentIds, markContentSeen, getUnlockProgress } from "../src/lib/recommendation";
import { useUnsyncedCount } from "../src/lib/useUnsyncedCount";
import { syncAll } from "../src/lib/sync";
import { listBookmarks, type BookmarkRow } from "../src/lib/bookmarks";
import { colors } from "../src/theme";
import type { Book, Article } from "../src/types";

type FavoriteItem =
  | { kind: "book"; id: string; title: string; updatedAt: number }
  | { kind: "article"; id: string; title: string; updatedAt: number };

type Tab = "buku" | "artikel" | "permainan";
type ProgressMap = Record<string, { lastPage: number; completed: boolean; completedCount: number }>;

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

function ProgressBadge({ completed, completedCount }: { completed: boolean; completedCount: number }) {
  if (!completed) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {completedCount > 1 ? `${completedCount}x` : "\u2713"}
      </Text>
    </View>
  );
}

function NewBadge() {
  return (
    <View style={styles.newBadge}>
      <Text style={styles.newBadgeText}>BARU</Text>
    </View>
  );
}

function LockOverlay({ unlockRemaining }: { unlockRemaining?: number }) {
  return (
    <View style={styles.lockOverlay}>
      <Text style={styles.lockIcon}>🔒</Text>
      {unlockRemaining != null && unlockRemaining > 0 && (
        <Text style={styles.lockText}>Baca {unlockRemaining} lagi</Text>
      )}
    </View>
  );
}

function BookCard({
  book,
  onPress,
  cardWidth,
  progress,
  locked,
  isNew,
}: {
  book: Book;
  onPress: () => void;
  cardWidth: number;
  progress?: { lastPage: number; completed: boolean; completedCount: number };
  locked?: { isLocked: boolean; remaining: number };
  isNew?: boolean;
}) {
  const cover = coverImages[book.id];
  const pct = progress ? Math.round((progress.lastPage / Math.max(book.pageCount - 1, 1)) * 100) : 0;

  return (
    <Pressable style={[styles.card, { width: cardWidth }]} onPress={onPress}>
      <View>
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
        {locked?.isLocked && <LockOverlay unlockRemaining={locked.remaining} />}
        {isNew && <NewBadge />}
        {progress && !locked?.isLocked && <ProgressBadge completed={progress.completed} completedCount={progress.completedCount} />}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {book.title}
      </Text>
      <View style={styles.cardBottom}>
        <Text style={styles.cardMeta}>{book.pageCount} halaman</Text>
        {progress && !progress.completed && pct > 0 && (
          <View style={styles.progressBarOuter}>
            <View style={[styles.progressBarInner, { width: `${pct}%` }]} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ArticleCard({
  article,
  onPress,
  cardWidth,
  progress,
  locked,
  isNew,
}: {
  article: Article;
  onPress: () => void;
  cardWidth: number;
  progress?: { completed: boolean; completedCount: number };
  locked?: { isLocked: boolean; remaining: number };
  isNew?: boolean;
}) {
  const initials = article.title
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("");

  return (
    <Pressable style={[styles.card, { width: cardWidth }]} onPress={onPress}>
      <View>
        <View style={[styles.articleCover, { width: cardWidth, height: cardWidth * 1.3 }]}>
          <Text style={styles.articleInitials}>{initials}</Text>
        </View>
        {locked?.isLocked && <LockOverlay unlockRemaining={locked.remaining} />}
        {isNew && <NewBadge />}
        {progress && !locked?.isLocked && <ProgressBadge completed={progress.completed} completedCount={progress.completedCount} />}
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

function FavoritSection({
  favorites,
  router,
}: {
  favorites: FavoriteItem[];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View style={styles.favSection}>
      <Text style={styles.favTitle}>Favorit</Text>
      {favorites.length === 0 ? (
        <Text style={styles.favEmpty}>Belum ada favorit. Tekan bintang saat membaca!</Text>
      ) : (
        <View style={styles.favList}>
          {favorites.map((f) => (
            <Pressable
              key={`${f.kind}-${f.id}`}
              style={styles.favItem}
              onPress={() => {
                if (f.kind === "book") router.push(`/read/${f.id}`);
                else router.push(`/article/${f.id}`);
              }}
            >
              <Text style={styles.favBadge}>{f.kind === "book" ? "BUKU" : "ARTIKEL"}</Text>
              <Text style={styles.favItemTitle} numberOfLines={1}>{f.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const child = getSelectedChild();
  const [tab, setTab] = useState<Tab>("buku");
  const [progress, setProgress] = useState<ProgressMap>({});
  const [lockedSet, setLockedSet] = useState<Set<string>>(new Set());
  const [newContentIds, setNewContentIds] = useState<Set<string>>(new Set());
  const [unlockRemainingMap, setUnlockRemainingMap] = useState<Record<string, number>>({});
  const unsyncedCount = useUnsyncedCount(child?.id ?? null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  const allBooks = useMemo(() => getAllBooks(), []);
  const [articles, setArticles] = useState<Article[]>(() => getAllArticles());

  useEffect(() => {
    fetchAllArticles().then(setArticles).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!child) return;
    const p = await getAllReadingProgress(child.id);
    setProgress(p);

    const totalContent = allBooks.length + articles.length;
    const locked = await getLockedBooks(child.id, totalContent);
    setLockedSet(locked);

    // Get unlock progress for each locked item
    const remaining: Record<string, number> = {};
    for (const id of locked) {
      remaining[id] = await getUnlockProgress(child.id, id);
    }
    setUnlockRemainingMap(remaining);

    // New content detection
    const allIds = [...allBooks.map(b => b.id), ...articles.map(a => a.slug)];
    const newIds = await getNewContentIds(child.id, allIds);
    setNewContentIds(new Set(newIds));

    // Favorit (bookmarks)
    try {
      const rows = await listBookmarks(child.id);
      const items: FavoriteItem[] = [];
      for (const r of rows as BookmarkRow[]) {
        if (r.content_type === "book") {
          const b = allBooks.find((bk) => bk.id === r.content_slug);
          if (b) items.push({ kind: "book", id: b.id, title: b.title, updatedAt: r.updated_at });
        } else {
          const a = articles.find((ar) => ar.slug === r.content_slug);
          if (a) items.push({ kind: "article", id: a.id, title: a.title, updatedAt: r.updated_at });
        }
      }
      items.sort((x, y) => y.updatedAt - x.updatedAt);
      setFavorites(items);
    } catch {
      setFavorites([]);
    }
  }, [child?.id, allBooks, articles]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Sort books and articles
  const books = useMemo(() =>
    sortForDisplay(allBooks, progress, lockedSet),
    [allBooks, progress, lockedSet]
  );

  const sortedArticles = useMemo(() => {
    const articleProgress: Record<string, { lastPage: number; completed: boolean; completedCount: number }> = {};
    for (const a of articles) {
      const p = progress[a.slug];
      if (p) articleProgress[a.slug] = p;
    }
    // Map articles to sortable format, sort, then map back
    const mapped = articles.map(a => ({ id: a.slug, title: a.title, coverPath: null, pageCount: 0, hasAudio: false, _article: a }));
    const sorted = sortForDisplay(mapped, articleProgress, lockedSet);
    return sorted.map((s: any) => s._article as Article);
  }, [articles, progress, lockedSet]);

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
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.replace("/")} style={styles.backBtn}>
          <Text style={styles.backText}>Ganti</Text>
        </Pressable>
        <Text style={styles.greeting} numberOfLines={1}>Halo, {child.name}!</Text>
        {unsyncedCount > 0 && (
          <Pressable
            testID="sync-pending-badge"
            onPress={() => child && syncAll([child.id]).catch(() => {})}
            style={styles.syncBadge}
          >
            <Text style={styles.syncBadgeText}>⟳ {unsyncedCount}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.push("/leaderboard")} style={styles.lbBtn}>
          <Text style={styles.lbText}>Peringkat</Text>
        </Pressable>
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
        <Pressable
          style={[styles.tab, tab === "permainan" && styles.tabActive]}
          onPress={() => router.push("/games")}
        >
          <Text style={[styles.tabText, tab === "permainan" && styles.tabTextActive]}>
            Permainan
          </Text>
        </Pressable>
      </View>

      {tab === "buku" ? (
        <FlatList
          data={books}
          numColumns={numColumns}
          key={`buku-${numColumns}`}
          contentContainerStyle={[styles.list, { paddingHorizontal: padding, paddingBottom: insets.bottom + 16 }]}
          columnWrapperStyle={{ gap, paddingHorizontal: 0 }}
          ListHeaderComponent={<FavoritSection favorites={favorites} router={router} />}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          renderItem={({ item }) => (
            <BookCard
              book={item}
              cardWidth={cardWidth}
              progress={progress[item.id]}
              locked={lockedSet.has(item.id) ? { isLocked: true, remaining: unlockRemainingMap[item.id] ?? 0 } : undefined}
              isNew={newContentIds.has(item.id)}
              onPress={() => {
                if (lockedSet.has(item.id)) {
                  const r = unlockRemainingMap[item.id] ?? 0;
                  Alert.alert("Terkunci!", `Baca ${r} buku/artikel lain dulu untuk membuka.`);
                  return;
                }
                markContentSeen(child!.id, item.id).catch(() => {});
                router.push(`/read/${item.id}`);
              }}
            />
          )}
          keyExtractor={(item) => item.id}
        />
      ) : (
        <FlatList
          data={sortedArticles}
          numColumns={numColumns}
          key={`artikel-${numColumns}`}
          contentContainerStyle={[styles.list, { paddingHorizontal: padding, paddingBottom: insets.bottom + 16 }]}
          columnWrapperStyle={{ gap, paddingHorizontal: 0 }}
          ListHeaderComponent={<FavoritSection favorites={favorites} router={router} />}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          renderItem={({ item }) => (
            <ArticleCard
              article={item}
              cardWidth={cardWidth}
              progress={progress[item.slug]}
              locked={lockedSet.has(item.slug) ? { isLocked: true, remaining: unlockRemainingMap[item.slug] ?? 0 } : undefined}
              isNew={newContentIds.has(item.slug)}
              onPress={() => {
                if (lockedSet.has(item.slug)) {
                  const r = unlockRemainingMap[item.slug] ?? 0;
                  Alert.alert("Terkunci!", `Baca ${r} buku/artikel lain dulu untuk membuka.`);
                  return;
                }
                markContentSeen(child!.id, item.slug).catch(() => {});
                router.push(`/article/${item.id}`);
              }}
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
    paddingBottom: 12,
    backgroundColor: colors.primary,
  },
  backBtn: {
    marginRight: 12,
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
  lbBtn: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
  },
  syncBadge: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
  },
  syncBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  lbText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  favSection: {
    paddingBottom: 16,
    marginHorizontal: -4,
  },
  favTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  favEmpty: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    paddingHorizontal: 4,
  },
  favList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  favItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: "100%",
  },
  favBadge: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFF",
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  favItemTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
    flexShrink: 1,
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
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: colors.secondary,
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  cardBottom: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  progressBarOuter: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  progressBarInner: {
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  lockIcon: {
    fontSize: 32,
  },
  lockText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  newBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 16,
    borderBottomRightRadius: 10,
  },
  newBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "bold",
  },
});
