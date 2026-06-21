export type NewsMarket = "stock" | "crypto" | "commodity";

export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  market: NewsMarket;
  category: string;
  source: string;
  sourceUrl: string;
  url: string;
  imageUrl?: string;
  tags: string[];
  symbols: string[];
  publishedAt: string;
  time: string;
}

export interface NewsListResponse {
  items: NewsItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  generatedAt: string;
}

export interface NewsTagCount {
  tag: string;
  count: number;
}

export interface NewsTagsResponse {
  market: "all" | NewsMarket;
  tags: NewsTagCount[];
  generatedAt: string;
}
