export type HomeMarketType = "stock" | "crypto" | "commodity" | "gold";

export interface HomeAssetItem {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  marketType: HomeMarketType;
  price: number;
  priceFormatted: string;
  currency: string | null;
  change24h: number;
  sparkline: number[];
  contextTitle?: string;
  group?: string;
  market_cap?: number;
  volume?: number;
  logo?: string;
}

export interface HomeSummaryResponse {
  summary: {
    stocks: number;
    cryptos: number;
    commodities: number;
    precious: number;
    totalStockMarketCap: number;
    totalCryptoMarketCap: number;
  };
  generatedAt: string;
}

export interface HomeOverviewMetric {
  key: string;
  label: string;
  value: string;
  rawValue: number;
  change24h: number;
  sparkline: number[];
  isEstimated?: boolean;
  source?: string;
}

export interface HomeOverviewResponse {
  metrics: HomeOverviewMetric[];
  generatedAt: string;
}

export interface HomeMoversResponse {
  market: HomeMarketType;
  gainers: HomeAssetItem[];
  losers: HomeAssetItem[];
  generatedAt: string;
}

export interface HomeLeadersResponse {
  stocks: HomeAssetItem[];
  cryptos: HomeAssetItem[];
  commodities: HomeAssetItem[];
  vietnamGold: HomeAssetItem[];
  /** Backward-compatible alias for `vietnamGold`. */
  precious: HomeAssetItem[];
  generatedAt: string;
}

export interface HomeTrendingResponse {
  market: HomeMarketType;
  items: HomeAssetItem[];
  generatedAt: string;
}

export interface HomeTrendingAssetsResponse {
  tabs: {
    stock: HomeTrendingResponse;
    crypto: HomeTrendingResponse;
    commodity: HomeTrendingResponse;
    gold: HomeTrendingResponse;
  };
  generatedAt: string;
}

export interface HomeNewsItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  time: string;
  market?: string;
  source?: string;
  url?: string;
}

export interface HomeNewsResponse {
  items: HomeNewsItem[];
  generatedAt: string;
}

export interface HomeExploreMarketCard {
  key: "stocks" | "commodities" | "crypto" | "vietnam_gold";
  title: string;
  description: string;
  statLabel: string;
  statValue: string;
  change24h: number;
  route: string;
  source?: string;
}

export interface HomeExploreMarketsResponse {
  cards: HomeExploreMarketCard[];
  generatedAt: string;
}

export interface HomeTickerItem {
  label: string;
  price: string;
  change: number;
  path: string;
  source?: string;
}

export interface HomeTickerResponse {
  items: HomeTickerItem[];
  generatedAt: string;
}

export interface HomeTopMoversResponse {
  tabs: {
    stock: HomeMoversResponse;
    crypto: HomeMoversResponse;
    commodity: HomeMoversResponse;
    gold: HomeMoversResponse;
  };
  generatedAt: string;
}

export interface HomeVietnamGoldMarketItem {
  brandId: string;
  symbol: string;
  name: string;
  slug: string;
  metalType: "gold" | "silver";
  buyPrice: number;
  sellPrice: number;
  spread: number;
  buyPriceFormatted: string;
  sellPriceFormatted: string;
  spreadFormatted: string;
  change24h: number;
  currency: string | null;
  unit?: string;
  logo?: string;
  source?: string;
}

export interface HomeVietnamGoldMarketResponse {
  badge: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaRoute: string;
  items: HomeVietnamGoldMarketItem[];
  stats: {
    goldItems: number;
    silverItems: number;
    averageSpread: number;
    averageSpreadFormatted: string;
  };
  generatedAt: string;
}

export interface HomeResponse {
  generatedAt: string;
  summary: HomeSummaryResponse["summary"];
  overview: HomeOverviewResponse["metrics"];
  ticker: HomeTickerResponse["items"];
  exploreMarkets: HomeExploreMarketsResponse["cards"];
  topMovers: HomeTopMoversResponse["tabs"];
  vietnamGoldMarket: HomeVietnamGoldMarketResponse;
  movers: {
    stock: HomeMoversResponse;
    crypto: HomeMoversResponse;
    commodity: HomeMoversResponse;
    gold: HomeMoversResponse;
  };
  leaders: HomeLeadersResponse;
  trending: {
    stock: HomeTrendingResponse;
    crypto: HomeTrendingResponse;
    commodity: HomeTrendingResponse;
    gold: HomeTrendingResponse;
  };
  news: HomeNewsResponse["items"];
}
