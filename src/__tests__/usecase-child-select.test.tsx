/**
 * Use case: Anak membuka app dan memilih profil
 *
 * 1. App menampilkan judul "Hayya Baca!" dan daftar anak
 * 2. Anak menekan profilnya → masuk ke perpustakaan
 * 3. Ada tombol "Orang Tua" untuk akses parent page
 * (Tambah anak dilakukan di halaman Orang Tua)
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ChildSelectScreen from "../../app/index";

// Mock children data
const mockChildren = [
  { id: 1, name: "Ahmad", avatar_color: "#E91E63", coins: 15, stars: 8, age: 5 },
  { id: 2, name: "Fatimah", avatar_color: "#9C27B0", coins: 10, stars: 4, age: 7 },
];

const mockDb = (global as any).__mockDb;
const mockRouter = (global as any).__mockRouter;

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.getAllAsync.mockResolvedValue(mockChildren);
});

describe("Anak membuka app", () => {
  it("menampilkan judul dan pertanyaan siapa yang mau baca", async () => {
    renderWithProviders(<ChildSelectScreen />);

    expect(screen.getByText("Hayya Baca!")).toBeTruthy();
    expect(screen.getByText("Siapa yang mau baca?")).toBeTruthy();
  });

  it("menampilkan daftar anak yang ada", async () => {
    renderWithProviders(<ChildSelectScreen />);

    await waitFor(() => {
      expect(screen.getByText("Ahmad")).toBeTruthy();
      expect(screen.getByText("Fatimah")).toBeTruthy();
    });
  });

  it("menampilkan koin masing-masing anak", async () => {
    renderWithProviders(<ChildSelectScreen />);

    await waitFor(() => {
      expect(screen.getByText("15 koin")).toBeTruthy();
      expect(screen.getByText("10 koin")).toBeTruthy();
    });
  });

  it("memilih profil anak → navigasi ke /home", async () => {
    renderWithProviders(<ChildSelectScreen />);

    await waitFor(() => screen.getByText("Ahmad"));
    fireEvent.press(screen.getByText("Ahmad"));

    expect(mockRouter.push).toHaveBeenCalledWith("/home");
  });

  it("ada tombol Orang Tua → navigasi ke /parent", async () => {
    renderWithProviders(<ChildSelectScreen />);

    const btn = screen.getByText("Orang Tua");
    expect(btn).toBeTruthy();
    fireEvent.press(btn);

    expect(mockRouter.push).toHaveBeenCalledWith("/parent");
  });
});
