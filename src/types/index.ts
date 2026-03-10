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

export interface RewardHistory {
  id: number;
  childId: number;
  type: "coin" | "star";
  count: number;
  description: string;
  createdAt: string;
}
