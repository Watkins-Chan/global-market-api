import { Injectable } from "@nestjs/common";
import { CryptoQueryDto } from "./dto/crypto-query.dto";
import { CryptoRepository } from "./crypto.repository";
import {
  CryptoAssetsResponse,
  CryptoEcosystemsResponse,
  CryptoFiltersResponse,
  CryptoOverviewResponse,
  CryptoPageAssetItem,
  CryptoTopMoversResponse,
} from "./crypto.types";

@Injectable()
export class CryptoService {
  constructor(private readonly repo: CryptoRepository) {}

  private readonly MIN_MARKET_CAP = 300_000_000;
  private readonly MIN_VOLUME = 2_000_000;
  private readonly MAX_ABS_CHANGE = 35;

  private compactNumber(value?: number): string {
    const n = value ?? 0;
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  }

  private toAssetItem(
    row: {
      crypto_id: string;
      price: number;
      change_24h: number;
      change_7d?: number;
      change_30d?: number;
      change_ytd?: number;
      market_cap?: number;
      volume_24h?: number;
      rank?: number;
      quote_currency?: string;
      crypto?: { symbol?: string; name?: string; slug?: string; category?: string; ecosystem?: string; profile_category?: string; rank?: number };
    },
  ): CryptoPageAssetItem {
    const symbol = row.crypto?.symbol ?? row.crypto_id;
    const price = Number.isFinite(row.price) ? row.price : 0;
    const change24h = Number.isFinite(row.change_24h) ? row.change_24h : 0;
    const currency = (row.quote_currency ?? "USD").trim().toUpperCase();
    const category = row.crypto?.profile_category ?? row.crypto?.category;
    const ecosystem = row.crypto?.ecosystem;
    const sparkline = [0, 1, 2, 3, 4, 5, 6].map((step) => Number((price * (1 + (change24h / 100) * ((step - 3) / 9))).toFixed(4)));

    let priceFormatted = "";
    try {
      priceFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: price > 1 ? 2 : 6 }).format(price);
    } catch {
      priceFormatted = `${price.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${currency}`;
    }

    return {
      id: row.crypto_id,
      symbol,
      name: row.crypto?.name ?? symbol,
      slug: row.crypto?.slug ?? symbol.toLowerCase(),
      category,
      ecosystem,
      price,
      priceFormatted,
      change24h: Number(change24h.toFixed(2)),
      marketCap: row.market_cap,
      marketCapFormatted: row.market_cap ? this.compactNumber(row.market_cap) : undefined,
      volume24h: row.volume_24h,
      volume24hFormatted: row.volume_24h ? this.compactNumber(row.volume_24h) : undefined,
      weekChange: Number((row.change_7d ?? (change24h * 1.4)).toFixed(2)),
      monthChange: Number((row.change_30d ?? (change24h * 2.2)).toFixed(2)),
      ytdChange: Number((row.change_ytd ?? (change24h * 6.5)).toFixed(2)),
      rank: row.rank ?? row.crypto?.rank,
      sparkline,
    };
  }

  private isQualityCrypto(row: { market_cap?: number; volume_24h?: number; change_24h?: number }): boolean {
    const marketCap = Number(row.market_cap ?? 0);
    const volume = Number(row.volume_24h ?? 0);
    const absChange = Math.abs(Number(row.change_24h ?? 0));
    return (
      Number.isFinite(marketCap) &&
      Number.isFinite(volume) &&
      Number.isFinite(absChange) &&
      marketCap >= this.MIN_MARKET_CAP &&
      volume >= this.MIN_VOLUME &&
      absChange <= this.MAX_ABS_CHANGE
    );
  }

  async getOverview(): Promise<CryptoOverviewResponse> {
    const stats = await this.repo.getOverviewStats();
    const dominance = Math.max(0, Math.min(100, stats.btcDominance));
    return {
      items: [
        { label: "Crypto Market", value: `$${this.compactNumber(stats.totalMarketCap)}`, change: Number(stats.cryptoMarketChange24h.toFixed(2)) },
        { label: "24h Volume", value: `$${this.compactNumber(stats.totalVolume24h)}`, change: Number((stats.cryptoMarketChange24h * 0.6).toFixed(2)) },
        { label: "BTC Dominance", value: `${dominance.toFixed(1)}%`, change: Number(stats.btcDominanceChange24h.toFixed(2)) },
        { label: "Fear & Greed", value: `${Math.round(stats.fearGreed)} — ${stats.fearGreed >= 60 ? "Greed" : stats.fearGreed <= 40 ? "Fear" : "Neutral"}`, change: Number(stats.fearGreedTrend24h.toFixed(2)) },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  async getEcosystems(limit = 3): Promise<CryptoEcosystemsResponse> {
    const rows = await this.repo.getTrendingEcosystems(limit);
    return {
      items: rows.map((x) => ({
        name: `${x.name} Ecosystem`,
        desc: `${x.count} assets gaining momentum in this ecosystem`,
        change: Number(x.change.toFixed(2)),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async getFeatured(query: CryptoQueryDto): Promise<CryptoAssetsResponse> {
    const limit = query.limit ?? 5;
    const rows = await this.repo.getTopByMarketCap(limit);
    return {
      items: rows.map((x) => this.toAssetItem(x)),
      page: 1,
      limit,
      total: rows.length,
      totalPages: 1,
      generatedAt: new Date().toISOString(),
    };
  }

  async getTopMovers(query: CryptoQueryDto): Promise<CryptoTopMoversResponse> {
    const limit = query.limit ?? 4;
    const [desc, asc] = await Promise.all([
      this.repo.getTopMovers(limit * 80, -1),
      this.repo.getTopMovers(limit * 80, 1),
    ]);
    const gainers = desc.filter((x) => this.isQualityCrypto(x)).slice(0, limit);
    const losers = asc.filter((x) => this.isQualityCrypto(x)).slice(0, limit);
    return {
      gainers: gainers.map((x) => this.toAssetItem(x)),
      losers: losers.map((x) => this.toAssetItem(x)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getTrending(query: CryptoQueryDto): Promise<CryptoAssetsResponse> {
    const limit = query.limit ?? 6;
    const { items } = await this.repo.getCryptos(limit * 40, 1, undefined, undefined);
    const picked = items
      .filter((x) => this.isQualityCrypto(x))
      .sort((a, b) => {
        const scoreA = Math.abs(a.change_24h) * 0.4 + Math.log10(Math.max(a.market_cap ?? 1, 1)) * 0.6;
        const scoreB = Math.abs(b.change_24h) * 0.4 + Math.log10(Math.max(b.market_cap ?? 1, 1)) * 0.6;
        return scoreB - scoreA;
      })
      .slice(0, limit);
    return {
      items: picked.map((x) => this.toAssetItem(x)),
      page: 1,
      limit,
      total: picked.length,
      totalPages: 1,
      generatedAt: new Date().toISOString(),
    };
  }

  async getAll(query: CryptoQueryDto): Promise<CryptoAssetsResponse> {
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const sortByRaw = query.sortBy ?? "rank";
    const sortBy = sortByRaw === "marketcap" ? "marketCap" : sortByRaw;
    const sortDir = query.sortDir ?? (sortBy === "rank" ? "asc" : "desc");
    const { items, total } = await this.repo.getCryptos(limit, page, query.category, query.search, sortBy, sortDir);
    return {
      items: items.map((x) => this.toAssetItem(x)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getFilters(): Promise<CryptoFiltersResponse> {
    const categories = await this.repo.getCategoryBuckets();
    return {
      categories,
      generatedAt: new Date().toISOString(),
    };
  }
}
