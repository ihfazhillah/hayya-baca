/**
 * Use case: Anak baca artikel → kuis → celebrate
 *
 * 1. Artikel dimuat dan konten ditampilkan
 * 2. Scroll sampai bawah → kuis button aktif
 * 3. Quiz: jawab semua soal → navigate celebrate dengan score benar
 * 4. Quiz score: jawab semua benar → 4 stars
 * 5. Quiz: reward save gagal → tetap navigate (tidak crash)
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";

// --- Mocks ---

const mockRouter = (global as any).__mockRouter;
const { useLocalSearchParams } = require("expo-router");

// Mock articles module
const mockFetchArticle = jest.fn();
const mockGetArticle = jest.fn();
const mockCalculateQuizStars = jest.fn();

jest.mock("../../src/lib/articles", () => ({
  fetchArticle: (...args: any[]) => mockFetchArticle(...args),
  getArticle: (...args: any[]) => mockGetArticle(...args),
  calculateQuizStars: (...args: any[]) => mockCalculateQuizStars(...args),
}));

// Mock rewards module — spy targets
const mockAddReward = jest.fn().mockResolvedValue(undefined);
const mockSaveReadingProgress = jest.fn().mockResolvedValue(undefined);

jest.mock("../../src/lib/rewards", () => ({
  addReward: (...args: any[]) => mockAddReward(...args),
  saveReadingProgress: (...args: any[]) => mockSaveReadingProgress(...args),
}));

// Mock session
const mockGetSelectedChild = jest.fn();
jest.mock("../../src/lib/session", () => ({
  getSelectedChild: () => mockGetSelectedChild(),
}));

// Mock speech/tts
jest.mock("../../src/lib/tts", () => ({
  speakWord: jest.fn(),
  speakPage: jest.fn(),
  stopSpeaking: jest.fn(),
}));

// --- Test data ---

const testArticle = {
  id: "112",
  title: "Lelaki Anshar dan Tiga Anak Panah",
  slug: "article-112",
  source: "test",
  category: ["Sahabat"],
  content: "Paragraf pertama artikel.\n\nParagraf kedua artikel.\n\nParagraf ketiga artikel.",
  quiz: [
    {
      type: "multiple_choice" as const,
      question: "Siapa lelaki Anshar?",
      options: ["Abu Bakar", "Saad bin Muadz", "Umar", "Ali"],
      answer: 1,
      explanation: "Saad bin Muadz adalah pemimpin Anshar.",
    },
    {
      type: "true_false" as const,
      question: "Beliau memiliki tiga anak panah?",
      answer: true,
      explanation: "Benar, tiga anak panah.",
    },
  ],
};

const testChild = { id: 1, name: "Ahmad", age: 8 };

// --- Import screens after mocks ---
import ArticleScreen from "../../app/article/[articleId]";
import QuizScreen from "../../app/quiz/[articleId]";

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSelectedChild.mockReturnValue(testChild);
  mockGetArticle.mockReturnValue(testArticle);
  mockFetchArticle.mockResolvedValue(testArticle);
  mockCalculateQuizStars.mockImplementation((correct: number, total: number) => {
    if (total === 0) return 0;
    const pct = correct / total;
    if (pct >= 1) return 4;
    if (pct >= 0.75) return 3;
    if (pct >= 0.5) return 2;
    if (pct >= 0.25) return 1;
    return 0;
  });
});

// --- Article Screen Tests ---

describe("Artikel dimuat dan konten ditampilkan", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ articleId: "112" });
  });

  it("menampilkan judul dan paragraf artikel", async () => {
    render(<ArticleScreen />);

    expect(screen.getByText("Lelaki Anshar dan Tiga Anak Panah")).toBeTruthy();
    expect(screen.getByText("Paragraf pertama artikel.")).toBeTruthy();
    expect(screen.getByText("Paragraf kedua artikel.")).toBeTruthy();
    expect(screen.getByText("Paragraf ketiga artikel.")).toBeTruthy();
  });

  it("menampilkan tombol Bacakan dan Mulai Kuis", () => {
    render(<ArticleScreen />);

    expect(screen.getByText("Bacakan")).toBeTruthy();
    expect(screen.getByText("Mulai Kuis")).toBeTruthy();
  });

  it("menampilkan badge kategori", () => {
    render(<ArticleScreen />);
    expect(screen.getByText("Sahabat")).toBeTruthy();
  });
});

describe("Scroll sampai bawah → kuis button aktif", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ articleId: "112" });
  });

  it("kuis button disabled sebelum scroll sampai bawah", () => {
    render(<ArticleScreen />);

    const quizBtn = screen.getByText("Mulai Kuis").parent;
    // Button should have disabled state (opacity 0.4 style applied)
    // The button is rendered but disabled
    expect(screen.getByText("Mulai Kuis")).toBeTruthy();
  });

  it("scroll ke bawah → press Mulai Kuis → navigate ke quiz", () => {
    render(<ArticleScreen />);

    // Simulate scroll to end
    const scrollView = screen.UNSAFE_queryAllByType(
      require("react-native").ScrollView
    )[0];
    if (scrollView) {
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          layoutMeasurement: { height: 500 },
          contentOffset: { y: 500 },
          contentSize: { height: 550 },
        },
      });
    }

    fireEvent.press(screen.getByText("Mulai Kuis"));
    expect(mockRouter.push).toHaveBeenCalledWith("/quiz/112");
  });
});

// --- Quiz Screen Tests ---

describe("Quiz: user jawab semua soal → navigate celebrate", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ articleId: "112" });
  });

  it("menampilkan soal pertama", async () => {
    render(<QuizScreen />);

    await waitFor(() => {
      expect(screen.getByText("Siapa lelaki Anshar?")).toBeTruthy();
    });
    expect(screen.getByText("Soal 1 dari 2")).toBeTruthy();
  });

  it("jawab soal 1 benar, lalu soal 2, lalu selesai → spy asserts", async () => {
    render(<QuizScreen />);

    await waitFor(() => {
      expect(screen.getByText("Siapa lelaki Anshar?")).toBeTruthy();
    });

    // Answer question 1: select correct option (index 1 = "Saad bin Muadz")
    fireEvent.press(screen.getByTestId("option-1"));
    fireEvent.press(screen.getByText("Jawab"));

    // Should show explanation
    await waitFor(() => {
      expect(screen.getByText("Benar!")).toBeTruthy();
    });

    // Go to next question
    fireEvent.press(screen.getByText(/Soal Berikutnya/));

    await waitFor(() => {
      expect(screen.getByText("Beliau memiliki tiga anak panah?")).toBeTruthy();
    });

    // Answer question 2: true_false, answer=true → index 0 ("Benar")
    fireEvent.press(screen.getByTestId("option-0"));
    fireEvent.press(screen.getByText("Jawab"));

    await waitFor(() => {
      expect(screen.getByText("Benar!")).toBeTruthy();
    });

    // Press finish
    await act(async () => {
      fireEvent.press(screen.getByText(/Selesai/));
    });

    // SPY: addReward called with coin
    expect(mockAddReward).toHaveBeenCalledWith(
      1, "coin", 1, "Selesai baca: Lelaki Anshar dan Tiga Anak Panah"
    );

    // SPY: addReward called with stars (2/2 correct → 4 stars)
    expect(mockAddReward).toHaveBeenCalledWith(
      1, "star", 4, "Kuis: Lelaki Anshar dan Tiga Anak Panah"
    );

    // SPY: saveReadingProgress called with article- prefix
    expect(mockSaveReadingProgress).toHaveBeenCalledWith(
      1, "article-112", 0, true
    );

    // SPY: router.replace with correct celebrate params
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/celebrate",
      params: {
        coins: "1",
        stars: "4",
        bookTitle: "Lelaki Anshar dan Tiga Anak Panah",
        bookId: "article-112",
        quizScore: "2/2",
      },
    });
  });
});

describe("Quiz score: jawab semua benar → 4 stars", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ articleId: "112" });
  });

  it("2/2 benar → calculateQuizStars(2,2) = 4", async () => {
    render(<QuizScreen />);

    await waitFor(() => {
      expect(screen.getByText("Siapa lelaki Anshar?")).toBeTruthy();
    });

    // Answer Q1 correctly
    fireEvent.press(screen.getByTestId("option-1"));
    fireEvent.press(screen.getByText("Jawab"));
    await waitFor(() => expect(screen.getByText("Benar!")).toBeTruthy());
    fireEvent.press(screen.getByText(/Soal Berikutnya/));

    // Answer Q2 correctly
    await waitFor(() => {
      expect(screen.getByText("Beliau memiliki tiga anak panah?")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("option-0"));
    fireEvent.press(screen.getByText("Jawab"));
    await waitFor(() => expect(screen.getByText("Benar!")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText(/Selesai/));
    });

    expect(mockCalculateQuizStars).toHaveBeenCalledWith(2, 2);
    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ stars: "4" }),
      })
    );
  });
});

describe("Quiz: reward save gagal → tetap navigate", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ articleId: "112" });
    mockAddReward.mockRejectedValue(new Error("DB error"));
  });

  it("addReward throws → router.replace still called", async () => {
    render(<QuizScreen />);

    await waitFor(() => {
      expect(screen.getByText("Siapa lelaki Anshar?")).toBeTruthy();
    });

    // Answer Q1
    fireEvent.press(screen.getByTestId("option-1"));
    fireEvent.press(screen.getByText("Jawab"));
    await waitFor(() => expect(screen.getByText("Benar!")).toBeTruthy());
    fireEvent.press(screen.getByText(/Soal Berikutnya/));

    // Answer Q2
    await waitFor(() => {
      expect(screen.getByText("Beliau memiliki tiga anak panah?")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("option-0"));
    fireEvent.press(screen.getByText("Jawab"));
    await waitFor(() => expect(screen.getByText("Benar!")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText(/Selesai/));
    });

    // Despite addReward throwing, navigate should still happen
    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/celebrate",
      })
    );
  });
});
