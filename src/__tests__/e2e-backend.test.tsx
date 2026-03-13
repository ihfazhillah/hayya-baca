/**
 * E2E tests: render real components → user actions → hit actual backend.
 *
 * These tests verify the full flow from user interaction to server
 * response rendering. SQLite is still mocked (can't run native in Node),
 * but fetch/API calls go to the real production server.
 *
 * Run with: E2E=1 npx jest e2e-backend --forceExit
 * Skipped by default (needs network).
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";

import HomeScreen from "../../app/home";
import ArticleScreen from "../../app/article/[articleId]";
import QuizScreen from "../../app/quiz/[articleId]";
import GamesScreen from "../../app/games";
import * as session from "../lib/session";

const mockRouter = (global as any).__mockRouter;
const mockDb = (global as any).__mockDb;

const describeE2E = process.env.E2E ? describe : describe.skip;

// Mock native speech module (can't run in Node)
jest.mock("../lib/speech", () => ({
  speakPage: jest.fn((_text, _onWord, onDone) => {
    // Simulate immediate completion so handleReadToMe finishes
    if (onDone) setTimeout(onDone, 10);
  }),
  stopSpeaking: jest.fn(),
  speakWord: jest.fn(),
  calculateStars: jest.fn().mockReturnValue(2),
  calculateCoins: jest.fn().mockReturnValue(1),
}));

// Mock WebView (can't render in Jest)
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: View };
});

// Override expo-constants to provide real API URL
jest.mock("expo-constants", () => ({
  expoConfig: {
    version: "1.0.2-e2e",
    extra: {
      apiBaseUrl: "https://hayyabaca.ihfazh.com/api",
    },
  },
}));

// Mock session to have a selected child
jest.spyOn(session, "getSelectedChild").mockReturnValue({
  id: 1,
  name: "TestChild",
  age: 6,
});

// Mock only books (bundled content, not server)
jest.mock("../lib/books", () => ({
  getAllBooks: () => [
    { id: "1", title: "Buku Test", coverPath: null, pageCount: 5, hasAudio: false },
  ],
}));

// DO NOT mock ../lib/articles — let it hit real server
// DO NOT mock ../lib/api — let it hit real server

// Track useLocalSearchParams mock
const { useLocalSearchParams } = require("expo-router");

// Helper to flatten React children into string
const flattenChildren = (c: any): string => {
  if (typeof c === "string" || typeof c === "number") return String(c);
  if (Array.isArray(c)) return c.map(flattenChildren).join("");
  return "";
};

beforeEach(() => {
  jest.clearAllMocks();
  // Re-apply session mock (clearAllMocks resets spies)
  jest.spyOn(session, "getSelectedChild").mockReturnValue({
    id: 1,
    name: "TestChild",
    age: 6,
  });
  // Default: no reading progress, no cached articles
  mockDb.getAllAsync.mockResolvedValue([]);
  mockDb.getFirstAsync.mockResolvedValue(null);
  // Reset search params
  useLocalSearchParams.mockReturnValue({});
});

// ─── Article list from server ────────────────────────────────────────────

describeE2E("E2E: Perpustakaan artikel dari server", () => {
  it("tab Artikel menampilkan artikel dari server (bukan hanya bundled)", async () => {
    render(<HomeScreen />);

    fireEvent.press(screen.getByText("Artikel"));

    await waitFor(
      () => {
        const cards = screen.getAllByText(/soal kuis/i);
        expect(cards.length).toBeGreaterThan(5);
      },
      { timeout: 10000 }
    );
  }, 15000);

  it("tap artikel → navigasi ke /article/{id}", async () => {
    render(<HomeScreen />);

    fireEvent.press(screen.getByText("Artikel"));

    await waitFor(
      () => {
        expect(screen.getAllByText(/soal kuis/i).length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );

    const artikelCards = screen.getAllByText(/soal kuis/i);
    fireEvent.press(artikelCards[0]);

    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.stringMatching(/\/article\/\d+/)
    );
  }, 15000);
});

// ─── Article detail screen ───────────────────────────────────────────────

describeE2E("E2E: Detail artikel dari server", () => {
  it("ArticleScreen memuat dan menampilkan konten artikel dari server", async () => {
    // Use article 112 — bundled locally, also on server
    useLocalSearchParams.mockReturnValue({ articleId: "112" });

    render(<ArticleScreen />);

    // Wait for server fetch to complete — article should render with real content
    // Don't hardcode title (server content may differ from bundled)
    await waitFor(
      () => {
        // "Bacakan" button = article loaded successfully (not error/loading state)
        expect(screen.getByText("Bacakan")).toBeTruthy();
        // Content paragraphs should exist (text > 20 chars)
        const allTexts = screen.getAllByText(/.{20,}/);
        expect(allTexts.length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );

    // "Mulai Kuis" button should exist (disabled until scroll to end)
    expect(screen.getByText("Mulai Kuis")).toBeTruthy();
  }, 15000);

  it("ArticleScreen tidak crash saat state transition loading→loaded (hooks ordering)", async () => {
    // Use a server-only article ID (not bundled) — this triggers the
    // loading→loaded state transition that previously caused hooks crash
    // First fetch a valid ID from server
    const res = await fetch("https://hayyabaca.ihfazh.com/api/books/?type=article");
    const articles = await res.json();
    const bundledIds = new Set(["112", "209", "1176", "1218", "1255", "1379", "1675", "1777", "7416", "8457"]);
    const serverOnly = articles.find((a: any) => !bundledIds.has(String(a.id)));

    if (!serverOnly) {
      console.warn("No server-only article found, skipping");
      return;
    }

    useLocalSearchParams.mockReturnValue({ articleId: String(serverOnly.id) });

    // This should NOT throw "Rendered more hooks than during the previous render"
    render(<ArticleScreen />);

    // Should show loading initially (no bundled fallback for this ID)
    expect(screen.getByText("Memuat artikel...")).toBeTruthy();

    // Wait for content to load from server — transition from loading→loaded
    await waitFor(
      () => {
        expect(screen.getByText("Bacakan")).toBeTruthy();
        expect(screen.getByText(serverOnly.title)).toBeTruthy();
      },
      { timeout: 15000 }
    );

    // Paragraphs should be rendered
    const allTexts = screen.getAllByText(/.{20,}/);
    expect(allTexts.length).toBeGreaterThan(0);
  }, 20000);
});

// ─── Quiz flow ───────────────────────────────────────────────────────────

describeE2E("E2E: Quiz flow dari server", () => {
  // Helper: find a server article that has quizzes
  async function findArticleWithQuiz(): Promise<string | null> {
    const res = await fetch("https://hayyabaca.ihfazh.com/api/books/?type=article");
    const articles = await res.json();
    const withQuiz = articles.find((a: any) => a.quiz_count > 0);
    return withQuiz ? String(withQuiz.id) : null;
  }

  it("QuizScreen memuat soal kuis dari server dan user bisa menjawab", async () => {
    const articleId = await findArticleWithQuiz();
    if (!articleId) {
      console.warn("No article with quiz found on server, skipping");
      return;
    }

    useLocalSearchParams.mockReturnValue({ articleId });

    render(<QuizScreen />);

    // Should show loading, then quiz content
    await waitFor(
      () => {
        expect(screen.getByText(/Soal 1 dari/)).toBeTruthy();
      },
      { timeout: 15000 }
    );

    // "Jawab" button should be visible
    expect(screen.getByText("Jawab")).toBeTruthy();

    // Options should be visible (either MC options or Benar/Salah)
    // At minimum: question text + options + Jawab button
    const allTexts = screen.getAllByText(/.+/);
    expect(allTexts.length).toBeGreaterThan(3);
  }, 20000);

  it("QuizScreen: user menjawab semua soal sampai selesai → navigate celebrate", async () => {
    const articleId = await findArticleWithQuiz();
    if (!articleId) {
      console.warn("No article with quiz found on server, skipping");
      return;
    }

    useLocalSearchParams.mockReturnValue({ articleId });

    render(<QuizScreen />);

    // Wait for quiz to load
    await waitFor(
      () => {
        expect(screen.getByText(/Soal 1 dari/)).toBeTruthy();
      },
      { timeout: 15000 }
    );

    // Parse total from "Soal 1 dari X" — children may be split array
    const soalEl = screen.getByText(/Soal 1 dari/);
    const soalText = flattenChildren(soalEl.props.children);
    const totalMatch = soalText.match(/dari\s+(\d+)/);
    const totalQ = totalMatch ? parseInt(totalMatch[1]) : 1;

    // Answer each question
    for (let q = 0; q < totalQ; q++) {
      await waitFor(() => {
        expect(screen.getByText(`Soal ${q + 1} dari ${totalQ}`)).toBeTruthy();
      });

      // Select first option by testID (Pressable has testID="option-0")
      await act(async () => {
        fireEvent.press(screen.getByTestId("option-0"));
      });

      // Press "Jawab"
      await act(async () => {
        fireEvent.press(screen.getByText("Jawab"));
      });

      // Should show result and "Jawab" should be gone (replaced by explanation)
      await waitFor(() => {
        expect(screen.queryByText("Jawab")).toBeNull();
      });

      // Press next or finish
      if (q < totalQ - 1) {
        const nextBtn = screen.getByText(/Soal Berikutnya/);
        await act(async () => {
          fireEvent.press(nextBtn);
        });
      } else {
        const selesaiBtn = screen.getByText(/Selesai/);
        await act(async () => {
          fireEvent.press(selesaiBtn);
        });
      }
    }

    // After last question, should navigate to celebrate
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/celebrate",
          params: expect.objectContaining({
            coins: "1",
            quizScore: expect.stringMatching(/\d+\/\d+/),
          }),
        })
      );
    });
  }, 45000);
});

// ─── Games ───────────────────────────────────────────────────────────────

describeE2E("E2E: Daftar permainan dari server", () => {
  it("menampilkan game dari server", async () => {
    render(<GamesScreen />);

    await waitFor(
      () => {
        expect(screen.getByText("Dino Jump")).toBeTruthy();
      },
      { timeout: 10000 }
    );

    expect(screen.getByText(/koin/i)).toBeTruthy();
    expect(screen.getByText(/menit/i)).toBeTruthy();
  }, 15000);

  it("tap game → navigasi ke /game/{slug}", async () => {
    render(<GamesScreen />);

    await waitFor(
      () => {
        expect(screen.getByText("Dino Jump")).toBeTruthy();
      },
      { timeout: 10000 }
    );

    fireEvent.press(screen.getByText("Dino Jump"));

    expect(mockRouter.push).toHaveBeenCalledWith("/game/dino-jump");
  }, 15000);
});
