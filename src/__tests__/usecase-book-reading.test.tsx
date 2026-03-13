/**
 * Use case: Anak baca buku → halaman per halaman → celebrate
 *
 * 1. Buku dimuat, halaman pertama ditampilkan
 * 2. Read-to-me: semua kata di-highlight → halaman selesai
 * 3. Navigate ke halaman terakhir → selesai buku → celebrate
 * 4. Reward save gagal → tetap navigate
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";

// --- Mocks ---

const mockRouter = (global as any).__mockRouter;
const { useLocalSearchParams } = require("expo-router");

// Mock books module
const mockGetBookContent = jest.fn();
jest.mock("../../src/lib/books", () => ({
  getBookContent: (...args: any[]) => mockGetBookContent(...args),
}));

// Mock rewards — spy targets
const mockAddReward = jest.fn().mockResolvedValue(undefined);
const mockSaveReadingProgress = jest.fn().mockResolvedValue(undefined);
jest.mock("../../src/lib/rewards", () => ({
  addReward: (...args: any[]) => mockAddReward(...args),
  saveReadingProgress: (...args: any[]) => mockSaveReadingProgress(...args),
}));

// Mock session
const mockGetSelectedChild = jest.fn();
jest.mock("../../src/lib/session", () => ({
  getSelectedChild: () => mockGetSelectedChild(),
}));

// Mock speech — track speakPage calls, capture onDone callback
let speakPageOnDone: (() => void) | undefined;
const mockSpeakPage = jest.fn().mockImplementation(
  (_text: string, _onWord: any, onDone: () => void) => {
    speakPageOnDone = onDone;
  }
);
const mockSpeakWord = jest.fn();
const mockStopSpeaking = jest.fn();
const mockCalculateStars = jest.fn();
const mockCalculateCoins = jest.fn();

jest.mock("../../src/lib/speech", () => ({
  speakWord: (...args: any[]) => mockSpeakWord(...args),
  speakPage: (...args: any[]) => mockSpeakPage(...args),
  stopSpeaking: (...args: any[]) => mockStopSpeaking(...args),
  calculateStars: (...args: any[]) => mockCalculateStars(...args),
  calculateCoins: (...args: any[]) => mockCalculateCoins(...args),
  isNonIndonesian: () => false,
  isWordMatch: () => false,
}));

jest.mock("../../src/lib/tts", () => ({
  speakWord: jest.fn(),
  speakPage: (...args: any[]) => mockSpeakPage(...args),
  stopSpeaking: (...args: any[]) => mockStopSpeaking(...args),
}));

// Mock useSpeechRecognition hook — controllable state
const mockStartListening = jest.fn();
const mockStopListening = jest.fn();
const mockResetSpeech = jest.fn();
jest.mock("../../src/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    isListening: false,
    currentWordIndex: 0,
    attempts: 0,
    readWords: new Map(),
    start: mockStartListening,
    stop: mockStopListening,
    reset: mockResetSpeech,
  }),
}));

// --- Test data ---

const testBook = {
  id: "6",
  title: "Kisah Buhairo Sang Pendeta",
  coverPath: null,
  referenceAr: null,
  referenceId: null,
  pages: [
    { page: 1, text: "Ini halaman pertama buku." },
    { page: 2, text: "Ini halaman kedua terakhir." },
  ],
};

const testChild = { id: 1, name: "Ahmad", age: 7 };

// Import screen after mocks
import ReadScreen from "../../app/read/[bookId]";

beforeEach(() => {
  jest.clearAllMocks();
  speakPageOnDone = undefined;
  mockGetSelectedChild.mockReturnValue(testChild);
  mockGetBookContent.mockReturnValue(testBook);
  mockCalculateStars.mockReturnValue(4);
  mockCalculateCoins.mockReturnValue(1); // ceil(2/5) = 1
});

// --- Tests ---

describe("Buku dimuat, halaman pertama ditampilkan", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ bookId: "6" });
  });

  it("menampilkan judul, kata-kata, dan nomor halaman", () => {
    render(<ReadScreen />);

    expect(screen.getByText("Kisah Buhairo Sang Pendeta")).toBeTruthy();
    expect(screen.getByText("1/2")).toBeTruthy();
    // Words should be rendered individually
    expect(screen.getByText("Ini")).toBeTruthy();
    expect(screen.getByText("halaman")).toBeTruthy();
  });

  it("menampilkan tombol Saya Baca dan Dengarkan", () => {
    render(<ReadScreen />);

    expect(screen.getByText("Saya Baca")).toBeTruthy();
    expect(screen.getByText("Dengarkan")).toBeTruthy();
  });

  it("buku tidak ditemukan → tampilkan pesan error", () => {
    mockGetBookContent.mockReturnValue(null);
    render(<ReadScreen />);
    expect(screen.getByText("Buku tidak ditemukan")).toBeTruthy();
  });
});

describe("Read-to-me: halaman selesai via Dengarkan", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ bookId: "6" });
  });

  it("press Dengarkan → speakPage called → onDone → pageComplete", async () => {
    render(<ReadScreen />);

    // Press "Dengarkan"
    fireEvent.press(screen.getByText("Dengarkan"));
    expect(mockSpeakPage).toHaveBeenCalledWith(
      "Ini halaman pertama buku.",
      expect.any(Function),
      expect.any(Function)
    );

    // Simulate TTS done
    await act(async () => {
      speakPageOnDone?.();
    });

    // "Lanjut" button should now be enabled (pageComplete = true)
    const lanjutBtn = screen.getByText(/Lanjut/);
    expect(lanjutBtn).toBeTruthy();
  });
});

describe("Navigate ke halaman terakhir → selesai buku → celebrate", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ bookId: "6" });
  });

  it("last page → Selesai → addReward + saveReadingProgress + navigate", async () => {
    render(<ReadScreen />);

    // Complete page 1 via read-to-me
    fireEvent.press(screen.getByText("Dengarkan"));
    await act(async () => {
      speakPageOnDone?.();
    });

    // Go to page 2
    await act(async () => {
      fireEvent.press(screen.getByText(/Lanjut/));
    });

    // Now on page 2 (last page), should show "Selesai"
    expect(screen.getByText("2/2")).toBeTruthy();

    // Complete page 2 via read-to-me
    fireEvent.press(screen.getByText("Dengarkan"));
    await act(async () => {
      speakPageOnDone?.();
    });

    // Press "Selesai"
    await act(async () => {
      fireEvent.press(screen.getByText(/Selesai/));
    });

    // SPY: addReward called with coins
    expect(mockAddReward).toHaveBeenCalledWith(
      1, "coin", 1, "Selesai baca: Kisah Buhairo Sang Pendeta"
    );

    // SPY: saveReadingProgress with correct params
    expect(mockSaveReadingProgress).toHaveBeenCalledWith(
      1, "6", 1, true
    );

    // SPY: router.replace to celebrate
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/celebrate",
      params: expect.objectContaining({
        coins: "1",
        bookTitle: "Kisah Buhairo Sang Pendeta",
      }),
    });
  });
});

describe("Reward save gagal → tetap navigate", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ bookId: "6" });
    mockAddReward.mockRejectedValue(new Error("DB error"));
  });

  it("addReward throws → router.replace still called", async () => {
    render(<ReadScreen />);

    // Complete page 1
    fireEvent.press(screen.getByText("Dengarkan"));
    await act(async () => { speakPageOnDone?.(); });
    await act(async () => { fireEvent.press(screen.getByText(/Lanjut/)); });

    // Complete page 2
    fireEvent.press(screen.getByText("Dengarkan"));
    await act(async () => { speakPageOnDone?.(); });

    // Press Selesai
    await act(async () => {
      fireEvent.press(screen.getByText(/Selesai/));
    });

    // Despite error, should still navigate
    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/celebrate" })
    );
  });
});
