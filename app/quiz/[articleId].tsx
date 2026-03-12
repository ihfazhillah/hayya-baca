import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { getArticle, calculateQuizStars } from "../../src/lib/articles";
import { getSelectedChild } from "../../src/lib/session";
import { addReward, saveReadingProgress } from "../../src/lib/rewards";
import { colors } from "../../src/theme";
import type { ArticleQuizQuestion } from "../../src/types";

type AnswerState = "unanswered" | "correct" | "wrong";

function QuestionCard({
  question,
  index,
  total,
  onAnswer,
}: {
  question: ArticleQuizQuestion;
  index: number;
  total: number;
  onAnswer: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [state, setState] = useState<AnswerState>("unanswered");

  const isMC = question.type === "multiple_choice";
  const options = isMC
    ? question.options!
    : ["Benar", "Salah"];

  const correctIndex = isMC
    ? (question.answer as number)
    : question.answer === true
      ? 0
      : 1;

  const handleSubmit = () => {
    if (selected === null) return;
    const isCorrect = selected === correctIndex;
    setState(isCorrect ? "correct" : "wrong");
    onAnswer(isCorrect);
  };

  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionNum}>
        Soal {index + 1} dari {total}
      </Text>
      <Text style={styles.questionText}>{question.question}</Text>

      <View style={styles.optionsContainer}>
        {options.map((opt, i) => {
          const isSelected = selected === i;
          const showResult = state !== "unanswered";
          const isCorrectOption = i === correctIndex;

          let optStyle = styles.option;
          if (showResult && isCorrectOption) optStyle = styles.optionCorrect;
          else if (showResult && isSelected && !isCorrectOption) optStyle = styles.optionWrong;
          else if (isSelected) optStyle = styles.optionSelected;

          return (
            <Pressable
              key={i}
              style={[styles.optionBase, optStyle]}
              onPress={() => {
                if (state === "unanswered") setSelected(i);
              }}
              disabled={state !== "unanswered"}
            >
              <Text
                style={[
                  styles.optionText,
                  showResult && isCorrectOption && styles.optionTextCorrect,
                  showResult && isSelected && !isCorrectOption && styles.optionTextWrong,
                  isSelected && state === "unanswered" && styles.optionTextSelected,
                ]}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {state === "unanswered" ? (
        <Pressable
          style={[styles.submitBtn, selected === null && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={selected === null}
        >
          <Text style={styles.submitBtnText}>Jawab</Text>
        </Pressable>
      ) : (
        <View style={styles.explanationBox}>
          <Text style={styles.resultLabel}>
            {state === "correct" ? "Benar!" : "Belum tepat"}
          </Text>
          <Text style={styles.explanationText}>{question.explanation}</Text>
        </View>
      )}
    </View>
  );
}

export default function QuizScreen() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const article = useMemo(() => getArticle(articleId), [articleId]);
  const child = getSelectedChild();

  const [currentQ, setCurrentQ] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);

  if (!article) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textPrimary }}>Artikel tidak ditemukan</Text>
      </View>
    );
  }

  const quiz = article.quiz;
  const totalQ = quiz.length;

  const handleAnswer = (correct: boolean) => {
    if (correct) setCorrectCount((c) => c + 1);
    setAnswered(true);
  };

  const handleNext = async () => {
    if (currentQ < totalQ - 1) {
      setCurrentQ((q) => q + 1);
      setAnswered(false);
    } else {
      // Quiz finished
      const finalCorrect = correctCount;
      const stars = calculateQuizStars(finalCorrect, totalQ);

      if (child) {
        await addReward(child.id, "coin", 1, `Selesai baca: ${article.title}`);
        if (stars > 0) {
          await addReward(child.id, "star", stars, `Kuis: ${article.title}`);
        }
        await saveReadingProgress(child.id, `article-${articleId}`, 0, true);
      }

      router.replace({
        pathname: "/celebrate",
        params: {
          coins: "1",
          stars: String(stars),
          bookTitle: article.title,
          quizScore: `${finalCorrect}/${totalQ}`,
        },
      });
    }
  };

  // Progress dots
  const dots = Array.from({ length: totalQ }, (_, i) => (
    <View
      key={i}
      style={[styles.dot, i === currentQ && styles.dotActive, i < currentQ && styles.dotDone]}
    />
  ));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>Kembali</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Kuis
        </Text>
      </View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>{dots}</View>

      {/* Question */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { paddingHorizontal: 64 },
        ]}
      >
        <QuestionCard
          key={currentQ}
          question={quiz[currentQ]}
          index={currentQ}
          total={totalQ}
          onAnswer={handleAnswer}
        />

        {answered && (
          <Pressable style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>
              {currentQ < totalQ - 1 ? "Soal Berikutnya \u25B6" : "Selesai \u2713"}
            </Text>
          </Pressable>
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
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  dotDone: {
    backgroundColor: colors.secondary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  questionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 24,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  questionNum: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
    marginBottom: 8,
  },
  questionText: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 28,
    marginBottom: 20,
  },
  optionsContainer: {
    gap: 10,
  },
  optionBase: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 2,
  },
  option: {
    borderColor: colors.border,
    backgroundColor: colors.bgPrimary,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: "#F0EDFF",
  },
  optionCorrect: {
    borderColor: colors.secondary,
    backgroundColor: "#E0FFF5",
  },
  optionWrong: {
    borderColor: colors.accentRed,
    backgroundColor: "#FFE8E8",
  },
  optionText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  optionTextCorrect: {
    color: colors.secondary,
    fontWeight: "600",
  },
  optionTextWrong: {
    color: colors.accentRed,
    fontWeight: "600",
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
  },
  explanationBox: {
    marginTop: 20,
    backgroundColor: "#F8F7FF",
    borderRadius: 12,
    padding: 16,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.secondary,
    marginBottom: 6,
  },
  explanationText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  nextBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
  },
});
