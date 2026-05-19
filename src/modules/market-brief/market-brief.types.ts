export type MarketBriefSnapshotKey = "stocks" | "crypto" | "commodities" | "vietnam_gold";

export interface MarketBriefAssetItem {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  marketType: "stock" | "crypto" | "commodity" | "gold";
  priceFormatted: string;
  change24h: number;
}

export interface MarketBriefSnapshotCard {
  key: MarketBriefSnapshotKey;
  title: string;
  changeFormatted: string;
  change24h: number;
  positive: boolean;
  summary: string;
}

export interface MarketBriefBriefSection {
  summary: string;
  items: MarketBriefAssetItem[];
}

export interface MarketBriefCommodityCard {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  priceFormatted: string;
  change24h: number;
}

export interface MarketBriefVietnamGoldBrand {
  brand: string;
  buyFormatted: string;
  sellFormatted: string;
}

export interface MarketBriefVietnamGoldBlock {
  summary: string;
  globalGoldFormatted: string;
  perLuongFormatted: string;
  premiumFormatted: string;
  premiumPct: number;
  brands: MarketBriefVietnamGoldBrand[];
}

export interface MarketBriefMeta {
  dateLabel: string;
  moodLabel: string;
  mood: "mixed" | "bullish" | "bearish";
}

export interface MarketBriefResponse {
  generatedAt: string;
  meta: MarketBriefMeta;
  snapshots: MarketBriefSnapshotCard[];
  aiInsight: string;
  stocksBrief: MarketBriefBriefSection;
  cryptoBrief: MarketBriefBriefSection;
  commoditiesBrief: MarketBriefBriefSection & { cards: MarketBriefCommodityCard[] };
  vietnamGold: MarketBriefVietnamGoldBlock;
  topMovers: {
    stocks: MarketBriefAssetItem[];
    crypto: MarketBriefAssetItem[];
    commodities: MarketBriefAssetItem[];
  };
}
