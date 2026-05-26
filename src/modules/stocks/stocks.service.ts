import { Injectable } from "@nestjs/common";
import { StocksQueryDto } from "./dto/stocks-query.dto";
import { StocksRepository } from "./stocks.repository";
import {
  StockInsightsResponse,
  StockNewsResponse,
  StocksAssetsResponse,
  StocksOverviewResponse,
  StocksPageAssetItem,
  StocksTopMoversResponse,
  StocksFiltersResponse,
  StocksCountriesResponse,
} from "./stocks.types";

@Injectable()
export class StocksService {
  constructor(private readonly repo: StocksRepository) {}

  private readonly sectorDescriptions: Record<string, string> = {
    technology: "AI and cloud driving growth",
    healthcare: "Biotech leads the sector",
    financial: "Rate uncertainty weighs",
    energy: "Oil price recovery supports",
    consumer: "Mixed retail earnings",
    industrial: "Manufacturing slowdown",
  };
  private readonly STRICT_MIN_MARKET_CAP = 10_000_000_000;
  private readonly STRICT_MIN_VOLUME = 2_000_000;
  private readonly STRICT_MIN_PRICE = 5;
  private readonly STRICT_MAX_ABS_CHANGE = 20;
  private readonly RELAXED_MIN_MARKET_CAP = 2_000_000_000;
  private readonly RELAXED_MIN_VOLUME = 300_000;
  private readonly RELAXED_MIN_PRICE = 1;
  private readonly RELAXED_MAX_ABS_CHANGE = 30;

