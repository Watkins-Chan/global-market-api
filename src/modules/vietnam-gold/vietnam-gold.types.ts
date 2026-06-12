export interface VietnamGoldBrandItem {
  id: string;
  brandCode: string;
  symbol: string;
  name: string;
  slug: string;
  unit?: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  buyPriceFormatted: string;
  sellPriceFormatted: string;
  spreadFormatted: string;
  change24h: number;
  weekChange?: number;
  monthChange?: number;
  ytdChange?: number;
  premiumVnd?: number;
  premiumFormatted?: string;
  sparkline: number[];
}

export interface VietnamGoldOverviewMetric {
  label: string;
  value: string;
  sub?: string;
  change: number | null;
  highlight?: boolean;
}

export interface VietnamGoldOverviewResponse {
  items: VietnamGoldOverviewMetric[];
  conversion: {
    globalPriceUsdOz: number;
    globalChange24h?: number;
    usdVndRate: number;
    equivalentVndPerLuong: number;
    sjcSellVndPerLuong: number;
    premiumVnd: number;
    luongPerOz: number;
  };
  generatedAt: string;
}

export interface VietnamGoldTopMoversResponse {
  gainers: VietnamGoldBrandItem[];
  losers: VietnamGoldBrandItem[];
  generatedAt: string;
}

export interface VietnamGoldGroupLeader {
  group: string;
  label: string;
  count: number;
  leaders: VietnamGoldBrandItem[];
}

export interface VietnamGoldGroupsResponse {
  items: VietnamGoldGroupLeader[];
  generatedAt: string;
}

export interface VietnamGoldAssetsResponse {
  items: VietnamGoldBrandItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  generatedAt: string;
}