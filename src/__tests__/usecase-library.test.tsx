/**
 * Use case: Anak melihat perpustakaan buku dan artikel
 *
 * 1. Setelah memilih profil, anak melihat perpustakaan
 * 2. Ada tab Buku dan Artikel
 * 3. Anak bisa lihat judul buku dan jumlah halaman
 * 4. Anak bisa lihat artikel dan jumlah soal kuis
 * 5. Ada tombol Ganti (kembali ke pilih profil) dan Peringkat
 * 6. Buku yang sudah selesai ditandai badge
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";

import HomeScreen from "../../app/home";

function renderWithProviders(ui: React.ReactElement) {
  return render(<NavigationContainer>{ui}</NavigationContainer>);
}
import * as session from "../lib/session";

const mockRouter = (global as any).__mockRouter;
const mockDb = (global as any).__mockDb;

// Mock the session to have a selected child
jest.spyOn(session, "getSelectedChild").mockReturnValue({
  id: 1,
  name: "Ahmad",
  age: 5,
});

// Mock book content — static imports are resolved by jest-expo
jest.mock("../lib/books", () => ({
  getAllBooks: () => [
    { id: "1", title: "Sahabat yang disebut namanya di langit", coverPath: null, pageCount: 12, hasAudio: false },
    { id: "3", title: "Terbunuhnya Singa Alloh", coverPath: null, pageCount: 8, hasAudio: false },
  ],
}));

const mockArticles = [
  { id: "112", title: "Lelaki Anshar dengan Tiga Anak Panah", source: "", category: [], content: "", quiz: [{ question: "q1" }, { question: "q2" }] },
  { id: "209", title: "Saad bin Abi Waqqash", source: "", category: [], content: "", quiz: [{ question: "q1" }] },
];
jest.mock("../lib/articles", () => ({
  getAllArticles: () => mockArticles,
  fetchAllArticles: () => Promise.resolve(mockArticles),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // No reading progress
  mockDb.getAllAsync.mockResolvedValue([]);
});

describe("Anak melihat perpustakaan", () => {
  it("menampilkan nama anak di header", () => {
    renderWithProviders(<HomeScreen />);
    expect(screen.getByText("Halo, Ahmad!")).toBeTruthy();
  });

  it("menampilkan tab Buku dan Artikel", () => {
    renderWithProviders(<HomeScreen />);
    expect(screen.getByText("Buku")).toBeTruthy();
    expect(screen.getByText("Artikel")).toBeTruthy();
  });

  it("menampilkan daftar buku dengan judul dan halaman", async () => {
    renderWithProviders(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText("Sahabat yang disebut namanya di langit")).toBeTruthy();
      expect(screen.getByText("Terbunuhnya Singa Alloh")).toBeTruthy();
    });

    expect(screen.getByText("12 halaman")).toBeTruthy();
    expect(screen.getByText("8 halaman")).toBeTruthy();
  });

  it("pindah ke tab Artikel → menampilkan daftar artikel", async () => {
    renderWithProviders(<HomeScreen />);

    fireEvent.press(screen.getByText("Artikel"));

    await waitFor(() => {
      expect(screen.getByText("Lelaki Anshar dengan Tiga Anak Panah")).toBeTruthy();
      expect(screen.getByText("Saad bin Abi Waqqash")).toBeTruthy();
    });

    expect(screen.getByText("2 soal kuis")).toBeTruthy();
    expect(screen.getByText("1 soal kuis")).toBeTruthy();
  });

  it("menekan buku → navigasi ke /read/{id}", async () => {
    renderWithProviders(<HomeScreen />);

    await waitFor(() => screen.getByText("Sahabat yang disebut namanya di langit"));
    fireEvent.press(screen.getByText("Sahabat yang disebut namanya di langit"));

    expect(mockRouter.push).toHaveBeenCalledWith("/read/1");
  });

  it("menekan artikel → navigasi ke /article/{id}", async () => {
    renderWithProviders(<HomeScreen />);

    fireEvent.press(screen.getByText("Artikel"));
    await waitFor(() => screen.getByText("Lelaki Anshar dengan Tiga Anak Panah"));
    fireEvent.press(screen.getByText("Lelaki Anshar dengan Tiga Anak Panah"));

    expect(mockRouter.push).toHaveBeenCalledWith("/article/112");
  });

  it("tombol Ganti → kembali ke pilih profil", () => {
    renderWithProviders(<HomeScreen />);

    fireEvent.press(screen.getByText("Ganti"));
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("tombol Peringkat → navigasi ke leaderboard", () => {
    renderWithProviders(<HomeScreen />);

    fireEvent.press(screen.getByText("Peringkat"));
    expect(mockRouter.push).toHaveBeenCalledWith("/leaderboard");
  });
});

describe("Progress badge di perpustakaan", () => {
  it("buku yang sudah selesai menampilkan badge centang", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { book_id: "1", last_page: 11, completed: 1, completed_count: 1 },
    ]);

    renderWithProviders(<HomeScreen />);

    await waitFor(() => {
      // Badge shows checkmark for completed book
      expect(screen.getByText("\u2713")).toBeTruthy();
    });
  });

  it("buku selesai lebih dari 1x menampilkan Nx", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { book_id: "1", last_page: 11, completed: 1, completed_count: 3 },
    ]);

    renderWithProviders(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText("3x")).toBeTruthy();
    });
  });
});
