export type StockDetailTimeframe = "1D" | "7D" | "30D" | "90D" | "1Y" | "MAX";

export interface StockDetailMetric {
  key: string;
  label: string;
  value: string;
}

export interface StockDetailPerformancePoint {
  period: "1D" | "1W" | "1M" | "1Y";
  change: number;
}

export interface StockDetailCompanyInfo {
  sector: string;
  industry: string;
  headquarters: string;
  ceo: string;
  employees: string;
  founded: string;
  summary: string;
}

export interface StockDetailFundamentals {
  revenue: string;
  netIncome: string;
  operatingMargin: string;
  freeCashFlow: string;
  revenueGrowth: string;
  profitMargin: string;
}

export interface StockDetailQuickFact {
  label: string;
  value: string;
}

export interface StockDetailRelatedItem {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  marketType: "stock";
  priceFormatted: string;
  change24h: number;
  logo?: string;
}

export interface StockDetailNewsItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  time: string;
  source?: string;
  url?: string;
}

export interface StockDetailResponse {
  id: string;
  symbol: string;
  slug: string;
  name: string;
  logo?: string;
  description: string;
  exchange: string;
  exchangeSourceName?: string;
  sector: string;
  industry: string;
  country: string;
  countryCode: string;
  currency: string;
  marketType: "stock";

  price: number;
  priceFormatted: string;
  change24h: number;
  marketCap?: number;
  marketCapFormatted?: string;

  contextTitle: string;
  contextBody: string;
  narrative: string;
  sectorNarrative: string;

  quickFacts: StockDetailQuickFact[];
  metrics: Record<string, string>;
  performance: StockDetailPerformancePoint[];

  companyInfo: StockDetailCompanyInfo;
  fundamentals: StockDetailFundamentals;

  related: StockDetailRelatedItem[];
  news: StockDetailNewsItem[];

  twelveDataSymbol: string;
  twelveDataAvailable: boolean;

  generatedAt: string;
}

export interface StockDetailChartPoint {
  label: string;
  datetime: string;
  price: number;
  volume: number;
}

export interface StockDetailChartResponse {
  symbol: string;
  twelveDataSymbol: string;
  exchange: string;
  currency: string;
  timeframe: StockDetailTimeframe;
  interval: string;
  source: "twelve-data";
  labels: string[];
  prices: number[];
  volumes: number[];
  points: StockDetailChartPoint[];
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
  avgVolume: string;
  generatedAt: string;
}

export interface StockDetailNewsResponse {
  items: StockDetailNewsItem[];
  generatedAt: string;
}

export interface StockDetailRelatedResponse {
  items: StockDetailRelatedItem[];
  generatedAt: string;
}
