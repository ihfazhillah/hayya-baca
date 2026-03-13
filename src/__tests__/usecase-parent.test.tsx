/**
 * Use case: Orang tua akses halaman parent
 *
 * Flow 1 — Pertama kali (belum ada PIN):
 *   1. Langsung masuk ke "Buat PIN Orang Tua"
 *   2. Masukkan 4 digit → Konfirmasi → Simpan → masuk dashboard
 *
 * Flow 2 — Sudah ada PIN:
 *   1. Tampilkan "Halaman Orang Tua" + form PIN
 *   2. PIN benar → masuk dashboard
 *   3. PIN salah → alert "PIN salah"
 *
 * Flow 3 — Dashboard:
 *   1. Belum login → tampilkan form login (username/password)
 *   2. Login berhasil → tampilkan "Sudah login" + tombol Logout + Sync
 *   3. Daftar anak-anak dengan koin dan bintang
 *   4. Tekan anak → lihat detail progress dan reward
 *   5. Info versi app
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

import ParentScreen from "../../app/parent";
import * as database from "../lib/database";
import * as api from "../lib/api";
import * as sync from "../lib/sync";
import * as children from "../lib/children";
import * as rewards from "../lib/rewards";

const mockRouter = (global as any).__mockRouter;

// Spy on Alert.alert
jest.spyOn(Alert, "alert").mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
  // Defaults: no PIN, not logged in, no children
  jest.spyOn(database, "getSetting").mockResolvedValue(null);
  jest.spyOn(database, "setSetting").mockResolvedValue(undefined);
  jest.spyOn(api, "isLoggedIn").mockResolvedValue(false);
  jest.spyOn(api, "login").mockResolvedValue({ token: "test-token" });
  jest.spyOn(api, "logout").mockResolvedValue(undefined);
  jest.spyOn(sync, "syncAll").mockResolvedValue(undefined);
  jest.spyOn(children, "getChildren").mockResolvedValue([]);
  jest.spyOn(rewards, "getRewardHistory").mockResolvedValue([]);
  jest.spyOn(rewards, "getAllReadingProgress").mockResolvedValue({});
});

describe("Flow 1: Pertama kali — buat PIN", () => {
  it("langsung tampilkan form buat PIN", async () => {
    render(<ParentScreen />);

    await waitFor(() => {
      expect(screen.getByText("Buat PIN Orang Tua")).toBeTruthy();
      expect(screen.getByText("Masukkan 4 digit angka")).toBeTruthy();
    });
  });

  it("PIN kurang dari 4 digit → alert", async () => {
    render(<ParentScreen />);

    await waitFor(() => screen.getByText("Lanjut"));

    fireEvent.changeText(screen.getByPlaceholderText("----"), "12");
    fireEvent.press(screen.getByText("Lanjut"));

    expect(Alert.alert).toHaveBeenCalledWith("PIN harus 4 digit");
  });

  it("PIN 4 digit → lanjut ke konfirmasi", async () => {
    render(<ParentScreen />);

    await waitFor(() => screen.getByText("Lanjut"));

    fireEvent.changeText(screen.getByPlaceholderText("----"), "1234");
    fireEvent.press(screen.getByText("Lanjut"));

    await waitFor(() => {
      expect(screen.getByText("Konfirmasi PIN")).toBeTruthy();
      expect(screen.getByText("Simpan")).toBeTruthy();
    });
  });

  it("konfirmasi PIN tidak cocok → alert", async () => {
    render(<ParentScreen />);

    await waitFor(() => screen.getByText("Lanjut"));

    fireEvent.changeText(screen.getByPlaceholderText("----"), "1234");
    fireEvent.press(screen.getByText("Lanjut"));

    await waitFor(() => screen.getByText("Simpan"));

    fireEvent.changeText(screen.getByPlaceholderText("----"), "5678");
    fireEvent.press(screen.getByText("Simpan"));

    expect(Alert.alert).toHaveBeenCalledWith("PIN tidak cocok");
  });

  it("konfirmasi cocok → simpan PIN → masuk dashboard", async () => {
    render(<ParentScreen />);

    await waitFor(() => screen.getByText("Lanjut"));

    fireEvent.changeText(screen.getByPlaceholderText("----"), "1234");
    fireEvent.press(screen.getByText("Lanjut"));

    await waitFor(() => screen.getByText("Simpan"));

    fireEvent.changeText(screen.getByPlaceholderText("----"), "1234");
    fireEvent.press(screen.getByText("Simpan"));

    await waitFor(() => {
      expect(database.setSetting).toHaveBeenCalledWith("parent_pin", "1234");
      expect(screen.getByText("Orang Tua")).toBeTruthy(); // dashboard header
    });
  });
});

describe("Flow 2: Sudah ada PIN — gate", () => {
  beforeEach(() => {
    jest.spyOn(database, "getSetting").mockResolvedValue("9876");
  });

  it("tampilkan form masukkan PIN", async () => {
    render(<ParentScreen />);

    await waitFor(() => {
      expect(screen.getByText("Halaman Orang Tua")).toBeTruthy();
      expect(screen.getByText("Masukkan PIN")).toBeTruthy();
    });
  });

  it("PIN salah → alert", async () => {
    render(<ParentScreen />);

    await waitFor(() => screen.getByText("Masuk"));

    fireEvent.changeText(screen.getByPlaceholderText("----"), "0000");
    fireEvent.press(screen.getByText("Masuk"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("PIN salah");
    });
  });

  it("PIN benar → masuk dashboard", async () => {
    render(<ParentScreen />);

    await waitFor(() => screen.getByText("Masuk"));

    fireEvent.changeText(screen.getByPlaceholderText("----"), "9876");
    fireEvent.press(screen.getByText("Masuk"));

    await waitFor(() => {
      expect(screen.getByText("Akun")).toBeTruthy(); // dashboard section
    });
  });

  it("tombol Kembali → router.back()", async () => {
    render(<ParentScreen />);

    await waitFor(() => screen.getByText("Kembali"));
    fireEvent.press(screen.getByText("Kembali"));

    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe("Flow 3: Dashboard", () => {
  beforeEach(() => {
    // Skip PIN — no PIN set, goes straight to set_pin then dashboard
    // Simpler: mock so it goes to dashboard directly
    jest.spyOn(database, "getSetting").mockImplementation(async (key: string) => {
      if (key === "parent_pin") return null; // triggers set_pin flow
      return null;
    });
  });

  async function goToDashboard() {
    render(<ParentScreen />);

    // Complete PIN setup
    await waitFor(() => screen.getByText("Lanjut"));
    fireEvent.changeText(screen.getByPlaceholderText("----"), "1111");
    fireEvent.press(screen.getByText("Lanjut"));
    await waitFor(() => screen.getByText("Simpan"));
    fireEvent.changeText(screen.getByPlaceholderText("----"), "1111");
    fireEvent.press(screen.getByText("Simpan"));
    await waitFor(() => screen.getByText("Akun"));
  }

  it("belum login → tampilkan form username/password", async () => {
    await goToDashboard();

    expect(screen.getByPlaceholderText("Username")).toBeTruthy();
    expect(screen.getByPlaceholderText("Password")).toBeTruthy();
    expect(screen.getByText("Login")).toBeTruthy();
  });

  it("login berhasil → tampilkan Sudah login + Logout", async () => {
    jest.spyOn(api, "isLoggedIn")
      .mockResolvedValueOnce(false) // initial load
      .mockResolvedValueOnce(true); // after login

    await goToDashboard();

    fireEvent.changeText(screen.getByPlaceholderText("Username"), "parent");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "pass123");
    fireEvent.press(screen.getByText("Login"));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith("parent", "pass123");
      expect(screen.getByText("Sudah login")).toBeTruthy();
      expect(screen.getByText("Logout")).toBeTruthy();
    });
  });

  it("login gagal → alert error", async () => {
    jest.spyOn(api, "login").mockRejectedValue(new Error("Username atau password salah"));

    await goToDashboard();

    fireEvent.changeText(screen.getByPlaceholderText("Username"), "bad");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "wrong");
    fireEvent.press(screen.getByText("Login"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Login Gagal", "Username atau password salah");
    });
  });

  it("tampilkan daftar anak-anak", async () => {
    jest.spyOn(children, "getChildren").mockResolvedValue([
      { id: 1, name: "Ahmad", avatarColor: "#E91E63", coins: 15, stars: 8, age: 5 },
      { id: 2, name: "Fatimah", avatarColor: "#9C27B0", coins: 10, stars: 4, age: 7 },
    ]);

    await goToDashboard();

    await waitFor(() => {
      expect(screen.getByText("Ahmad")).toBeTruthy();
      expect(screen.getByText("Fatimah")).toBeTruthy();
      expect(screen.getByText("15 koin · 8 bintang")).toBeTruthy();
      expect(screen.getByText("10 koin · 4 bintang")).toBeTruthy();
    });
  });

  it("tekan anak → lihat detail progress", async () => {
    jest.spyOn(children, "getChildren").mockResolvedValue([
      { id: 1, name: "Ahmad", avatarColor: "#E91E63", coins: 15, stars: 8, age: 5 },
    ]);
    jest.spyOn(rewards, "getAllReadingProgress").mockResolvedValue({
      "1": { lastPage: 5, completed: true, completedCount: 1 },
      "3": { lastPage: 2, completed: false, completedCount: 0 },
    });
    jest.spyOn(rewards, "getRewardHistory").mockResolvedValue([
      { id: 1, childId: 1, type: "coin", count: 3, description: "Baca: Singa Alloh", createdAt: "2026-03-13" },
    ]);

    await goToDashboard();

    await waitFor(() => screen.getByText("Ahmad"));
    fireEvent.press(screen.getByText("Ahmad"));

    await waitFor(() => {
      expect(screen.getByText("Detail: Ahmad")).toBeTruthy();
      expect(screen.getByText("Buku dibaca: 2")).toBeTruthy();
      expect(screen.getByText("Buku selesai: 1")).toBeTruthy();
      expect(screen.getByText("Koin +3")).toBeTruthy();
      expect(screen.getByText("Baca: Singa Alloh")).toBeTruthy();
    });
  });

  it("tampilkan versi app", async () => {
    await goToDashboard();

    await waitFor(() => {
      expect(screen.getByText("Aplikasi")).toBeTruthy();
    });
  });

  describe("Tambah anak — validasi", () => {
    it("nama kosong → alert, addChild tidak dipanggil", async () => {
      const spy = jest.spyOn(children, "addChild").mockResolvedValue({
        id: 1, name: "Test", avatarColor: "#E91E63", coins: 0, stars: 0,
      });

      await goToDashboard();

      await waitFor(() => screen.getByText("+ Tambah"));
      fireEvent.press(screen.getByText("+ Tambah"));
      await waitFor(() => screen.getByText("Tambah Anak"));

      // Don't type anything in nama
      fireEvent.press(screen.getByText("Tambah Anak"));

      expect(Alert.alert).toHaveBeenCalledWith("Nama anak harus diisi");
      expect(spy).not.toHaveBeenCalled();
    });

    it("umur bukan angka → alert", async () => {
      const spy = jest.spyOn(children, "addChild").mockResolvedValue({
        id: 1, name: "Test", avatarColor: "#E91E63", coins: 0, stars: 0,
      });

      await goToDashboard();

      await waitFor(() => screen.getByText("+ Tambah"));
      fireEvent.press(screen.getByText("+ Tambah"));
      await waitFor(() => screen.getByText("Tambah Anak"));

      fireEvent.changeText(screen.getByPlaceholderText("Nama anak"), "Zaid");
      fireEvent.changeText(screen.getByPlaceholderText("Umur (opsional)"), "abc");
      fireEvent.press(screen.getByText("Tambah Anak"));

      expect(Alert.alert).toHaveBeenCalledWith("Umur harus antara 1-17 tahun");
      expect(spy).not.toHaveBeenCalled();
    });

    it("nama valid + umur kosong → addChild dipanggil (umur opsional)", async () => {
      jest.spyOn(children, "addChild").mockResolvedValue({
        id: 1, name: "Zaid", avatarColor: "#E91E63", coins: 0, stars: 0,
      });

      await goToDashboard();

      await waitFor(() => screen.getByText("+ Tambah"));
      fireEvent.press(screen.getByText("+ Tambah"));
      await waitFor(() => screen.getByText("Tambah Anak"));

      fireEvent.changeText(screen.getByPlaceholderText("Nama anak"), "Zaid");
      fireEvent.press(screen.getByText("Tambah Anak"));

      await waitFor(() => {
        expect(children.addChild).toHaveBeenCalledWith("Zaid", undefined);
      });
    });

    it("nama valid + umur valid → addChild dipanggil dengan age number", async () => {
      jest.spyOn(children, "addChild").mockResolvedValue({
        id: 1, name: "Zaid", avatarColor: "#E91E63", coins: 0, stars: 0, age: 5,
      });

      await goToDashboard();

      await waitFor(() => screen.getByText("+ Tambah"));
      fireEvent.press(screen.getByText("+ Tambah"));
      await waitFor(() => screen.getByText("Tambah Anak"));

      fireEvent.changeText(screen.getByPlaceholderText("Nama anak"), "Zaid");
      fireEvent.changeText(screen.getByPlaceholderText("Umur (opsional)"), "5");
      fireEvent.press(screen.getByText("Tambah Anak"));

      await waitFor(() => {
        expect(children.addChild).toHaveBeenCalledWith("Zaid", 5);
      });
    });
  });
});
