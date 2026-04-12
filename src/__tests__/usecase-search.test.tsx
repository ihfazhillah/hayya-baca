/**
 * Use case: Anak mencari buku/artikel dari screen search unified.
 */
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react-native";

const mockRouter = (global as any).__mockRouter;

import * as session from "../lib/session";

jest.spyOn(session, "getSelectedChild").mockReturnValue({
  id: 1,
  name: "Ahmad",
  age: 7,
});

const mockSearchContent = jest.fn();
const mockSearchSuggest = jest.fn();
const mockLogSearchClick = jest.fn();

jest.mock("../lib/api", () => ({
  searchContent: (...args: any[]) => mockSearchContent(...args),
  searchSuggest: (...args: any[]) => mockSearchSuggest(...args),
  logSearchClick: (...args: any[]) => mockLogSearchClick(...args),
}));

import SearchScreen from "../../app/search";

function renderScreen() {
  return render(<SearchScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockSearchContent.mockResolvedValue([]);
  mockSearchSuggest.mockResolvedValue([]);
  mockLogSearchClick.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
  cleanup();
});

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceDebounce() {
  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Search — empty state", () => {
  it("mount → memanggil searchSuggest('') untuk pencarian populer", async () => {
    mockSearchSuggest.mockResolvedValue([
      { phrase: "nabi muhammad", source: "user_query" },
    ]);
    renderScreen();
    await flushPromises();
    expect(mockSearchSuggest).toHaveBeenCalledWith("");
    await waitFor(() => {
      expect(screen.getByText(/Pencarian populer/i)).toBeTruthy();
      expect(screen.getByText("nabi muhammad")).toBeTruthy();
    });
  });
});

describe("Search — mengetik query", () => {
  it("query >= 2 huruf → panggil searchContent & searchSuggest setelah debounce", async () => {
    mockSearchContent.mockResolvedValue([
      {
        slug: "nabi-muhammad",
        type: "book",
        title: "Nabi Muhammad",
        categories: [],
        coverUrl: null,
        alreadyRead: false,
        score: 100,
      },
    ]);
    renderScreen();
    await flushPromises();

    const input = screen.getByTestId("search-input");
    fireEvent.changeText(input, "nabi");
    await advanceDebounce();

    expect(mockSearchContent).toHaveBeenCalledWith("nabi", 1);
    expect(mockSearchSuggest).toHaveBeenCalledWith("nabi");
    await waitFor(() => {
      expect(screen.getByText("Nabi Muhammad")).toBeTruthy();
      expect(screen.getByText("BUKU")).toBeTruthy();
    });
  });

  it("0 hasil → empty state muncul", async () => {
    mockSearchContent.mockResolvedValue([]);
    renderScreen();
    await flushPromises();

    fireEvent.changeText(screen.getByTestId("search-input"), "xyzzz");
    await advanceDebounce();

    await waitFor(() => {
      expect(screen.getByText(/Tidak ditemukan/i)).toBeTruthy();
    });
  });

  it("error network → pesan ramah anak", async () => {
    mockSearchContent.mockRejectedValue(new Error("network"));
    renderScreen();
    await flushPromises();

    fireEvent.changeText(screen.getByTestId("search-input"), "nabi");
    await advanceDebounce();

    await waitFor(() => {
      expect(screen.getByText(/Perlu internet/i)).toBeTruthy();
    });
  });
});

describe("Search — tap hasil", () => {
  it("tap hasil book → logSearchClick + router.push /read/[slug]", async () => {
    mockSearchContent.mockResolvedValue([
      {
        slug: "nabi-muhammad",
        type: "book",
        title: "Nabi Muhammad",
        categories: [],
        coverUrl: null,
        alreadyRead: false,
        score: 100,
      },
    ]);
    renderScreen();
    await flushPromises();

    fireEvent.changeText(screen.getByTestId("search-input"), "nabi");
    await advanceDebounce();

    await waitFor(() => screen.getByText("Nabi Muhammad"));
    fireEvent.press(screen.getByText("Nabi Muhammad"));

    expect(mockLogSearchClick).toHaveBeenCalledWith(
      1,
      "nabi",
      "nabi-muhammad",
      "book"
    );
    expect(mockRouter.push).toHaveBeenCalledWith("/read/nabi-muhammad");
  });

  it("tap hasil article → router.push /article/[slug]", async () => {
    mockSearchContent.mockResolvedValue([
      {
        slug: "article-112",
        type: "article",
        title: "Lelaki Anshar",
        categories: [],
        coverUrl: null,
        alreadyRead: true,
        score: 50,
      },
    ]);
    renderScreen();
    await flushPromises();

    fireEvent.changeText(screen.getByTestId("search-input"), "lelaki");
    await advanceDebounce();

    await waitFor(() => screen.getByText("Lelaki Anshar"));
    // Already-read badge visible
    expect(screen.getByText(/Pernah dibaca/i)).toBeTruthy();

    fireEvent.press(screen.getByText("Lelaki Anshar"));
    expect(mockRouter.push).toHaveBeenCalledWith("/article/article-112");
  });
});
