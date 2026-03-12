import type { Article } from "../types";

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

const allArticles: Article[] = [
  a112, a209, a1176, a1218, a1255,
  a1379, a1675, a1777, a7416, a8457,
] as Article[];

export function getAllArticles(): Article[] {
  return allArticles;
}

export function getArticle(id: string): Article | null {
  return allArticles.find((a) => a.id === id) ?? null;
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
