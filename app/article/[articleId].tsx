import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { getArticle, fetchArticle } from "../../src/lib/articles";
import { speakPage, stopSpeaking } from "../../src/lib/speech";
import { colors } from "../../src/theme";
import type { Article } from "../../src/types";

export default function ArticleScreen() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const [article, setArticle] = useState<Article | null>(() => getArticle(articleId));
  const [loading, setLoading] = useState(true);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeParagraph, setActiveParagraph] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchArticle(articleId).then((a) => {
      if (a) setArticle(a);
      setLoading(false);
    });
  }, [articleId]);

  const paragraphs = useMemo(() => {
    if (!article) return [];
    return article.content
      .split("\n\n")
      .map((p) => p.trim())
      .filter(Boolean);
  }, [article]);

  const handleScroll = useCallback(
    (e: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const isEnd =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 60;
      if (isEnd && !reachedEnd) setReachedEnd(true);
    },
    [reachedEnd]
  );

  const handleReadToMe = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      setActiveParagraph(null);
      return;
    }

    setIsSpeaking(true);
    setActiveParagraph(0);

    let idx = 0;
    const readNext = () => {
      if (idx >= paragraphs.length) {
        setIsSpeaking(false);
        setActiveParagraph(null);
        setReachedEnd(true);
        return;
      }
      setActiveParagraph(idx);
      speakPage(
        paragraphs[idx],
        () => {},
        () => {
          idx++;
          readNext();
        }
      );
    };
    readNext();
  }, [isSpeaking, paragraphs]);

  const handleStartQuiz = useCallback(() => {
    stopSpeaking();
    router.push(`/quiz/${articleId}`);
  }, [articleId]);

  if (loading && !article) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.textPrimary }}>Memuat artikel...</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textPrimary }}>Artikel tidak ditemukan</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            stopSpeaking();
            router.back();
          }}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>Kembali</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {article.title}
        </Text>
      </View>

      {/* Category badges */}
      <View style={styles.categoryRow}>
        {article.category.map((cat) => (
          <View key={cat} style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{cat}</Text>
          </View>
        ))}
      </View>

      {/* Article content */}
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={[
          styles.contentInner,
          isTablet && styles.contentInnerTablet,
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        {paragraphs.map((para, i) => (
          <Text
            key={i}
            style={[
              styles.paragraph,
              isTablet && styles.paragraphTablet,
              activeParagraph === i && styles.paragraphActive,
            ]}
          >
            {para}
          </Text>
        ))}

        {/* Spacer for bottom controls */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.readToMeBtn, isSpeaking && styles.readToMeBtnActive]}
          onPress={handleReadToMe}
        >
          <Text style={styles.btnIcon}>{isSpeaking ? "\u23F9" : "\uD83D\uDD0A"}</Text>
          <Text style={styles.readToMeBtnText}>
            {isSpeaking ? "Berhenti" : "Bacakan"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.quizBtn, !reachedEnd && styles.quizBtnDisabled]}
          onPress={handleStartQuiz}
          disabled={!reachedEnd}
        >
          <Text style={styles.btnIcon}>{"\uD83D\uDCDD"}</Text>
          <Text style={[styles.quizBtnText, !reachedEnd && { opacity: 0.5 }]}>
            Mulai Kuis
          </Text>
        </Pressable>
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
    backgroundColor: "rgba(255,255,255,0.2)",
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
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.bgPrimary,
  },
  categoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: "#FFF",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    paddingTop: 12,
  },
  contentInnerTablet: {
    paddingHorizontal: 64,
  },
  paragraph: {
    fontSize: 17,
    lineHeight: 28,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  paragraphTablet: {
    fontSize: 19,
    lineHeight: 32,
  },
  paragraphActive: {
    backgroundColor: "#E8F4FD",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: -8,
  },
  bottomBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
    backgroundColor: colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  readToMeBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.btnReadToMe,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  readToMeBtnActive: {
    backgroundColor: colors.btnReadToMeActive,
  },
  readToMeBtnText: {
    fontSize: 15,
    fontWeight: "bold",
    color: colors.textOnAccent,
  },
  quizBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  quizBtnDisabled: {
    opacity: 0.4,
  },
  quizBtnText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FFF",
  },
  btnIcon: {
    fontSize: 18,
  },
});
