/**
 * Use case: Anak baca artikel server → navigasi keluar → kembali lagi
 *
 * Bug: Artikel dari server yang sudah pernah dimuat berhasil,
 * ketika dibuka lagi menampilkan "Artikel tidak ditemukan"
 * karena getArticle() hanya cek bundled, tidak cek memory cache.
 *
 * Test ini:
 *   - TIDAK mock articles.ts → pakai implementasi asli
 *   - Mock API layer (fetch) → simulasi server down
 *   - FAIL sekarang (bug confirmed)
 *   - PASS setelah fix
 */
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react-native";

const { useLocalSearchParams } = require("expo-router");
const mockDb = (global as any).__mockDb;

// Mock TTS (native module)
jest.mock("../../src/lib/tts", () => ({
  speakWord: jest.fn(),
  speakPage: jest.fn(),
  stopSpeaking: jest.fn(),
}));

// DO NOT mock articles.ts — we test the real implementation
// Mock fetch at global level to control server responses
const originalFetch = global.fetch;

const serverDetailResponse = {
  id: 999,
  title: "Umar bin Abdul Aziz",
  content_type: "article",
  source: "kisahmuslim.com",
  source_url: "",
  categories: ["Tokoh Tabi'in"],
  sections: [
    { order: 1, type: "paragraph", text: "Umar bin Abdul Aziz adalah khalifah yang adil.", items: [] },
    { order: 2, type: "paragraph", text: "Beliau terkenal dengan keadilannya.", items: [] },
  ],
  quizzes: [],
};

import ArticleScreen from "../../app/article/[articleId]";

beforeEach(() => {
  jest.clearAllMocks();
  useLocalSearchParams.mockReturnValue({ articleId: "999" });
  // Reset DB mock
  mockDb.getFirstAsync.mockResolvedValue(null);
  mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

describe("Artikel server: buka pertama → berhasil, buka kedua → harus tetap tampil", () => {
  it("buka pertama (server OK) → artikel tampil", async () => {
    // Server returns article successfully
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(serverDetailResponse),
    }) as any;

    render(<ArticleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Umar bin Abdul Aziz")).toBeTruthy();
    });

    expect(
      screen.getByText("Umar bin Abdul Aziz adalah khalifah yang adil.")
    ).toBeTruthy();
  });

  it("buka kedua (server DOWN) → artikel harus tetap tampil dari cache", async () => {
    // Step 1: Simulate first visit — fetchArticle succeeded and cached to memory
    // We need to call fetchArticle directly to populate the in-memory cache
    const { fetchArticle } = require("../../src/lib/articles");

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(serverDetailResponse),
    }) as any;

    await fetchArticle("999"); // This should populate in-memory cache

    // Step 2: Now server is DOWN
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error")) as any;
    // SQLite cache also fails (e.g., table issue)
    mockDb.getFirstAsync.mockResolvedValue(null);

    cleanup();

    // Step 3: Re-render (simulate navigating back to article)
    render(<ArticleScreen />);

    // BUG: getArticle("999") only checks bundledArticles → returns null
    // fetchArticle("999") fails (server down, no SQLite cache) → null
    // Result: "Artikel tidak ditemukan"
    //
    // EXPECTED (after fix): getArticle("999") checks in-memory cache → returns article
    await waitFor(() => {
      expect(screen.getByText("Umar bin Abdul Aziz")).toBeTruthy();
    });
  });
});
