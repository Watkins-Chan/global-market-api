export type CompareMarketType = "stock" | "crypto" | "commodity";

export interface CompareSearchItem {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  marketType: CompareMarketType;
  logo?: string;
  price: number;
  priceFormatted: string;
  change24h: number;
}

export interface CompareSearchResponse {
  items: CompareSearchItem[];
  generatedAt: string;
}

export interface ComparePerformancePoint {
  period: "1D" | "1W" | "1M" | "1Y";
  change: number;
}

export interface CompareAsset {
  key: string;
  id: string;
  symbol: string;
  /** Unique key used as the dataKey in the performance series (handles symbol collisions). */
  chartKey: string;
  name: string;
  slug: string;
  marketType: CompareMarketType;
  logo?: string;
  price: number;
  priceFormatted: string;
  change24h: number;
  currency: string;
  performance: ComparePerformancePoint[];
  metrics: Record<string, string>;
  hasChart: boolean;
}

/** A single point on the merged, normalized (% change vs. base) performance chart. */
export type CompareSeriesPoint = { date: string } & Record<string, number | string>;

export interface CompareResponse {
  assets: CompareAsset[];
  series: CompareSeriesPoint[];
  generatedAt: string;
}
