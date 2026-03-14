/**
 * Use case: Anak main game → koin dikurangi → WebView tampil
 *
 * 1. Game dimuat, koin dikurangi, WebView tampil
 * 2. Koin tidak cukup → error ditampilkan
 * 3. Timer countdown
 * 4. Sesi aktif → resume tanpa charge ulang
 * 5. Sesi expired → charge koin lagi
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react-native";

// --- Mocks ---

const mockRouter = (global as any).__mockRouter;
const { useLocalSearchParams } = require("expo-router");

// Mock API
const mockFetchGames = jest.fn();
jest.mock("../../src/lib/api", () => ({
  fetchGames: (...args: any[]) => mockFetchGames(...args),
}));

// Mock children
const mockGetChildren = jest.fn();
const mockUpdateChildCoins = jest.fn().mockResolvedValue(undefined);
jest.mock("../../src/lib/children", () => ({
  getChildren: (...args: any[]) => mockGetChildren(...args),
  updateChildCoins: (...args: any[]) => mockUpdateChildCoins(...args),
}));

// Mock rewards — spy target
const mockAddReward = jest.fn().mockResolvedValue(undefined);
jest.mock("../../src/lib/rewards", () => ({
  addReward: (...args: any[]) => mockAddReward(...args),
}));

// Mock session
const mockGetSelectedChild = jest.fn();
jest.mock("../../src/lib/session", () => ({
  getSelectedChild: () => mockGetSelectedChild(),
}));

// Mock game session — spy targets
const mockGetActiveSession = jest.fn();
const mockCreateSession = jest.fn();
const mockEndSession = jest.fn();
jest.mock("../../src/lib/game-session", () => ({
  getActiveSession: (...args: any[]) => mockGetActiveSession(...args),
  createSession: (...args: any[]) => mockCreateSession(...args),
  endSession: (...args: any[]) => mockEndSession(...args),
}));

// Mock WebView
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return {
    WebView: (props: any) => <View testID="webview" {...props} />,
  };
});

// --- Test data ---

const testGame = {
  slug: "dino-jump",
  title: "Dino Jump",
  description: "Jump over obstacles",
  icon: "dino.png",
  category: "arcade",
  difficulty: "easy",
  coin_cost: 2,
  session_minutes: 5,
  min_age: 5,
  bundle_version: 1,
  bundle_url: "https://games.example.com/dino-jump/index.html",
};

const testChild = { id: 1, name: "Ahmad", age: 7 };

// Import screen after mocks
import GamePlayScreen from "../../app/game/[gameId]";

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockGetSelectedChild.mockReturnValue(testChild);
  useLocalSearchParams.mockReturnValue({ gameId: "dino-jump" });
  // Default: no active session
  mockGetActiveSession.mockResolvedValue(null);
  mockCreateSession.mockResolvedValue({
    childId: 1,
    gameSlug: "dino-jump",
    expiresAt: Date.now() + 5 * 60 * 1000,
    serverSessionId: null,
  });
  mockEndSession.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// --- Existing tests ---

describe("Game dimuat, koin dikurangi, WebView tampil", () => {
  it("load game → deduct coins → show WebView + timer", async () => {
    mockFetchGames.mockResolvedValue([testGame]);
    mockGetChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", avatarColor: "#E91E63", coins: 5, stars: 0 },
    ]);

    render(<GamePlayScreen />);

    await waitFor(() => {
      expect(screen.getByText("Dino Jump")).toBeTruthy();
    });

    // SPY: updateChildCoins called to deduct coins locally (no reward_history entry)
    expect(mockUpdateChildCoins).toHaveBeenCalledWith(1, -2);

    // WebView should be rendered
    expect(screen.getByTestId("webview")).toBeTruthy();

    // Timer should show 5:00
    expect(screen.getByText("5:00")).toBeTruthy();
  });
});

describe("Koin tidak cukup → error ditampilkan", () => {
  it("coins=0 → error message, addReward NOT called", async () => {
    mockFetchGames.mockResolvedValue([testGame]);
    mockGetChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", avatarColor: "#E91E63", coins: 0, stars: 0 },
    ]);

    render(<GamePlayScreen />);

    await waitFor(() => {
      expect(screen.getByText("Koin tidak cukup (perlu 2, punya 0)")).toBeTruthy();
    });

    expect(mockUpdateChildCoins).not.toHaveBeenCalled();
  });

  it("coins=1 (kurang dari cost=2) → error", async () => {
    mockFetchGames.mockResolvedValue([testGame]);
    mockGetChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", avatarColor: "#E91E63", coins: 1, stars: 0 },
    ]);

    render(<GamePlayScreen />);

    await waitFor(() => {
      expect(screen.getByText("Koin tidak cukup (perlu 2, punya 1)")).toBeTruthy();
    });

    expect(mockUpdateChildCoins).not.toHaveBeenCalled();
  });
});

describe("Timer countdown", () => {
  it("timer counts down from session_minutes", async () => {
    mockFetchGames.mockResolvedValue([testGame]);
    mockGetChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", avatarColor: "#E91E63", coins: 5, stars: 0 },
    ]);

    render(<GamePlayScreen />);

    await waitFor(() => {
      expect(screen.getByText("5:00")).toBeTruthy();
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText("4:59")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(59000);
    });

    expect(screen.getByText("4:00")).toBeTruthy();
  });
});

// --- Session tracking tests (should FAIL before fix) ---

describe("Sesi game: tidak double-charge", () => {
  it("pertama kali main → charge koin + buat sesi baru", async () => {
    mockFetchGames.mockResolvedValue([testGame]);
    mockGetChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", avatarColor: "#E91E63", coins: 5, stars: 0 },
    ]);

    render(<GamePlayScreen />);

    await waitFor(() => {
      expect(screen.getByText("Dino Jump")).toBeTruthy();
    });

    // SPY: should check for active session first
    expect(mockGetActiveSession).toHaveBeenCalledWith(1, "dino-jump");

    // SPY: should deduct coins locally (no active session)
    expect(mockUpdateChildCoins).toHaveBeenCalledWith(1, -2);

    // SPY: should create a new session
    expect(mockCreateSession).toHaveBeenCalledWith(1, "dino-jump", 5);
  });

  it("sesi masih aktif → resume tanpa charge, timer sisa waktu", async () => {
    mockFetchGames.mockResolvedValue([testGame]);
    // Return active session with 3 minutes remaining (+1s buffer for async rounding)
    const expiresAt = Date.now() + 3 * 60 * 1000 + 1000;
    mockGetActiveSession.mockResolvedValue({
      childId: 1,
      gameSlug: "dino-jump",
      expiresAt,
      serverSessionId: null,
    });

    render(<GamePlayScreen />);

    await waitFor(() => {
      expect(screen.getByText("Dino Jump")).toBeTruthy();
    });

    // SPY: should NOT deduct coins
    expect(mockUpdateChildCoins).not.toHaveBeenCalled();

    // SPY: should NOT create new session
    expect(mockCreateSession).not.toHaveBeenCalled();

    // SPY: should NOT call getChildren (no need to check balance)
    expect(mockGetChildren).not.toHaveBeenCalled();

    // Timer shows remaining time (~3:00)
    expect(screen.getByText("3:00")).toBeTruthy();

    // WebView should still render
    expect(screen.getByTestId("webview")).toBeTruthy();
  });

  it("sesi expired (getActiveSession null) → charge koin lagi", async () => {
    mockFetchGames.mockResolvedValue([testGame]);
    mockGetChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", avatarColor: "#E91E63", coins: 5, stars: 0 },
    ]);
    // No active session (expired ones filtered out by DB)
    mockGetActiveSession.mockResolvedValue(null);

    render(<GamePlayScreen />);

    await waitFor(() => {
      expect(screen.getByText("Dino Jump")).toBeTruthy();
    });

    // Should charge again
    expect(mockUpdateChildCoins).toHaveBeenCalledWith(1, -2);
    expect(mockCreateSession).toHaveBeenCalledWith(1, "dino-jump", 5);
  });
});

describe("Timer habis → endSession dipanggil", () => {
  it("timer reaches 0 → endSession called to notify server", async () => {
    mockFetchGames.mockResolvedValue([testGame]);
    mockGetChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", avatarColor: "#E91E63", coins: 5, stars: 0 },
    ]);

    render(<GamePlayScreen />);

    await waitFor(() => {
      expect(screen.getByText("5:00")).toBeTruthy();
    });

    // Fast-forward timer to 0
    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(screen.getByText("Waktu habis!")).toBeTruthy();
    expect(mockEndSession).toHaveBeenCalledWith(1, "dino-jump");
  });

  it("endSession NOT called on initial mount (secondsLeft starts at 0)", async () => {
    // Game not found → secondsLeft stays 0 but endSession should NOT fire
    mockFetchGames.mockResolvedValue([]);

    render(<GamePlayScreen />);

    await waitFor(() => {
      expect(screen.getByText("Permainan tidak ditemukan")).toBeTruthy();
    });

    expect(mockEndSession).not.toHaveBeenCalled();
  });
});
