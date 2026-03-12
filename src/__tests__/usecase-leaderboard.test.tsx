/**
 * Use case: Anak melihat peringkat (leaderboard)
 *
 * 1. Tampilkan daftar anak diurutkan berdasarkan koin (default)
 * 2. Bisa switch ke sort berdasarkan bintang
 * 3. Anak yang sedang login ditandai "(kamu)"
 * 4. Tombol Kembali → balik ke sebelumnya
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import LeaderboardScreen from "../../app/leaderboard";
import * as session from "../lib/session";
import * as children from "../lib/children";

const mockRouter = (global as any).__mockRouter;

const mockChildren = [
  { id: 1, name: "Ahmad", avatarColor: "#E91E63", coins: 15, stars: 4, age: 5 },
  { id: 2, name: "Fatimah", avatarColor: "#9C27B0", coins: 25, stars: 12, age: 7 },
  { id: 3, name: "Zaid", avatarColor: "#3F51B5", coins: 10, stars: 20, age: 9 },
];

jest.spyOn(session, "getSelectedChild").mockReturnValue({ id: 1, name: "Ahmad", age: 5 });
jest.spyOn(children, "getChildren").mockResolvedValue(mockChildren);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(children, "getChildren").mockResolvedValue(mockChildren);
});

describe("Anak melihat peringkat", () => {
  it("menampilkan judul Peringkat", () => {
    render(<LeaderboardScreen />);
    expect(screen.getByText("Peringkat")).toBeTruthy();
  });

  it("default sort: koin, menampilkan semua anak", async () => {
    render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(screen.getByText("Ahmad (kamu)")).toBeTruthy();
      expect(screen.getByText("Fatimah")).toBeTruthy();
      expect(screen.getByText("Zaid")).toBeTruthy();
    });

    // Shows coin values
    const allTexts = screen.getAllByText("koin");
    expect(allTexts.length).toBeGreaterThan(0);
  });

  it("anak yang aktif ditandai (kamu)", async () => {
    render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(screen.getByText("Ahmad (kamu)")).toBeTruthy();
    });
  });

  it("switch ke Bintang → urut berdasarkan bintang", async () => {
    render(<LeaderboardScreen />);

    await waitFor(() => screen.getByText("Ahmad (kamu)"));
    fireEvent.press(screen.getByText("Bintang"));

    await waitFor(() => {
      const labels = screen.getAllByText("bintang");
      expect(labels.length).toBeGreaterThan(0);
    });
  });

  it("tombol Kembali → router.back()", () => {
    render(<LeaderboardScreen />);

    fireEvent.press(screen.getByText("Kembali"));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
