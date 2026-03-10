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
import { useMemo } from "react";
import { getAllBooks } from "../src/lib/books";
import { getSelectedChild } from "../src/lib/session";
import type { Book } from "../src/types";

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
    <Pressable style={[styles.bookCard, { width: cardWidth }]} onPress={onPress}>
      {cover ? (
        <Image
          source={cover}
          style={[styles.bookCover, { width: cardWidth, height: cardWidth * 1.3 }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.bookCoverPlaceholder, { width: cardWidth, height: cardWidth * 1.3 }]}>
          <Text style={styles.placeholderText}>{book.title.charAt(0)}</Text>
        </View>
      )}
      <Text style={styles.bookTitle} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={styles.bookPages}>{book.pageCount} halaman</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const child = getSelectedChild();
  const books = useMemo(() => getAllBooks(), []);

  const isTablet = width >= 600;
  const numColumns = isTablet ? 4 : 2;
  const gap = 16;
  const padding = 16;
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
        <Text style={styles.greeting}>Halo, {child.name}!</Text>
      </View>

      <FlatList
        data={books}
        numColumns={numColumns}
        key={numColumns}
        contentContainerStyle={[styles.list, { paddingHorizontal: padding }]}
        columnWrapperStyle={{ gap }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "#1A73E8",
  },
  backBtn: {
    marginRight: 16,
    padding: 8,
  },
  backText: {
    color: "#FFF",
    fontSize: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
  },
  list: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  bookCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bookCover: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  bookCoverPlaceholder: {
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 40,
    color: "#999",
    fontWeight: "bold",
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  bookPages: {
    fontSize: 12,
    color: "#888",
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 2,
  },
});