  private relTime(date?: Date): string {
    if (!date) return "just now";
    const sec = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}h ago`;
    const day = Math.floor(hour / 24);
    return `${day}d ago`;
  }

  private fmtPct(value: number): string {
    const n = Number.isFinite(value) ? value : 0;
    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  }

  private compactNumber(value?: number): string {
    const n = value ?? 0;
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  }

  private formatPriceByCurrency(value: number, currency?: string): string {
    const normalized = (currency ?? "USD").trim().toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: normalized,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${normalized || "USD"}`;
    }
  }

  private withFallbackLogo(logo: string | undefined, symbol: string, name?: string): string {
    const trimmed = (logo ?? "").trim();
    if (trimmed) {
      if (/^(https?:|data:)/i.test(trimmed) || trimmed.startsWith("//") || trimmed.startsWith("/")) {
        return trimmed;
      }
      const logoid = trimmed.replace(/^\/+/, "");
      return `https://s3-symbol-logo.tradingview.com/${logoid}--big.svg`;
    }
    const textRaw = (symbol || name || "?").trim();
    const text = textRaw.slice(0, 3).toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='12' fill='#1f2937'/><text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='20' fill='#f3f4f6'>${text}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  private toStockItem(
    row: { stock_id: string; price: number; change_1d: number; market_cap?: number; volume?: number; stock?: { symbol?: string; name?: string; slug?: string; logo?: string; sector?: string; industry?: string; country?: string; country_code?: string; currency?: string; native_currency?: string } },
    idx = 0,
  ): StocksPageAssetItem {
    const symbol = row.stock?.symbol ?? row.stock_id;
    const price = Number.isFinite(row.price) ? row.price : 0;
    const change = Number.isFinite(row.change_1d) ? row.change_1d : 0;
    const currency = (row.stock?.native_currency ?? row.stock?.currency ?? "USD").trim().toUpperCase();
    return {
      id: row.stock_id,
      symbol,
      name: row.stock?.name ?? symbol,
      slug: row.stock?.slug ?? symbol.toLowerCase(),
      logo: this.withFallbackLogo(row.stock?.logo, symbol, row.stock?.name),
      sector: row.stock?.sector,
      industry: row.stock?.industry,
      country: row.stock?.country,
      countryCode: row.stock?.country_code,
      currency,
      price,
      priceFormatted: this.formatPriceByCurrency(price, currency),
      change24h: Number(change.toFixed(2)),
      marketCap: row.market_cap,
      marketCapFormatted: row.market_cap ? this.compactNumber(row.market_cap) : undefined,
      weekChange: Number((change * 1.6).toFixed(2)),
      monthChange: Number((change * 2.4).toFixed(2)),
      ytdChange: Number((change * 8).toFixed(2)),
      sparkline: [0, 1, 2, 3, 4, 5, 6].map((step) => Number((price * (1 + (change / 100) * ((step - 3) / 9))).toFixed(2))),
    };
  }

  private isQualityStock(
    row: { price?: number; change_1d?: number; market_cap?: number; volume?: number },
    strict: boolean,
  ): boolean {
    const price = Number(row.price ?? 0);
    const marketCap = Number(row.market_cap ?? 0);
    const volume = Number(row.volume ?? 0);
    const absChange = Math.abs(Number(row.change_1d ?? 0));
    if (!Number.isFinite(price) || !Number.isFinite(marketCap) || !Number.isFinite(volume) || !Number.isFinite(absChange)) {
      return false;
    }
    if (strict) {
      return (
        marketCap >= this.STRICT_MIN_MARKET_CAP &&
        volume >= this.STRICT_MIN_VOLUME &&
        price >= this.STRICT_MIN_PRICE &&
        absChange <= this.STRICT_MAX_ABS_CHANGE
      );
    }
    return (
      marketCap >= this.RELAXED_MIN_MARKET_CAP &&
      volume >= this.RELAXED_MIN_VOLUME &&
      price >= this.RELAXED_MIN_PRICE &&
      absChange <= this.RELAXED_MAX_ABS_CHANGE
    );
  }

  private pickQualityRows<T extends { stock_id: string; price?: number; change_1d?: number; market_cap?: number; volume?: number }>(
    rows: T[],
    limit: number,
    options?: { allowFallback?: boolean },
  ): T[] {
    const allowFallback = options?.allowFallback ?? true;
    const strict = rows.filter((row) => this.isQualityStock(row, true));
    if (strict.length >= limit) return strict.slice(0, limit);
    const relaxed = rows.filter((row) => this.isQualityStock(row, false) && !strict.some((x) => x.stock_id === row.stock_id));
    const picked = [...strict, ...relaxed].slice(0, limit);
    if (picked.length >= limit || !allowFallback) return picked;
    const fallback = rows.filter((row) => !picked.some((x) => x.stock_id === row.stock_id)).slice(0, limit - picked.length);
    return [...picked, ...fallback];
  }

  private getCountryCode(query?: StocksQueryDto): string {
    const code = (query?.countryCode ?? query?.country ?? "US").trim().toUpperCase();
    return code || "US";
  }

  async getOverview(query?: StocksQueryDto): Promise<StocksOverviewResponse> {
    const countryCode = this.getCountryCode(query);
    const [sp500, nasdaq, topSectors] = await Promise.all([
      this.repo.getIndexCompositeByProname("SP:SPX"),
      this.repo.getIndexCompositeByProname("NASDAQ:NDX"),
      this.repo.getSectorPerformance(6, countryCode),
    ]);

    const indices = [
      { name: "S&P 500", value: "5,234", change: Number(sp500.toFixed(2)) },
      { name: "NASDAQ", value: "16,742", change: Number(nasdaq.toFixed(2)) },
      { name: "Dow Jones", value: "39,513", change: Number((sp500 * 0.6).toFixed(2)) },
      { name: "FTSE 100", value: "8,164", change: Number((-Math.abs(sp500) * 0.7).toFixed(2)) },
      { name: "Nikkei 225", value: "38,487", change: Number((nasdaq * 0.9).toFixed(2)) },
      { name: "VN-Index", value: "1,284", change: Number((sp500 * 0.8).toFixed(2)) },
    ];

    const sectors = topSectors.map((item) => {
      const key = item.sector.toLowerCase();
      return {
        name: item.sector,
        change: Number(item.change.toFixed(2)),
        desc: this.sectorDescriptions[key] ?? "Sector performance based on latest market data",
      };
    });

    return {
      indices,
      sectors,
      generatedAt: new Date().toISOString(),
    };
  }

  async getFeatured(query: StocksQueryDto): Promise<StocksAssetsResponse> {
    const limit = query.limit ?? 5;
    const countryCode = this.getCountryCode(query);
    const rows = await this.repo.getTopStocksByMarketCap(limit, countryCode);
    return {
      items: rows.map((row, idx) => this.toStockItem(row, idx)),
      page: 1,
      limit,
      total: rows.length,
      totalPages: 1,
      generatedAt: new Date().toISOString(),
    };
  }

  async getTopMovers(query: StocksQueryDto): Promise<StocksTopMoversResponse> {
    const limit = query.limit ?? 3;
    const countryCode = this.getCountryCode(query);
    const [gainers, losers] = await Promise.all([
      this.repo.getTopStockMovers(limit * 200, -1, countryCode),
      this.repo.getTopStockMovers(limit * 200, 1, countryCode),
    ]);
    // Top movers must remain stable; do not fallback to unfiltered rows.
    const safeGainers = this.pickQualityRows(gainers, limit, { allowFallback: false });
    const safeLosers = this.pickQualityRows(losers, limit, { allowFallback: false });
    return {
      gainers: safeGainers.map((row, idx) => this.toStockItem(row, idx)),
      losers: safeLosers.map((row, idx) => this.toStockItem(row, idx)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getTrending(query: StocksQueryDto): Promise<StocksAssetsResponse> {
    const limit = query.limit ?? 6;
    const countryCode = this.getCountryCode(query);
    const rows = await this.repo.getStocks(limit * 40, 1, undefined, undefined, undefined, countryCode);
    const quality = this.pickQualityRows(rows.items, limit * 4);
    const picked = quality
      .sort((a, b) => {
        const scoreA = Math.abs(a.change_1d) * 0.35 + Math.log10(Math.max(a.market_cap ?? 1, 1)) * 0.65;
        const scoreB = Math.abs(b.change_1d) * 0.35 + Math.log10(Math.max(b.market_cap ?? 1, 1)) * 0.65;
        return scoreB - scoreA;
      })
      .slice(0, limit);
    return {
      items: picked.map((row, idx) => this.toStockItem(row, idx)),
      page: 1,
      limit,
      total: picked.length,
      totalPages: 1,
      generatedAt: new Date().toISOString(),
    };
  }

  async getAllStocks(query: StocksQueryDto): Promise<StocksAssetsResponse> {
    const limit = query.limit ?? 100;
    const page = query.page ?? 1;
    const countryCode = this.getCountryCode(query);
    const { items, total } = await this.repo.getStocks(limit, page, query.sector, query.industry, query.search, countryCode);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      items: items.map((row, idx) => this.toStockItem(row, idx)),
      page,
      limit,
      total,
      totalPages,
      generatedAt: new Date().toISOString(),
    };
  }

  async getFilters(query?: StocksQueryDto): Promise<StocksFiltersResponse> {
    const countryCode = this.getCountryCode(query);
    const buckets = await this.repo.getFilterBuckets(countryCode);
    return {
      sectors: buckets.sectors,
      industries: buckets.industries,
      countries: buckets.countries,
      generatedAt: new Date().toISOString(),
    };
  }

  async getCountries(): Promise<StocksCountriesResponse> {
    const items = await this.repo.getAllCountries();
    return {
      items,
      generatedAt: new Date().toISOString(),
    };
  }

  async getMarketInsights(query: StocksQueryDto): Promise<StockInsightsResponse> {
    const [gainer, loser, leader] = await Promise.all([
      this.repo.getTopStockMovers(1, -1),
      this.repo.getTopStockMovers(1, 1),
      this.repo.getTopStockByMarketCap(),
    ]);

    const up = gainer[0];
    const down = loser[0];
    const lead = leader;

    return {
      items: [
        {
          category: "Top Gainer",
          title: `${up?.stock?.symbol ?? "N/A"} leads today's move (${this.fmtPct(up?.change_1d ?? 0)})`,
          summary: `${up?.stock?.name ?? "Leading stock"} is trading at ${(up?.price ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}, attracting momentum flows in the current session.`,
        },
        {
          category: "Top Loser",
          title: `${down?.stock?.symbol ?? "N/A"} under pressure (${this.fmtPct(down?.change_1d ?? 0)})`,
          summary: `${down?.stock?.name ?? "Lagging stock"} is among the weakest names today, reflecting risk repricing in selected sectors.`,
        },
        {
          category: "Market Leader",
          title: `${lead?.stock?.name ?? "Large-cap leader"} remains center stage`,
          summary: `${lead?.stock?.symbol ?? "N/A"} is one of the largest-cap stocks, currently at ${(lead?.price ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} (${this.fmtPct(lead?.change_1d ?? 0)}).`,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  async getLatestNews(query: StocksQueryDto): Promise<StockNewsResponse> {
    const limit = query.limit ?? 6;
    const items = await this.repo.getLatestStockNews(limit);
    return {
      items: items.map((item) => ({
        id: String((item as { _id?: unknown })._id ?? ""),
        category: item.market ?? "stocks",
        title: item.title ?? "",
        summary: item.summary ?? "",
        time: this.relTime(item.published_at),
        source: item.source,
        url: item.url,
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}
