export type CryptoDetailTimeframe = "1D" | "7D" | "30D" | "90D" | "1Y" | "MAX";

export interface CryptoDetailPerformancePoint {
  period: "1D" | "1W" | "1M" | "1Y";
  change: number;
}

export interface CryptoDetailQuickFact {
  label: string;
  value: string;
}

export interface CryptoDetailTokenOverview {
  useCase: string;
  consensus: string;
  category: string;
  layer: string;
  summary: string;
}

export interface CryptoDetailResources {
  categories: string[];
  websites: string[];
  sourceCodes: string[];
  whitepapers: string[];
  explorers: string[];
  communities: string[];
}

export interface CryptoDetailKeyStat {
  label: string;
  value: string;
  change?: number;
}

export interface CryptoDetailOnChainData {
  activeAddresses: string;
  whaleActivity: string;
  exchangeFlows: string;
  networkFees: string;
}

export interface CryptoDetailSentiment {
  overall: "bullish" | "bearish" | "neutral";
  socialSentiment: string;
  marketMomentum: string;
  investorPositioning: string;
  summary: string;
}

export interface CryptoDetailRelatedItem {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  marketType: "crypto";
  priceFormatted: string;
  change24h: number;
  logo?: string;
}

export interface CryptoDetailNewsItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  time: string;
  source?: string;
  url?: string;
}

export interface CryptoDetailResponse {
  id: string;
  symbol: string;
  slug: string;
  name: string;
  logo?: string;
  tags: string[];
  description: string;
  category?: string;
  ecosystem?: string;
  currency: string;
  marketType: "crypto";

  price: number;
  priceFormatted: string;
  change24h: number;
  marketCap?: number;
  marketCapFormatted?: string;

  contextTitle: string;
  contextBody: string;
  narrative: string;
  ecosystemNarrative: string;

  quickFacts: CryptoDetailQuickFact[];
  metrics: Record<string, string>;
  performance: CryptoDetailPerformancePoint[];

  tokenOverview: CryptoDetailTokenOverview;
  resources: CryptoDetailResources;
  keyStats: CryptoDetailKeyStat[];
  onChainData: CryptoDetailOnChainData;
  sentiment: CryptoDetailSentiment;

  related: CryptoDetailRelatedItem[];
  news: CryptoDetailNewsItem[];

  twelveDataSymbol: string;
  twelveDataAvailable: boolean;

  generatedAt: string;
}

export interface CryptoDetailChartPoint {
  label: string;
  datetime: string;
  price: number;
  volume: number;
}

export interface CryptoDetailChartResponse {
  symbol: string;
  twelveDataSymbol: string;
  exchange: string;
  currency: string;
  timeframe: CryptoDetailTimeframe;
  interval: string;
  source: "twelve-data";
  labels: string[];
  prices: number[];
  volumes: number[];
  points: CryptoDetailChartPoint[];
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
  avgVolume: string;
  generatedAt: string;
}

export interface CryptoDetailNewsResponse {
  items: CryptoDetailNewsItem[];
  generatedAt: string;
}

export interface CryptoDetailRelatedResponse {
  items: CryptoDetailRelatedItem[];
  generatedAt: string;
}
