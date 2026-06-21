export type ScreenerMarketType = "stock" | "crypto" | "commodity" | "gold";

export interface ScreenerItem {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  marketType: ScreenerMarketType;
  marketLabel: string;
  logo?: string;
  price: number;
  priceFormatted: string;
  change24h: number;
  weekChange: number;
  monthChange: number;
  ytdChange: number;
  marketCap?: number;
  rank?: number;
}

export interface ScreenerResponse {
  items: ScreenerItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  generatedAt: string;
}
