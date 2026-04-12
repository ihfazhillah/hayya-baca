export type SearchResultType = "book" | "article";

export type SearchResult = {
  slug: string;
  type: SearchResultType;
  title: string;
  categories: string[];
  coverUrl?: string | null;
  alreadyRead: boolean;
  score: number;
};

export type SuggestionSource = "ngram_title" | "user_query";

export type Suggestion = {
  phrase: string;
  source: SuggestionSource;
};
