export type CommodityDetailTimeframe = "1D" | "7D" | "30D" | "90D" | "1Y" | "MAX";

export interface CommodityDetailPerformancePoint {
  period: "1D" | "1W" | "1M" | "1Y";
  change: number;
}

export interface CommodityDetailQuickFact {
  label: string;
  value: string;
}

export interface CommodityDetailRelatedItem {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  marketType: "commodity";
  priceFormatted: string;
  change24h: number;
  logo?: string;
  sparkline?: number[];
}

export interface CommodityDetailNewsItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  time: string;
  source?: string;
  url?: string;
}

export interface CommodityDetailResponse {
  id: string;
  symbol: string;
  slug: string;
  name: string;
  logo?: string;
  description: string;
  group: string;
  groupLabel: string;
  unit?: string;
  benchmark?: string;
  category: string;
  currency: string;
  marketType: "commodity";

  price: number;
  priceFormatted: string;
  change24h: number;

  contextTitle: string;
  contextBody: string;
  narrative: string;
  groupNarrative: string;

  quickFacts: CommodityDetailQuickFact[];
  metrics: Record<string, string>;
  performance: CommodityDetailPerformancePoint[];

  related: CommodityDetailRelatedItem[];
  news: CommodityDetailNewsItem[];

  twelveDataSymbol: string;
  twelveDataAvailable: boolean;

  generatedAt: string;
}

export interface CommodityDetailChartPoint {
  label: string;
  datetime: string;
  price: number;
  volume: number;
}

export interface CommodityDetailChartResponse {
  symbol: string;
  twelveDataSymbol: string;
  exchange: string;
  currency: string;
  timeframe: CommodityDetailTimeframe;
  interval: string;
  source: "twelve-data";
  labels: string[];
  prices: number[];
  volumes: number[];
  points: CommodityDetailChartPoint[];
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
  avgVolume: string;
  generatedAt: string;
}

export interface CommodityDetailNewsResponse {
  items: CommodityDetailNewsItem[];
  generatedAt: string;
}

export interface CommodityDetailRelatedResponse {
  items: CommodityDetailRelatedItem[];
  generatedAt: string;
}
