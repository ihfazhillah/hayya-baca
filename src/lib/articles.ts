import type { Article, ArticleQuizQuestion } from "../types";
import {
  fetchArticleList,
  fetchArticleDetail,
  ServerArticleDetail,
  ServerArticleListItem,
} from "./api";

// Bundled articles (fallback when offline)
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

// Cache for server articles
let cachedList: Article[] | null = null;
const detailCache = new Map<string, Article>();

function serverDetailToArticle(detail: ServerArticleDetail): Article {
  // Convert sections to flat content string (for existing article screen)
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

function serverListToArticleSummary(item: ServerArticleListItem): Article {
  return {
    id: String(item.id),
    title: item.title,
    source: "",
    category: item.categories || [],
    content: "",
    quiz: [],
  };
}

export async function fetchAllArticles(): Promise<Article[]> {
  if (cachedList) return cachedList;
  try {
    const list = await fetchArticleList();
    cachedList = list.map(serverListToArticleSummary);
    return cachedList;
  } catch {
    return bundledArticles;
  }
}

export async function fetchArticle(id: string): Promise<Article | null> {
  // Check detail cache
  const cached = detailCache.get(id);
  if (cached) return cached;

  // Check bundled
  const bundled = bundledArticles.find((a) => a.id === id);

  try {
    const detail = await fetchArticleDetail(Number(id));
    const article = serverDetailToArticle(detail);
    detailCache.set(id, article);
    return article;
  } catch {
    return bundled ?? null;
  }
}

// Sync versions (for backward compat with existing code that doesn't use async)
export function getAllArticles(): Article[] {
  return cachedList ?? bundledArticles;
}

export function getArticle(id: string): Article | null {
  return detailCache.get(id) ?? bundledArticles.find((a) => a.id === id) ?? null;
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
