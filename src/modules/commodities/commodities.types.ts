export interface CommodityAssetItem {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  group?: string;
  unit?: string;
  price: number;
  priceFormatted: string;
  change24h: number;
  weekChange?: number;
  monthChange?: number;
  ytdChange?: number;
  volume?: number;
  volumeFormatted?: string;
  sparkline: number[];
}

export interface CommodityOverviewGroupItem {
  group: string;
  label: string;
  item: CommodityAssetItem;
}

export interface CommodityOverviewResponse {
  items: CommodityOverviewGroupItem[];
  generatedAt: string;
}

export interface CommodityAssetsResponse {
  items: CommodityAssetItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  generatedAt: string;
}

export interface CommodityTopMoversResponse {
  gainers: CommodityAssetItem[];
  losers: CommodityAssetItem[];
  generatedAt: string;
}

export interface CommodityGroupBucket {
  name: string;
  count: number;
}

export interface CommodityGroupsResponse {
  items: Array<{
    group: string;
    label: string;
    count: number;
    leaders: CommodityAssetItem[];
  }>;
  generatedAt: string;
}

export type CommodityDriverSentiment = "bullish" | "bearish";

export interface CommodityMarketDriverItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  impact: string;
  sentiment: CommodityDriverSentiment;
}

export interface CommodityMarketDriversResponse {
  items: CommodityMarketDriverItem[];
  generatedAt: string;
  source: "mock";
}

export interface CommodityInsightItem {
  id: string;
  category: string;
  title: string;
  summary: string;
}

export interface CommodityInsightsResponse {
  items: CommodityInsightItem[];
  generatedAt: string;
  source: "mock";
}
