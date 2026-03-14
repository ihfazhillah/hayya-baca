export interface Child {
  id: number;
  name: string;
  avatarColor: string;
  coins: number;
  stars: number;
  age?: number;
}

export interface Book {
  id: string;
  title: string;
  coverPath: string | null;
  pageCount: number;
  hasAudio: boolean;
  categories?: string[];
}

export interface BookPage {
  page: number;
  text: string;
  audioPath?: string | null;
}

export interface BookContent {
  id: string;
  title: string;
  coverPath: string | null;
  referenceAr?: string | null;
  referenceId?: string | null;
  pages: BookPage[];
}

// Article types (type 2 content — for older kids >6)
export interface ArticleQuizQuestion {
  type: "multiple_choice" | "true_false";
  question: string;
  options?: string[];
  answer: number | boolean; // index for MC, boolean for TF
  explanation: string;
}

export interface Article {
  id: string;
  title: string;
  source: string;
  category: string[];
  slug: string;
  content: string;
  quiz: ArticleQuizQuestion[];
}

export interface RewardHistory {
  id: number;
  childId: number;
  type: "coin" | "star";
  count: number;
  description: string;
  createdAt: string;
}

export interface Game {
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  difficulty: string;
  coin_cost: number;
  session_minutes: number;
  min_age: number;
  bundle_version: number;
  bundle_url: string | null;
}

export interface GameSession {
  id: number;
  child: number;
  game: number;
  coins_spent: number;
  started_at: string;
  expires_at: string;
  score: number | null;
  ended_at: string | null;
}
