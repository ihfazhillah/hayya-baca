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
