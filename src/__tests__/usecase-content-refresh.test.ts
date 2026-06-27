/**
 * Use case: Konten baru dari server muncul di app TANPA reinstall.
 *
 * Bug: setelah syncContent download quiz/artikel baru, app yang sedang jalan
 * tetap menampilkan data lama karena:
 *   1. in-memory cache (memoryArticles/memoryList) tidak pernah di-invalidate
 *   2. tidak ada listener untuk emitDataChange("content")
 *
 * Fix: articles/books subscribe ke onDataChange("content") → buang cache.
 * Test ini FAIL sebelum fix (fetchArticle kembalikan quiz lama setelah sync).
 */

// Control downloaded content; db-events dibiarkan REAL agar listener benar-benar jalan.
// Prefix `mock` wajib agar boleh diakses dari factory jest.mock (hoisted).
let mockDownloadedBySlug: Record<string, any> = {};

jest.mock("../lib/content-manager", () => ({
  getDownloadedContent: jest.fn(async (slug: string) => mockDownloadedBySlug[slug] ?? null),
  getAllDownloadedByType: jest.fn(async () => Object.values(mockDownloadedBySlug)),
}));

jest.mock("../lib/api", () => ({
  fetchArticleList: jest.fn(async () => []),
  fetchArticleDetail: jest.fn(async () => {
    throw new Error("offline");
  }),
}));

jest.mock("../lib/database", () => ({
  getDatabase: jest.fn(async () => ({
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async () => {}),
  })),
}));

import { fetchArticle } from "../lib/articles";
import { emitDataChange } from "../lib/db-events";

beforeEach(() => {
  mockDownloadedBySlug = {};
});

describe("Konten baru muncul setelah sync (cache invalidation)", () => {
  it("fetchArticle kembalikan quiz baru setelah emitDataChange('content')", async () => {
    mockDownloadedBySlug["article-209"] = {
      slug: "article-209",
      title: "Artikel 209",
      content: "isi",
      quiz: [
        { type: "multiple_choice", question: "SOAL LAMA", options: ["a", "b", "c", "d"], answer: 0, explanation: "" },
      ],
    };

    const first = await fetchArticle("article-209");
    expect(first?.quiz[0].question).toBe("SOAL LAMA");

    // Server diperbarui & syncContent men-download isi baru ke SQLite.
    mockDownloadedBySlug["article-209"] = {
      slug: "article-209",
      title: "Artikel 209",
      content: "isi",
      quiz: [
        { type: "multiple_choice", question: "SOAL BARU", options: ["a", "b", "c", "d"], answer: 1, explanation: "" },
      ],
    };

    // Tanpa invalidate, memory cache masih kembalikan yang lama.
    const stale = await fetchArticle("article-209");
    expect(stale?.quiz[0].question).toBe("SOAL LAMA");

    // syncContent memancarkan sinyal "content" → cache dibuang.
    emitDataChange("content");

    const fresh = await fetchArticle("article-209");
    expect(fresh?.quiz[0].question).toBe("SOAL BARU");
  });
});
