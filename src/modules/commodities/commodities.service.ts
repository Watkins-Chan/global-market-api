import { Injectable } from "@nestjs/common";
import { CommoditiesQueryDto } from "./dto/commodities-query.dto";
import { CommoditiesRepository } from "./commodities.repository";
import { CommodityAssetItem, CommodityAssetsResponse, CommodityGroupsResponse, CommodityOverviewResponse, CommodityTopMoversResponse } from "./commodities.types";

@Injectable()
export class CommoditiesService {
  constructor(private readonly repo: CommoditiesRepository) {}

  private groupLabel(group?: string): string {
    const raw = (group ?? "Other").replace(/[-_]+/g, " ").trim();
    if (!raw) return "Other";
    return raw
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private compactNumber(value?: number): string {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
  }

  private formatPrice(value: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value > 10 ? 2 : 4 }).format(value);
  }

  private toItem(row: {
    commodity_id: string;
    symbol: string;
    name: string;
    slug?: string;
    group?: string;
    unit?: string;
    price: number;
    change_1d: number;
    change_1w?: number;
    change_1m?: number;
    change_ytd?: number;
    volume?: number;
    sparkline_7d?: number[];
  }): CommodityAssetItem {
    const price = Number.isFinite(row.price) ? row.price : 0;
    const day = Number.isFinite(row.change_1d) ? row.change_1d : 0;
    return {
      id: row.commodity_id,
      symbol: row.symbol,
      name: row.name,
      slug: row.slug ?? row.symbol.toLowerCase(),
      group: row.group,
      unit: row.unit,
      price,
      priceFormatted: this.formatPrice(price),
      change24h: Number(day.toFixed(2)),
      weekChange: Number((row.change_1w ?? 0).toFixed(2)),
      monthChange: Number((row.change_1m ?? 0).toFixed(2)),
      ytdChange: Number((row.change_ytd ?? 0).toFixed(2)),
      volume: row.volume,
      volumeFormatted: row.volume ? this.compactNumber(row.volume) : undefined,
      sparkline: row.sparkline_7d?.length ? row.sparkline_7d : [price, price, price, price, price, price, price],
    };
  }

  async getOverview(): Promise<CommodityOverviewResponse> {
    const rows = await this.repo.getOverviewByGroup(12);
    return {
      items: rows.map((row) => ({
        group: row.group ?? "other",
        label: this.groupLabel(row.group),
        item: this.toItem(row),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async getTopMovers(query: CommoditiesQueryDto): Promise<CommodityTopMoversResponse> {
    const limit = query.limit ?? 4;
    const [gainers, losers] = await Promise.all([
      this.repo.getTopMovers(limit, -1),
      this.repo.getTopMovers(limit, 1),
    ]);
    return {
      gainers: gainers.map((x) => this.toItem(x)),
      losers: losers.map((x) => this.toItem(x)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getAll(query: CommoditiesQueryDto): Promise<CommodityAssetsResponse> {
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const { items, total } = await this.repo.getCommodities(
      limit,
      page,
      query.group,
      query.search,
      query.sortBy ?? "day",
      query.sortDir ?? "desc",
    );
    return {
      items: items.map((x) => this.toItem(x)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getGroups(): Promise<CommodityGroupsResponse> {
    const items = await this.repo.getGroupLeaders(3);
    return {
      items: items.map((x) => ({
        group: x.group,
        label: this.groupLabel(x.group),
        count: x.count,
        leaders: x.leaders.map((row) => this.toItem(row)),
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}
