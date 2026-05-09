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
