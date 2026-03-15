import type { Article, ArticleQuizQuestion } from "../types";
import {
  fetchArticleList,
  fetchArticleDetail,
  ServerArticleDetail,
} from "./api";
import { getDatabase } from "./database";
import { getDownloadedContent, getAllDownloadedByType } from "./content-manager";

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

const bundledArticlesRaw = [
  a112, a209, a1176, a1218, a1255,
  a1379, a1675, a1777, a7416, a8457,
] as Article[];

const bundledArticles: Article[] = bundledArticlesRaw.map((a) => ({
  ...a,
  slug: a.slug || `article-${a.id}`,
}));

// Build slug→bundled lookup
const bundledBySlug = new Map<string, Article>();
for (const a of bundledArticles) {
  bundledBySlug.set(a.slug, a);
}

// In-memory caches
let memoryList: Article[] | null = null;
const memoryArticles = new Map<string, Article>();

function downloadedToArticle(data: any): Article {
  return {
    id: data.slug || data.id?.toString() || "",
    title: data.title || "",
    slug: data.slug || "",
    source: data.source || "",
    category: data.category || data.categories || [],
    content: data.content || "",
    quiz: (data.quiz || []).map((q: any) => ({
      type: q.type as "multiple_choice" | "true_false",
      question: q.question,
      options: q.options?.length ? q.options : undefined,
      answer: q.answer,
      explanation: q.explanation,
    })),
  };
}

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
    slug: detail.slug,
    source: detail.source || "",
    category: detail.categories || [],
    content,
    quiz,
  };
}

// --- SQLite cache (legacy, kept for migration) ---

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

// --- Public API ---

/**
 * Get all articles for library display.
 * Resolution: downloaded manifest → server API → cached → bundled.
 */
export async function fetchAllArticles(): Promise<Article[]> {
  // Try downloaded content first (from manifest sync)
  try {
    const downloaded = await getAllDownloadedByType("article");
    if (downloaded.length > 0) {
      const articles = downloaded.map(downloadedToArticle);
      // Merge with bundled (bundled might have articles not yet on server)
      const slugs = new Set(articles.map(a => a.slug));
      for (const b of bundledArticles) {
        if (!slugs.has(b.slug)) articles.push(b);
      }
      memoryList = articles;
      return articles;
    }
  } catch {
    // Fall through
  }

  // Try server API
  try {
    const list = await fetchArticleList();
    const summaries: Article[] = list.map((item) => ({
      id: String(item.id),
      title: item.title,
      slug: item.slug,
      source: "",
      category: item.categories || [],
      content: "",
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
    // Fallback: bundled
    return bundledArticles;
  }
}

/**
 * Get a single article with full content.
 * Resolution: memory → downloaded → server fetch → cached → bundled.
 */
export async function fetchArticle(id: string): Promise<Article | null> {
  // Check memory cache
  const inMemory = memoryArticles.get(id);
  if (inMemory) return inMemory;

  // Check downloaded content by slug
  // The id might be a slug (e.g. "article-112") or a Django PK (e.g. "47")
  // Try both the id directly and look up slug from memoryList
  const slug = findSlugForId(id);
  if (slug) {
    try {
      const downloaded = await getDownloadedContent(slug);
      if (downloaded) {
        const article = downloadedToArticle(downloaded);
        memoryArticles.set(id, article);
        if (slug !== id) memoryArticles.set(slug, article);
        return article;
      }
    } catch {
      // Fall through
    }
  }

  // Try server
  try {
    const detail = await fetchArticleDetail(Number(id));
    const article = serverDetailToArticle(detail);
    await cacheArticle(article);
    memoryArticles.set(article.id, article);
    memoryArticles.set(article.slug, article);
    return article;
  } catch {
    // Fallback: SQLite cache
    const cached = await getCachedArticle(id);
    if (cached) return cached;
    // Fallback: bundled by id
    const byId = bundledArticles.find((a) => a.id === id);
    if (byId) return byId;
    // Fallback: bundled by slug
    if (slug) return bundledBySlug.get(slug) ?? null;
    return null;
  }
}

/**
 * Sync lookup — no network calls.
 * Resolution: memory → downloaded (sync) → bundled.
 */
export function getArticle(id: string): Article | null {
  // Memory cache
  const inMemory = memoryArticles.get(id);
  if (inMemory) return inMemory;

  // Check memoryList (from fetchAllArticles)
  if (memoryList) {
    const fromList = memoryList.find(a => a.id === id || a.slug === id);
    if (fromList && fromList.content) return fromList;
  }

  // Bundled by id
  const byId = bundledArticles.find((a) => a.id === id);
  if (byId) return byId;

  // Bundled by slug
  const slug = findSlugForId(id);
  if (slug) return bundledBySlug.get(slug) ?? null;

  return null;
}

// Sync versions (for library listing)
export function getAllArticles(): Article[] {
  return memoryList ?? bundledArticles;
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

// --- Helpers ---

/**
 * Find the slug for an article ID.
 * The id could be a Django PK ("47") — look up in memoryList to find slug.
 */
function findSlugForId(id: string): string | null {
  // If id looks like a slug already
  if (id.startsWith("article-")) return id;

  // Look up in memoryList
  if (memoryList) {
    const item = memoryList.find(a => a.id === id);
    if (item?.slug) return item.slug;
  }

  // Check bundled
  const bundled = bundledArticles.find(a => a.id === id);
  if (bundled) return bundled.slug;

  return null;
}
