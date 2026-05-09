export interface CryptoPageAssetItem {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  category?: string;
  ecosystem?: string;
  price: number;
  priceFormatted: string;
  change24h: number;
  marketCap?: number;
  marketCapFormatted?: string;
  volume24h?: number;
  volume24hFormatted?: string;
  weekChange?: number;
  monthChange?: number;
  ytdChange?: number;
  rank?: number;
  sparkline: number[];
}

export interface CryptoOverviewItem {
  label: string;
  value: string;
  change: number;
}

export interface CryptoOverviewResponse {
  items: CryptoOverviewItem[];
  generatedAt: string;
}

export interface CryptoEcosystemItem {
  name: string;
  desc: string;
  change: number;
}

export interface CryptoEcosystemsResponse {
  items: CryptoEcosystemItem[];
  generatedAt: string;
}

export interface CryptoAssetsResponse {
  items: CryptoPageAssetItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  generatedAt: string;
}

export interface CryptoTopMoversResponse {
  gainers: CryptoPageAssetItem[];
  losers: CryptoPageAssetItem[];
  generatedAt: string;
}

export interface CryptoFilterBucket {
  name: string;
  count: number;
}

export interface CryptoFiltersResponse {
  categories: CryptoFilterBucket[];
  generatedAt: string;
}
