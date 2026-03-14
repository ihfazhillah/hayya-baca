/**
 * Use case: Anak selesai membaca buku → layar selebrasi
 *
 * 1. Tampilkan "Alhamdulillah!" dan judul buku
 * 2. Tampilkan jumlah koin dan bintang yang didapat
 * 3. Jika dari kuis, tampilkan skor kuis
 * 4. Tombol "Baca buku lain" / "Baca artikel lain" → kembali ke home
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";

import CelebrateScreen from "../../app/celebrate";

const mockRouter = (global as any).__mockRouter;

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: jest.fn(),
}));

const { useLocalSearchParams } = require("expo-router");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Selebrasi selesai buku", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({
      coins: "3",
      stars: "8",
      bookTitle: "Kisah Buhairo, Sang Pendeta",
    });
  });

  it("menampilkan Alhamdulillah", () => {
    render(<CelebrateScreen />);
    expect(screen.getByText("Alhamdulillah!")).toBeTruthy();
  });

  it("menampilkan pesan selesai membaca", () => {
    render(<CelebrateScreen />);
    expect(screen.getByText("Kamu sudah selesai membaca")).toBeTruthy();
  });

  it("menampilkan judul buku", () => {
    render(<CelebrateScreen />);
    expect(screen.getByText("Kisah Buhairo, Sang Pendeta")).toBeTruthy();
  });

  it("menampilkan jumlah koin dan bintang", () => {
    render(<CelebrateScreen />);
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("Koin")).toBeTruthy();
    expect(screen.getByText("+8")).toBeTruthy();
    expect(screen.getByText("Bintang")).toBeTruthy();
  });

  it("tombol Kembali → kembali ke home", () => {
    render(<CelebrateScreen />);

    fireEvent.press(screen.getByText("Kembali"));
    expect(mockRouter.replace).toHaveBeenCalledWith("/home");
  });
});

describe("Selebrasi selesai kuis artikel", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({
      coins: "2",
      stars: "4",
      bookTitle: "Sedekah Membawa Berkah",
      quizScore: "4/5",
    });
  });

  it("menampilkan skor kuis", () => {
    render(<CelebrateScreen />);
    expect(screen.getByText("Skor kuis: 4/5 benar")).toBeTruthy();
  });

  it("tombol berubah jadi Baca artikel lain", () => {
    render(<CelebrateScreen />);
    expect(screen.getByText("Baca artikel lain")).toBeTruthy();
  });
});

describe("Selebrasi tanpa bintang", () => {
  it("tidak menampilkan card bintang jika 0", () => {
    useLocalSearchParams.mockReturnValue({
      coins: "2",
      stars: "0",
      bookTitle: "Test",
    });

    render(<CelebrateScreen />);
    expect(screen.getByText("Koin")).toBeTruthy();
    expect(screen.queryByText("Bintang")).toBeNull();
  });
});
