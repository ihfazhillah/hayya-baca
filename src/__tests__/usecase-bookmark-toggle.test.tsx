/**
 * Use case: Anak menandai buku / artikel favorit via icon bintang di reading screen.
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react-native";

const { useLocalSearchParams } = require("expo-router");
const mockRouter = (global as any).__mockRouter;

// Mock bookmarks helper — controllable per test
const mockIsBookmarked = jest.fn();
const mockToggleBookmark = jest.fn();
const mockListBookmarks = jest.fn().mockResolvedValue([]);
jest.mock("../lib/bookmarks", () => ({
  isBookmarked: (...args: any[]) => mockIsBookmarked(...args),
  toggleBookmark: (...args: any[]) => mockToggleBookmark(...args),
  listBookmarks: (...args: any[]) => mockListBookmarks(...args),
  getDirtyBookmarks: jest.fn().mockResolvedValue([]),
  markBookmarksSynced: jest.fn(),
  applyServerBookmarks: jest.fn(),
}));

// Mock sync — bookmarks-only push
const mockPushBookmarksOnly = jest.fn().mockResolvedValue(undefined);
jest.mock("../lib/sync", () => ({
  syncAll: jest.fn().mockResolvedValue({}),
  pushBookmarksOnly: (...args: any[]) => mockPushBookmarksOnly(...args),
  syncBookmarksForChild: jest.fn().mockResolvedValue(undefined),
}));

// Mock session
jest.mock("../lib/session", () => ({
  getSelectedChild: () => ({ id: 1, name: "Ahmad", age: 7 }),
  selectChild: jest.fn(),
  clearChild: jest.fn(),
  subscribeSession: () => () => {},
}));

// Mock books for read screen
jest.mock("../lib/books", () => ({
  getBookContent: () => ({
    id: "6",
    title: "Kisah Buhairo",
    coverPath: null,
    pages: [{ page: 1, text: "Halaman satu." }],
  }),
  getAllBooks: () => [],
}));

// Mock reading deps so read screen mounts cleanly
jest.mock("../lib/speech", () => ({
  speakWord: jest.fn(),
  speakPage: jest.fn(),
  stopSpeaking: jest.fn(),
  calculateStars: jest.fn().mockReturnValue(0),
  calculateCoins: jest.fn().mockReturnValue(1),
  isNonIndonesian: () => false,
  isWordMatch: () => false,
}));
jest.mock("../lib/tts", () => ({
  speakWord: jest.fn(),
  speakPage: jest.fn(),
  stopSpeaking: jest.fn(),
}));
jest.mock("../lib/rewards", () => ({
  addReward: jest.fn(),
  saveReadingProgress: jest.fn(),
  getAllReadingProgress: jest.fn().mockResolvedValue({}),
}));
jest.mock("../lib/recommendation", () => ({
  appendReadingLog: jest.fn(),
}));
jest.mock("../hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    isListening: false,
    currentWordIndex: 0,
    attempts: 0,
    readWords: new Map(),
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  }),
}));

// Mock articles — for article screen
const testArticle = {
  id: "112",
  slug: "article-112",
  title: "Lelaki Anshar",
  source: "",
  category: [],
  content: "Paragraf satu.\n\nParagraf dua.",
  quiz: [],
};
jest.mock("../lib/articles", () => ({
  getArticle: () => testArticle,
  fetchArticle: jest.fn().mockResolvedValue(testArticle),
  getAllArticles: () => [testArticle],
  fetchAllArticles: () => Promise.resolve([testArticle]),
}));

import ReadScreen from "../../app/read/[bookId]";
import ArticleScreen from "../../app/article/[articleId]";

beforeEach(() => {
  jest.clearAllMocks();
  mockIsBookmarked.mockResolvedValue(false);
  mockToggleBookmark.mockImplementation(async () => true);
});

afterEach(() => cleanup());

describe("Bookmark toggle — artikel (priority)", () => {
  it("awalnya star outline; tap → filled + toggleBookmark called + push fired", async () => {
    useLocalSearchParams.mockReturnValue({ articleId: "112" });

    render(<ArticleScreen />);

    // Star should render with accessibilityLabel "Bookmark"
    const star = await screen.findByLabelText("Bookmark");
    expect(star).toBeTruthy();
    // Outline state by default
    expect(star.props.accessibilityState?.selected).toBe(false);

    await act(async () => {
      fireEvent.press(star);
    });

    await waitFor(() => {
      expect(mockToggleBookmark).toHaveBeenCalledWith(1, "article", "article-112");
    });
    expect(mockPushBookmarksOnly).toHaveBeenCalledWith(1);

    // After toggle, state is filled
    const starAfter = screen.getByLabelText("Bookmark");
    expect(starAfter.props.accessibilityState?.selected).toBe(true);
  });

  it("sync push throws → local state tetap filled (fail-safe)", async () => {
    useLocalSearchParams.mockReturnValue({ articleId: "112" });
    mockPushBookmarksOnly.mockRejectedValueOnce(new Error("network"));

    render(<ArticleScreen />);
    const star = await screen.findByLabelText("Bookmark");

    await act(async () => {
      fireEvent.press(star);
    });

    await waitFor(() => {
      expect(mockToggleBookmark).toHaveBeenCalled();
    });
    const starAfter = screen.getByLabelText("Bookmark");
    expect(starAfter.props.accessibilityState?.selected).toBe(true);
  });
});

describe("Bookmark toggle — buku", () => {
  it("tap star di read screen → toggleBookmark called untuk book", async () => {
    useLocalSearchParams.mockReturnValue({ bookId: "6" });

    render(<ReadScreen />);
    const star = await screen.findByLabelText("Bookmark");
    expect(star.props.accessibilityState?.selected).toBe(false);

    await act(async () => {
      fireEvent.press(star);
    });

    await waitFor(() => {
      expect(mockToggleBookmark).toHaveBeenCalledWith(1, "book", "6");
    });
    expect(mockPushBookmarksOnly).toHaveBeenCalledWith(1);
  });

  it("mount dengan state already-bookmarked → star filled", async () => {
    useLocalSearchParams.mockReturnValue({ bookId: "6" });
    mockIsBookmarked.mockResolvedValue(true);

    render(<ReadScreen />);
    const star = await screen.findByLabelText("Bookmark");
    await waitFor(() => {
      expect(star.props.accessibilityState?.selected).toBe(true);
    });
  });
});
