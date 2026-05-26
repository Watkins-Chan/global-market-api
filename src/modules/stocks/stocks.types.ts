export interface StockInsightItem {
  category: string;
  title: string;
  summary: string;
}

export interface StockInsightsResponse {
  items: StockInsightItem[];
  generatedAt: string;
}

export interface StockNewsItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  time: string;
  source?: string;
  url?: string;
}

export interface StockNewsResponse {
  items: StockNewsItem[];
  generatedAt: string;
}

export interface StocksPageAssetItem {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  logo?: string;
  sector?: string;
  industry?: string;
  country?: string;
  countryCode?: string;
  currency?: string;
  price: number;
  priceFormatted: string;
  change24h: number;
  marketCap?: number;
  marketCapFormatted?: string;
  weekChange?: number;
  monthChange?: number;
  ytdChange?: number;
  sparkline: number[];
}

export interface StocksIndexItem {
  name: string;
  value: string;
  change: number;
}

export interface StocksSectorItem {
  name: string;
  change: number;
  desc: string;
}

export interface StocksOverviewResponse {
  indices: StocksIndexItem[];
  sectors: StocksSectorItem[];
  generatedAt: string;
}

export interface StocksAssetsResponse {
  items: StocksPageAssetItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  generatedAt: string;
}

export interface StocksTopMoversResponse {
  gainers: StocksPageAssetItem[];
  losers: StocksPageAssetItem[];
  generatedAt: string;
}

export interface StocksFilterBucket {
  name: string;
  code?: string;
}

export interface StocksFiltersResponse {
  sectors: StocksFilterBucket[];
  industries: StocksFilterBucket[];
  countries: StocksFilterBucket[];
  generatedAt: string;
}

export interface StocksCountriesResponse {
  items: StocksFilterBucket[];
  generatedAt: string;
}
