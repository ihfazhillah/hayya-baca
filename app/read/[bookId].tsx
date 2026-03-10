import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState, useCallback, useRef } from "react";
import { getBookContent } from "../../src/lib/books";
import { getSelectedChild } from "../../src/lib/session";
import {
  speakWord,
  speakPage,
  stopSpeaking,
  matchWords,
  calculateStars,
  calculateCoins,
} from "../../src/lib/speech";
import { addReward, saveReadingProgress } from "../../src/lib/rewards";
import { useSpeechRecognition } from "../../src/hooks/useSpeechRecognition";

function WordView({
  word,
  isHighlighted,
  isReadToMe,
  onPress,
  fontSize,
}: {
  word: string;
  isHighlighted: boolean;
  isReadToMe: boolean;
  onPress: () => void;
  fontSize: number;
}) {
  return (
    <Pressable onPress={onPress}>
      <Text
        style={[
          styles.word,
          { fontSize, lineHeight: fontSize * 1.8 },
          isHighlighted && styles.wordHighlighted,
          isReadToMe && styles.wordReadToMe,
        ]}
      >
        {word}{" "}
      </Text>
    </Pressable>
  );
}

export default function ReadScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const child = getSelectedChild();

  const book = useMemo(() => getBookContent(bookId), [bookId]);
  const [currentPage, setCurrentPage] = useState(0);
  const [highlightedWords, setHighlightedWords] = useState<Set<number>>(new Set());
  const [readToMeWord, setReadToMeWord] = useState<number | null>(null);
  const [isReadingToMe, setIsReadingToMe] = useState(false);
  const [pageStars, setPageStars] = useState<Record<number, number>>({});
  const totalStarsRef = useRef(0);

  const page = book ? book.pages[currentPage] : null;
  const words = page ? page.text.split(/\s+/).filter(Boolean) : [];

  const { isListening, start: startListening, stop: stopListening, reset: resetSpeech } =
    useSpeechRecognition({
      expectedWords: words,
      onMatch: (matched) => {
        setHighlightedWords((prev) => {
          const next = new Set(prev);
          matched.forEach((i) => next.add(i));
          return next;
        });
      },
    });

  const isTablet = width >= 600;
  const age = child?.age;
  const fontSize = age
    ? age <= 5
      ? isTablet ? 36 : 28
      : age <= 8
        ? isTablet ? 30 : 24
        : isTablet ? 26 : 20
    : isTablet ? 30 : 24;

  if (!book) {
    return (
      <View style={styles.container}>
        <Text>Buku tidak ditemukan</Text>
      </View>
    );
  }

  const isLastPage = currentPage === book.pages.length - 1;
  const isFirstPage = currentPage === 0;
  const currentStars = pageStars[currentPage] ?? 0;

  const handleWordPress = useCallback(
    (index: number) => {
      if (isReadingToMe) return;
      speakWord(words[index]);
      setHighlightedWords((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    },
    [words, isReadingToMe]
  );

  const handleReadToMe = useCallback(() => {
    if (isReadingToMe) {
      stopSpeaking();
      setIsReadingToMe(false);
      setReadToMeWord(null);
      return;
    }

    setIsReadingToMe(true);
    setReadToMeWord(null);

    if (!page) return;
    speakPage(
      page.text,
      (wordIndex) => setReadToMeWord(wordIndex),
      () => {
        setIsReadingToMe(false);
        setReadToMeWord(null);
        setHighlightedWords(new Set(words.map((_, i) => i)));
      }
    );
  }, [isReadingToMe, page?.text, words]);

  const finishPage = useCallback(() => {
    const stars = calculateStars(highlightedWords.size, words.length);
    if (stars > 0) {
      setPageStars((prev) => ({ ...prev, [currentPage]: stars }));
      totalStarsRef.current += stars;
    }
  }, [highlightedWords.size, words.length, currentPage]);

  const handleMicToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      stopSpeaking();
      setIsReadingToMe(false);
      setReadToMeWord(null);
      startListening();
    }
  }, [isListening, stopListening, startListening]);

  const goNext = async () => {
    stopSpeaking();
    stopListening();
    setIsReadingToMe(false);
    setReadToMeWord(null);
    finishPage();

    if (!isLastPage) {
      setCurrentPage((p) => p + 1);
      setHighlightedWords(new Set());
    } else {
      // Book finished!
      if (child) {
        const coins = calculateCoins(book.pages.length);
        await addReward(child.id, "coin", coins, `Selesai baca: ${book.title}`);
        if (totalStarsRef.current > 0) {
          await addReward(child.id, "star", totalStarsRef.current, `Bintang dari: ${book.title}`);
        }
        await saveReadingProgress(child.id, book.id, book.pages.length - 1, true);

        router.replace({
          pathname: "/celebrate",
          params: { coins: String(coins), stars: String(totalStarsRef.current), bookTitle: book.title },
        });
      } else {
        router.back();
      }
    }
  };

  const goPrev = () => {
    if (isFirstPage) return;
    stopSpeaking();
    stopListening();
    setIsReadingToMe(false);
    setReadToMeWord(null);
    finishPage();
    setCurrentPage((p) => p - 1);
    setHighlightedWords(new Set());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            stopSpeaking();
            stopListening();
            router.back();
          }}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>Kembali</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {book.title}
        </Text>
        <Text style={styles.pageNum}>
          {currentPage + 1}/{book.pages.length}
        </Text>
      </View>

      {currentStars > 0 && (
        <View style={styles.starsRow}>
          {Array.from({ length: currentStars }).map((_, i) => (
            <Text key={i} style={styles.star}>
              *
            </Text>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentInner,
          isTablet && styles.contentInnerTablet,
        ]}
      >
        <View style={styles.textContainer}>
          {words.map((word, i) => (
            <WordView
              key={`${currentPage}-${i}`}
              word={word}
              isHighlighted={highlightedWords.has(i)}
              isReadToMe={readToMeWord === i}
              onPress={() => handleWordPress(i)}
              fontSize={fontSize}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.navigation}>
        <Pressable
          style={[styles.navBtn, isFirstPage && styles.navBtnDisabled]}
          onPress={goPrev}
          disabled={isFirstPage}
        >
          <Text style={[styles.navBtnText, isFirstPage && styles.navBtnTextDisabled]}>
            Sebelumnya
          </Text>
        </Pressable>

        <Pressable
          style={[styles.micBtn, isListening && styles.micBtnActive]}
          onPress={handleMicToggle}
        >
          <Text style={styles.micBtnText}>
            {isListening ? "Berhenti" : "Baca"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.readToMeBtn, isReadingToMe && styles.readToMeBtnActive]}
          onPress={handleReadToMe}
        >
          <Text style={styles.readToMeBtnText}>
            {isReadingToMe ? "Stop" : "Bacakan"}
          </Text>
        </Pressable>

        <Pressable style={styles.navBtnPrimary} onPress={goNext}>
          <Text style={styles.navBtnPrimaryText}>
            {isLastPage ? "Selesai" : "Lanjut"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDF7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#1A73E8",
  },
  headerBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerBtnText: {
    color: "#FFF",
    fontSize: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
  },
  pageNum: {
    color: "#FFF",
    fontSize: 14,
    opacity: 0.8,
    marginLeft: 8,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 4,
  },
  star: {
    fontSize: 24,
    color: "#FFB300",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 24,
    paddingTop: 32,
  },
  contentInnerTablet: {
    paddingHorizontal: 60,
    paddingTop: 48,
  },
  textContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  word: {
    color: "#333",
  },
  wordHighlighted: {
    backgroundColor: "#C8E6C9",
    borderRadius: 4,
    color: "#2E7D32",
  },
  wordReadToMe: {
    backgroundColor: "#BBDEFB",
    borderRadius: 4,
    color: "#1565C0",
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  navBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#E0E0E0",
    alignItems: "center",
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
  },
  navBtnTextDisabled: {
    color: "#999",
  },
  micBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  micBtnActive: {
    backgroundColor: "#F44336",
  },
  micBtnText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FFF",
  },
  readToMeBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FF9800",
    alignItems: "center",
  },
  readToMeBtnActive: {
    backgroundColor: "#F44336",
  },
  readToMeBtnText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FFF",
  },
  navBtnPrimary: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#1A73E8",
    alignItems: "center",
  },
  navBtnPrimaryText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FFF",
  },
});
