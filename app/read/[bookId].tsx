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
  calculateStars,
  calculateCoins,
} from "../../src/lib/speech";
import { addReward, saveReadingProgress } from "../../src/lib/rewards";
import { useSpeechRecognition } from "../../src/hooks/useSpeechRecognition";
import { colors } from "../../src/theme";

type WordStatus = 'idle' | 'target' | 'success' | 'skipped' | 'readToMe';

function WordView({
  word,
  status,
  onPress,
  fontSize,
}: {
  word: string;
  status: WordStatus;
  onPress: () => void;
  fontSize: number;
}) {
  return (
    <Pressable onPress={onPress} style={styles.wordPressable}>
      <Text
        style={[
          styles.word,
          { fontSize, lineHeight: fontSize * 2.2 },
          status === 'target' && styles.wordTarget,
          status === 'success' && styles.wordSuccess,
          status === 'skipped' && styles.wordSkipped,
          status === 'readToMe' && styles.wordReadToMe,
        ]}
      >
        {word}
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
  const [readToMeWord, setReadToMeWord] = useState<number | null>(null);
  const [isReadingToMe, setIsReadingToMe] = useState(false);
  const [pageStars, setPageStars] = useState<Record<number, number>>({});
  const [pageComplete, setPageComplete] = useState(false);
  const totalStarsRef = useRef(0);

  const page = book ? book.pages[currentPage] : null;
  const words = page ? page.text.split(/\s+/).filter(Boolean) : [];

  const {
    isListening,
    currentWordIndex,
    attempts,
    readWords,
    start: startListening,
    stop: stopListening,
    reset: resetSpeech,
  } = useSpeechRecognition({
    words,
    onWordRead: (_index, _success) => {},
    onAllDone: () => {
      setPageComplete(true);
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
        <Text style={{ color: colors.textPrimary }}>Buku tidak ditemukan</Text>
      </View>
    );
  }

  const isLastPage = currentPage === book.pages.length - 1;
  const isFirstPage = currentPage === 0;
  const currentStars = pageStars[currentPage] ?? 0;

  // Determine word status for rendering
  const getWordStatus = (index: number): WordStatus => {
    if (isReadingToMe && readToMeWord === index) return 'readToMe';
    if (readWords.has(index)) return readWords.get(index) ? 'success' : 'skipped';
    if (isListening && index === currentWordIndex) return 'target';
    return 'idle';
  };

  const handleWordPress = useCallback(
    (index: number) => {
      if (isReadingToMe) return;
      speakWord(words[index]);
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

    // Stop mic if listening
    if (isListening) stopListening();

    setIsReadingToMe(true);
    setReadToMeWord(null);

    if (!page) return;
    speakPage(
      page.text,
      (wordIndex) => setReadToMeWord(wordIndex),
      () => {
        setIsReadingToMe(false);
        setReadToMeWord(null);
        setPageComplete(true);
      }
    );
  }, [isReadingToMe, isListening, page?.text, words, stopListening]);

  const finishPage = useCallback(() => {
    // Count successful reads for star calculation
    let successCount = 0;
    readWords.forEach((success) => { if (success) successCount++; });
    // Also count if page was completed via read-to-me (all words)
    const totalRead = pageComplete ? Math.max(successCount, words.length) : successCount;
    const stars = calculateStars(totalRead, words.length);
    if (stars > 0) {
      setPageStars((prev) => ({ ...prev, [currentPage]: stars }));
      totalStarsRef.current += stars;
    }
  }, [readWords, words.length, currentPage, pageComplete]);

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
      resetSpeech();
      setPageComplete(false);
    } else {
      // Book finished!
      const coins = child ? calculateCoins(book.pages.length) : 0;
      try {
        if (child) {
          await addReward(child.id, "coin", coins, `Selesai baca: ${book.title}`);
          if (totalStarsRef.current > 0) {
            await addReward(child.id, "star", totalStarsRef.current, `Bintang dari: ${book.title}`);
          }
          await saveReadingProgress(child.id, book.id, book.pages.length - 1, true);
        }
      } catch {}

      if (child) {
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
    resetSpeech();
    setPageComplete(false);
  };

  // Can only go next if page has been read (mic or read-to-me)
  const canGoNext = pageComplete;

  return (
    <View style={styles.container}>
      {/* Header */}
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

      {/* Stars + attempts indicator */}
      <View style={styles.statusRow}>
        {currentStars > 0 && (
          <View style={styles.starsRow}>
            {Array.from({ length: currentStars }).map((_, i) => (
              <Text key={i} style={styles.star}>*</Text>
            ))}
          </View>
        )}
        {isListening && attempts > 0 && (
          <Text style={styles.attemptsText}>
            Coba lagi ({attempts}/4)
          </Text>
        )}
      </View>

      {/* Content */}
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
              status={getWordStatus(i)}
              onPress={() => handleWordPress(i)}
              fontSize={fontSize}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom controls */}
      <View style={styles.navContainer}>
        {/* Action buttons — primary actions */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.micBtn, isListening && styles.micBtnActive]}
            onPress={handleMicToggle}
          >
            <Text style={styles.actionIcon}>{isListening ? "\u23F9" : "\uD83C\uDF99"}</Text>
            <Text style={styles.micBtnText}>
              {isListening ? "Berhenti" : "Saya Baca"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.readToMeBtn, isReadingToMe && styles.readToMeBtnActive]}
            onPress={handleReadToMe}
          >
            <Text style={styles.actionIcon}>{isReadingToMe ? "\u23F9" : "\uD83D\uDD0A"}</Text>
            <Text style={styles.readToMeBtnText}>
              {isReadingToMe ? "Berhenti" : "Dengarkan"}
            </Text>
          </Pressable>
        </View>

        {/* Page navigation */}
        <View style={styles.pageNavRow}>
          <Pressable
            style={[styles.navBtn, isFirstPage && styles.navBtnDisabled]}
            onPress={goPrev}
            disabled={isFirstPage}
          >
            <Text style={[styles.navBtnText, isFirstPage && styles.navBtnTextDisabled]}>
              {"\u25C0"} Sebelumnya
            </Text>
          </Pressable>

          <Pressable
            style={[styles.navBtnPrimary, !canGoNext && styles.navBtnDisabled]}
            onPress={goNext}
            disabled={!canGoNext}
          >
            <Text style={[styles.navBtnPrimaryText, !canGoNext && { opacity: 0.5 }]}>
              {isLastPage ? "Selesai \u2713" : "Lanjut \u25B6"}
            </Text>
          </Pressable>
        </View>
      </View>
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: colors.primary,
  },
  headerBtn: {
    padding: 8,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  headerBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  starsRow: {
    flexDirection: "row",
    gap: 4,
  },
  star: {
    fontSize: 24,
    color: colors.star,
  },
  attemptsText: {
    fontSize: 13,
    color: colors.accentOrange,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 28,
    paddingTop: 36,
    paddingBottom: 40,
  },
  contentInnerTablet: {
    paddingHorizontal: 64,
    paddingTop: 52,
  },
  textContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  wordPressable: {
    marginVertical: 2,
  },
  word: {
    color: colors.textPrimary,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  wordTarget: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    color: colors.textOnAccent,
    overflow: 'hidden',
  },
  wordSuccess: {
    backgroundColor: colors.wordRead,
    borderRadius: 6,
    color: colors.wordReadText,
    overflow: 'hidden',
  },
  wordSkipped: {
    backgroundColor: '#FFEAA7',
    borderRadius: 6,
    color: '#B7950B',
    overflow: 'hidden',
  },
  wordReadToMe: {
    backgroundColor: colors.wordActive,
    borderRadius: 6,
    color: colors.wordActiveText,
    overflow: 'hidden',
  },
  navContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
    backgroundColor: colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  micBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.btnMic,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: colors.btnMicActive,
  },
  micBtnText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFF",
  },
  readToMeBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.btnReadToMe,
    alignItems: "center",
    justifyContent: "center",
  },
  readToMeBtnActive: {
    backgroundColor: colors.btnReadToMeActive,
  },
  readToMeBtnText: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.textOnAccent,
  },
  pageNavRow: {
    flexDirection: "row",
    gap: 12,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.btnNav,
    alignItems: "center",
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.btnNavText,
  },
  navBtnTextDisabled: {
    color: colors.disabled,
  },
  navBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  navBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFF",
  },
});
