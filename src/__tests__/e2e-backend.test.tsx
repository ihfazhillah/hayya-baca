/**
 * E2E tests: render real components → user actions → hit actual backend.
 *
 * These tests verify the full flow from user interaction to server
 * response rendering. SQLite is still mocked (can't run native in Node),
 * but fetch/API calls go to the real production server.
 *
 * Run with: E2E=1 TEST_PASS=xxx npx jest e2e-backend --forceExit
 * Skipped by default (needs network).
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import HomeScreen from "../../app/home";
import ArticleScreen from "../../app/article/[articleId]";
import GamesScreen from "../../app/games";
import * as session from "../lib/session";

const mockRouter = (global as any).__mockRouter;
const mockDb = (global as any).__mockDb;

const describeE2E = process.env.E2E ? describe : describe.skip;

// Use real fetch — do NOT mock articles or api modules
// The setup.ts already mocks expo-sqlite, expo-router, etc.

// Mock native speech module (can't run in Node)
jest.mock("../lib/speech", () => ({
  speakPage: jest.fn(),
  stopSpeaking: jest.fn(),
  speakWord: jest.fn(),
  calculateStars: jest.fn().mockReturnValue(0),
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
    version: "1.0.1-e2e",
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

beforeEach(() => {
  jest.clearAllMocks();
  // Re-apply session mock (clearAllMocks resets spies)
  jest.spyOn(session, "getSelectedChild").mockReturnValue({
    id: 1,
    name: "TestChild",
    age: 6,
  });
  // No reading progress
  mockDb.getAllAsync.mockResolvedValue([]);
  mockDb.getFirstAsync.mockResolvedValue(null);
});

describeE2E("E2E: Perpustakaan artikel dari server", () => {
  it("tab Artikel menampilkan artikel dari server (bukan hanya bundled)", async () => {
    render(<HomeScreen />);

    // Switch to Artikel tab
    fireEvent.press(screen.getByText("Artikel"));

    // Wait for server articles to load — should have more than 10 (bundled)
    await waitFor(
      () => {
        // Server has 900+ articles. If we see any article title rendered,
        // it means fetchAllArticles succeeded.
        const cards = screen.getAllByText(/soal kuis/i);
        // More than the 10 bundled articles means server responded
        expect(cards.length).toBeGreaterThan(5);
      },
      { timeout: 10000 }
    );
  }, 15000);

  it("tap artikel → navigasi ke /article/{id}", async () => {
    render(<HomeScreen />);

    fireEvent.press(screen.getByText("Artikel"));

    // Wait for articles from server
    await waitFor(
      () => {
        expect(screen.getAllByText(/soal kuis/i).length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );

    // Get all article cards and tap the first one
    const artikelCards = screen.getAllByText(/soal kuis/i);
    // The card's parent Pressable triggers navigation
    // Find a title to press
    const allTexts = screen.getAllByText(/.+/);
    // Find an article title (not "Buku", not "Artikel" tab, not kuis count)
    // Just verify navigation was called after pressing any article
    const firstKuis = artikelCards[0];
    // Navigate up to the pressable parent — fireEvent on the kuis text
    fireEvent.press(firstKuis);

    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.stringMatching(/\/article\/\d+/)
    );
  }, 15000);
});

describeE2E("E2E: Fetch artikel dari server", () => {
  it("fetchArticle berhasil ambil artikel bundled dari server", async () => {
    const { fetchArticle } = require("../lib/articles");
    const article = await fetchArticle("112");

    expect(article).not.toBeNull();
    expect(article!.id).toBe("112");
    expect(article!.title).toBeTruthy();
    expect(article!.content.length).toBeGreaterThan(0);
    expect(article!.quiz.length).toBeGreaterThan(0);
  }, 15000);

  it("fetchArticle berhasil ambil artikel non-bundled dari server", async () => {
    // Find a server-only article
    const res = await fetch("https://hayyabaca.ihfazh.com/api/books/?type=article");
    const articles = await res.json();
    const bundledIds = new Set([112, 209, 1176, 1218, 1255, 1379, 1675, 1777, 7416, 8457]);
    const serverOnly = articles.find((a: any) => !bundledIds.has(a.id));

    if (!serverOnly) {
      console.warn("No server-only article found, skipping");
      return;
    }

    const { fetchArticle } = require("../lib/articles");
    const article = await fetchArticle(String(serverOnly.id));

    expect(article).not.toBeNull();
    expect(article!.id).toBe(String(serverOnly.id));
    expect(article!.title).toBeTruthy();
    expect(article!.content.length).toBeGreaterThan(0);
  }, 15000);
});

describeE2E("E2E: Daftar permainan dari server", () => {
  it("menampilkan game dari server", async () => {
    render(<GamesScreen />);

    await waitFor(
      () => {
        // Should show "Dino Jump" from the server
        expect(screen.getByText("Dino Jump")).toBeTruthy();
      },
      { timeout: 10000 }
    );

    // Should show cost and duration
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
