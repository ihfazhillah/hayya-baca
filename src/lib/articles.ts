import type { Article, ArticleQuizQuestion } from "../types";
import {
  fetchArticleList,
  fetchArticleDetail,
  ServerArticleDetail,
  ServerArticleListItem,
} from "./api";
import { getDatabase } from "./database";

// Bundled articles (fallback when offline and no cache)
import a112 from "../../content/articles/112-lelaki-anshar-tiga-anak-panah.json";
import a209 from "../../content/articles/209-saad-bin-abi-waqqash.json";
import a1176 from "../../content/articles/1176-cerita-nabi-musa-dengan-batu.json";
import a1218 from "../../content/articles/1218-sedekah-membawa-berkah.json";
import a1255 from "../../content/articles/1255-ibnu-hajar.json";
import a1379 from "../../content/articles/1379-masuk-surga-karena-membuang-duri.json";
import a1675 from "../../content/articles/1675-sejarah-nabi-muhamad.json";
import a1777 from "../../content/articles/1777-rasulullah-bersama-istri-istrinya.json";
import a7416 from "../../content/articles/7416-beberapa-kisah-tidak-sahih-tentang-wafatnya-rasulullah.json";
import a8457 from "../../content/articles/8457-siapakah-nabi-danial.json";

const bundledArticles: Article[] = [
  a112, a209, a1176, a1218, a1255,
  a1379, a1675, a1777, a7416, a8457,
] as Article[];

// In-memory cache (populated from SQLite on first load)
let memoryList: Article[] | null = null;

function serverDetailToArticle(detail: ServerArticleDetail): Article {
  const content = detail.sections
    .map((s) => {
      if (s.type === "heading") return s.text;
      if (s.type === "list") return s.items.join("\n");
      return s.text;
    })
    .join("\n\n");

  const quiz: ArticleQuizQuestion[] = detail.quizzes.map((q) => ({
    type: q.type as "multiple_choice" | "true_false",
    question: q.question,
    options: q.options?.length ? q.options : undefined,
    answer: q.answer,
    explanation: q.explanation,
  }));

  return {
    id: String(detail.id),
    title: detail.title,
    source: detail.source || "",
    category: detail.categories || [],
    content,
    quiz,
  };
}

// --- SQLite cache ---

async function getCachedArticle(id: string): Promise<Article | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ data: string }>(
    "SELECT data FROM cached_articles WHERE id = ?",
    id
  );
  if (!row) return null;
  return JSON.parse(row.data);
}

async function cacheArticle(article: Article): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO cached_articles (id, data, updated_at) VALUES (?, ?, datetime('now'))",
    article.id,
    JSON.stringify(article)
  );
}

async function getCachedList(): Promise<Article[] | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; data: string }>(
    "SELECT id, data FROM cached_articles ORDER BY id"
  );
  if (rows.length === 0) return null;
  return rows.map((r) => JSON.parse(r.data));
}

// --- Public API ---

export async function fetchAllArticles(): Promise<Article[]> {
  // Try server
  try {
    const list = await fetchArticleList();
    const summaries: Article[] = list.map((item) => ({
      id: String(item.id),
      title: item.title,
      source: "",
      category: item.categories || [],
      content: "",
      // Placeholder quiz array with correct length for display count
      quiz: Array.from({ length: item.quiz_count || 0 }, () => ({
        type: "true_false" as const,
        question: "",
        answer: true,
        explanation: "",
      })),
    }));
    memoryList = summaries;
    return summaries;
  } catch {
    // Fallback: cached list or bundled
    const cached = await getCachedList();
    if (cached) {
      memoryList = cached;
      return cached;
    }
    return bundledArticles;
  }
}

export async function fetchArticle(id: string): Promise<Article | null> {
  // Try server first
  try {
    const detail = await fetchArticleDetail(Number(id));
    const article = serverDetailToArticle(detail);
    // Cache to SQLite
    await cacheArticle(article);
    return article;
  } catch {
    // Fallback: SQLite cache
    const cached = await getCachedArticle(id);
    if (cached) return cached;
    // Fallback: bundled
    return bundledArticles.find((a) => a.id === id) ?? null;
  }
}

// Sync versions (for initial render before async completes)
export function getAllArticles(): Article[] {
  return memoryList ?? bundledArticles;
}

export function getArticle(id: string): Article | null {
  return bundledArticles.find((a) => a.id === id) ?? null;
}

export function calculateQuizStars(correct: number, total: number): number {
  if (total === 0) return 0;
  const pct = correct / total;
  if (pct >= 1) return 4;
  if (pct >= 0.75) return 3;
  if (pct >= 0.5) return 2;
  if (pct >= 0.25) return 1;
  return 0;
}
