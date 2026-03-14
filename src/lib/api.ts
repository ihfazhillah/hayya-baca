import Constants from "expo-constants";
import { getDatabase } from "./database";
import { getDeviceId, getDeviceName } from "./device";

const API_BASE_DEV = "http://10.0.2.2:8123/api";
const API_BASE_PROD = "https://hayyabaca.ihfazh.com/api";

function getApiBase(): string {
  const override = Constants.expoConfig?.extra?.apiBaseUrl;
  if (override) return override;
  return __DEV__ ? API_BASE_DEV : API_BASE_PROD;
}

async function getToken(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    "auth_token"
  );
  return row?.value ?? null;
}

async function setToken(token: string | null): Promise<void> {
  const db = await getDatabase();
  if (token) {
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      "auth_token",
      token
    );
  } else {
    await db.runAsync("DELETE FROM settings WHERE key = ?", "auth_token");
  }
}

export async function isLoggedIn(): Promise<boolean> {
  return (await getToken()) !== null;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  const deviceId = await getDeviceId();
  const deviceName = getDeviceName();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
    "X-Device-Name": deviceName,
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Token ${token}`;
  }
  return fetch(`${getApiBase()}${path}`, { ...options, headers });
}

export async function login(
  username: string,
  password: string
): Promise<{ token: string }> {
  const res = await apiFetch("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Login gagal");
  }
  const data = await res.json();
  await setToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout/", { method: "POST" });
  } catch {
    // ignore network errors on logout
  }
  await setToken(null);
}

export interface ServerChild {
  id: number;
  name: string;
  age: number | null;
  avatar_color: string;
  coins: number;
  stars: number;
}

export async function fetchChildren(): Promise<ServerChild[]> {
  const res = await apiFetch("/children/");
  if (!res.ok) throw new Error("Failed to fetch children");
  return res.json();
}

export async function createChildOnServer(
  name: string,
  age?: number,
  avatarColor?: string
): Promise<ServerChild> {
  const body: Record<string, unknown> = { name };
  if (age != null) body.age = age;
  if (avatarColor) body.avatar_color = avatarColor;
  const res = await apiFetch("/children/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Gagal menambah anak di server");
  }
  return res.json();
}

export async function pushReadingProgress(
  childId: number,
  data: {
    book: string;
    last_page: number;
    completed: boolean;
    completed_count: number;
  }
): Promise<void> {
  const res = await apiFetch(`/children/${childId}/progress/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("pushReadingProgress failed:", res.status, err);
  }
}

export async function pushRewardsBulk(
  childId: number,
  rewards: { type: string; count: number; description: string; created_at: string; idempotency_key?: string }[]
): Promise<void> {
  const res = await apiFetch(`/children/${childId}/rewards/sync/`, {
    method: "POST",
    body: JSON.stringify({ rewards }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("pushRewardsBulk failed:", res.status, err);
  }
}

export async function pushQuizAttempt(
  childId: number,
  data: { book: string; score: number; total: number }
): Promise<void> {
  const res = await apiFetch(`/children/${childId}/quiz-attempts/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("pushQuizAttempt failed:", res.status, err);
  }
}

// --- Content API (public, no auth) ---

export interface ServerArticleListItem {
  id: number;
  title: string;
  content_type: string;
  categories: string[];
  min_age: number;
  reward_coins: number;
  has_audio: boolean;
  published_version: number;
  quiz_count: number;
}

export interface ServerArticleDetail {
  id: number;
  title: string;
  content_type: string;
  source: string;
  source_url: string;
  categories: string[];
  sections: { order: number; type: string; text: string; items: string[] }[];
  quizzes: {
    type: string;
    question: string;
    options: string[];
    answer: number | boolean;
    explanation: string;
  }[];
}

export async function fetchArticleList(): Promise<ServerArticleListItem[]> {
  const res = await fetch(`${getApiBase()}/books/?type=article`);
  if (!res.ok) throw new Error("Failed to fetch articles");
  return res.json();
}

export async function fetchArticleDetail(
  id: number
): Promise<ServerArticleDetail> {
  const res = await fetch(`${getApiBase()}/books/${id}/`);
  if (!res.ok) throw new Error("Failed to fetch article detail");
  return res.json();
}

// --- Game API (public, no auth) ---

import type { Game, GameSession } from "../types";

export async function fetchGames(): Promise<Game[]> {
  const res = await fetch(`${getApiBase()}/games/`);
  if (!res.ok) throw new Error("Failed to fetch games");
  return res.json();
}

export async function playGame(
  gameSlug: string,
  childId: number
): Promise<GameSession> {
  const res = await apiFetch(`/games/${gameSlug}/play/`, {
    method: "POST",
    body: JSON.stringify({ child_id: childId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Gagal memulai permainan");
  }
  return res.json();
}

export async function extendGameSession(
  gameSlug: string,
  childId: number
): Promise<GameSession> {
  const res = await apiFetch(`/games/${gameSlug}/extend/`, {
    method: "POST",
    body: JSON.stringify({ child_id: childId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Gagal memperpanjang sesi");
  }
  return res.json();
}

export async function endGameSession(sessionId: number): Promise<void> {
  const res = await apiFetch(`/games/sessions/${sessionId}/end/`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("endGameSession failed:", res.status, err);
  }
}
