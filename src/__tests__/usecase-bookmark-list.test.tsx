/**
 * Use case: Anak melihat section "Favorit" merged di library (buku + artikel).
 */
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";

const mockRouter = (global as any).__mockRouter;
const mockDb = (global as any).__mockDb;

import * as session from "../lib/session";

jest.spyOn(session, "getSelectedChild").mockReturnValue({
  id: 1,
  name: "Ahmad",
  age: 7,
});

jest.mock("../lib/books", () => ({
  getAllBooks: () => [
    { id: "1", title: "Sahabat yang disebut namanya di langit", coverPath: null, pageCount: 12, hasAudio: false },
    { id: "3", title: "Terbunuhnya Singa Alloh", coverPath: null, pageCount: 8, hasAudio: false },
  ],
}));

const mockArticles = [
  { id: "112", title: "Lelaki Anshar", slug: "article-112", source: "", category: [], content: "", quiz: [{ question: "q1" }] },
  { id: "209", title: "Saad bin Abi Waqqash", slug: "article-209", source: "", category: [], content: "", quiz: [{ question: "q1" }] },
];
jest.mock("../lib/articles", () => ({
  getAllArticles: () => mockArticles,
  fetchAllArticles: () => Promise.resolve(mockArticles),
}));

const mockListBookmarks = jest.fn();
jest.mock("../lib/bookmarks", () => ({
  listBookmarks: (...args: any[]) => mockListBookmarks(...args),
  isBookmarked: jest.fn().mockResolvedValue(false),
  toggleBookmark: jest.fn(),
  getDirtyBookmarks: jest.fn().mockResolvedValue([]),
  markBookmarksSynced: jest.fn(),
  applyServerBookmarks: jest.fn(),
}));

jest.mock("../lib/sync", () => ({
  syncAll: jest.fn().mockResolvedValue({}),
  pushBookmarksOnly: jest.fn().mockResolvedValue(undefined),
  syncBookmarksForChild: jest.fn().mockResolvedValue(undefined),
}));

import HomeScreen from "../../app/home";

function renderHome() {
  return render(
    <NavigationContainer>
      <HomeScreen />
    </NavigationContainer>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.getAllAsync.mockResolvedValue([]);
  mockListBookmarks.mockResolvedValue([]);
});

afterEach(() => cleanup());

describe("Favorit section — kosong", () => {
  it("tidak ada bookmark → empty state", async () => {
    renderHome();
    await waitFor(() => {
      expect(screen.getByText(/Belum ada favorit/i)).toBeTruthy();
    });
  });
});

describe("Favorit section — ada isi", () => {
  it("bookmark artikel muncul dengan label Artikel", async () => {
    mockListBookmarks.mockResolvedValue([
      { child_id: 1, content_type: "article", content_slug: "article-112", updated_at: 2000, is_deleted: 0 },
    ]);

    renderHome();

    await waitFor(() => {
      expect(screen.getByText("Favorit")).toBeTruthy();
      expect(screen.getByText("Lelaki Anshar")).toBeTruthy();
    });
    expect(screen.getByText("ARTIKEL")).toBeTruthy();
  });

  it("bookmark buku + artikel merged, terbaru di atas", async () => {
    mockListBookmarks.mockResolvedValue([
      { child_id: 1, content_type: "book", content_slug: "1", updated_at: 3000, is_deleted: 0 },
      { child_id: 1, content_type: "article", content_slug: "article-112", updated_at: 2000, is_deleted: 0 },
    ]);

    renderHome();

    await waitFor(() => {
      expect(screen.getByText("Sahabat yang disebut namanya di langit")).toBeTruthy();
    });
    // Both badges present (distinct from tab labels "Buku"/"Artikel")
    expect(screen.getByText("BUKU")).toBeTruthy();
    expect(screen.getByText("ARTIKEL")).toBeTruthy();
  });

  it("tap bookmark buku → routes ke /read/{id}", async () => {
    mockListBookmarks.mockResolvedValue([
      { child_id: 1, content_type: "book", content_slug: "1", updated_at: 3000, is_deleted: 0 },
    ]);

    renderHome();

    await waitFor(() => screen.getByText("BUKU"));
    // Tap the Favorit badge's title (first occurrence in Favorit section)
    const matches = screen.getAllByText("Sahabat yang disebut namanya di langit");
    fireEvent.press(matches[0]);
    expect(mockRouter.push).toHaveBeenCalledWith("/read/1");
  });

  it("tap bookmark artikel → routes ke /article/{id}", async () => {
    mockListBookmarks.mockResolvedValue([
      { child_id: 1, content_type: "article", content_slug: "article-112", updated_at: 2000, is_deleted: 0 },
    ]);

    renderHome();

    await waitFor(() => screen.getByText("Lelaki Anshar"));
    fireEvent.press(screen.getByText("Lelaki Anshar"));
    expect(mockRouter.push).toHaveBeenCalledWith("/article/112");
  });
});
