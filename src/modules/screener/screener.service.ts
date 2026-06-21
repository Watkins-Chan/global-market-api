import { Injectable } from "@nestjs/common";
import { withCryptoLogo, withStockLikeLogo } from "../../common/asset-logo.util";
import { withCommodityLogo } from "../../common/commodity-logo.util";
import { ScreenerQueryDto } from "./dto/screener-query.dto";
import { ScreenerRepository, ScreenerRawRow } from "./screener.repository";
import { ScreenerItem, ScreenerMarketType, ScreenerResponse } from "./screener.types";

const MARKET_LABELS: Record<ScreenerMarketType, string> = {
  stock: "Stock",
  crypto: "Crypto",
  commodity: "Commodity",
  gold: "Vietnam Gold",
};

const UNIVERSE_CAP: Record<ScreenerMarketType, number> = {
  stock: 1200,
  crypto: 1200,
  commodity: 600,
  gold: 300,
};

@Injectable()
export class ScreenerService {
  constructor(private readonly repo: ScreenerRepository) {}

  private round2(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  private formatPrice(row: ScreenerRawRow): string {
    if (row.marketType === "gold") {
      const millions = row.price / 1_000_000;
      return `${millions.toFixed(1)}M VND/tael`;
    }
    const currency = (row.currency ?? "USD").trim().toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: row.price > 1 ? 2 : 6,
      }).format(row.price);
    } catch {
      return `${row.price.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
    }
  }

  private resolveLogo(row: ScreenerRawRow): string | undefined {
    switch (row.marketType) {
      case "stock":
        return withStockLikeLogo(row.logo, row.symbol, row.name);
      case "crypto":
        return withCryptoLogo({ logo: row.logo, symbol: row.symbol, name: row.name });
      case "commodity":
        return withCommodityLogo({ logo: row.logo, symbol: row.symbol, name: row.name, group: row.group });
      default:
        // Vietnam gold brands have no logo; the UI renders a gold-themed initials avatar.
        return undefined;
    }
  }

  private toItem(row: ScreenerRawRow): ScreenerItem {
    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      slug: row.slug,
      marketType: row.marketType,
      marketLabel: MARKET_LABELS[row.marketType],
      logo: this.resolveLogo(row),
      price: row.price,
      priceFormatted: this.formatPrice(row),
      change24h: this.round2(row.change24h),
      weekChange: this.round2(row.weekChange ?? 0),
      monthChange: this.round2(row.monthChange ?? 0),
      ytdChange: this.round2(row.ytdChange ?? 0),
      marketCap: row.marketCap,
      rank: row.rank,
    };
  }

  private resolveDefaultSort(market: ScreenerMarketType): { sortBy: string; sortDir: "asc" | "desc" } {
    if (market === "stock") return { sortBy: "marketCap", sortDir: "desc" };
    if (market === "crypto" || market === "commodity") return { sortBy: "rank", sortDir: "asc" };
    return { sortBy: "change24h", sortDir: "desc" };
  }

  private async loadUniverse(market: ScreenerMarketType, search?: string): Promise<ScreenerRawRow[]> {
    const cap = UNIVERSE_CAP[market];
    if (market === "stock") return this.repo.getStockRows(cap, search);
    if (market === "crypto") return this.repo.getCryptoRows(cap, search);
    if (market === "commodity") return this.repo.getCommodityRows(cap, search);
    return this.repo.getGoldRows(cap, search);
  }

  private sortRows(rows: ScreenerItem[], sortBy: string, sortDir: "asc" | "desc"): ScreenerItem[] {
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "symbol":
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case "price":
          cmp = a.price - b.price;
          break;
        case "week":
          cmp = a.weekChange - b.weekChange;
          break;
        case "month":
          cmp = a.monthChange - b.monthChange;
          break;
        case "year":
          cmp = a.ytdChange - b.ytdChange;
          break;
        case "marketCap":
          cmp = (a.marketCap ?? 0) - (b.marketCap ?? 0);
          break;
        case "rank":
          cmp = (a.rank ?? 999999999) - (b.rank ?? 999999999);
          break;
        case "change24h":
        default:
          cmp = a.change24h - b.change24h;
          break;
      }
      if (cmp === 0) {
        if (a.marketType === "stock" && b.marketType === "stock") {
          cmp = (b.marketCap ?? 0) - (a.marketCap ?? 0);
        } else if (
          (a.marketType === "crypto" || a.marketType === "commodity") &&
          (b.marketType === "crypto" || b.marketType === "commodity")
        ) {
          cmp = (a.rank ?? 999999999) - (b.rank ?? 999999999);
        }
      }
      if (cmp === 0) cmp = a.symbol.localeCompare(b.symbol);
      return cmp * dir;
    });
    return sorted;
  }

  async getScreener(query: ScreenerQueryDto): Promise<ScreenerResponse> {
    const limit = Math.min(query.limit ?? 20, 100);
    const page = query.page ?? 1;
    const market = query.market ?? "stock";
    const change = query.change ?? "any";
    const marketDefault = this.resolveDefaultSort(market);
    const sortBy = query.sortBy ?? marketDefault.sortBy;
    const sortDir = query.sortDir ?? marketDefault.sortDir;

    let rows = (await this.loadUniverse(market, query.search)).map((row) => this.toItem(row));

    if (change === "gainers") rows = rows.filter((x) => x.change24h > 0);
    if (change === "losers") rows = rows.filter((x) => x.change24h < 0);

    rows = this.sortRows(rows, sortBy, sortDir);

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * limit;
    const items = rows.slice(start, start + limit);

    return {
      items,
      page: safePage,
      limit,
      total,
      totalPages,
      generatedAt: new Date().toISOString(),
    };
  }
}
