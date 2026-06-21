import { Injectable } from "@nestjs/common";
import { withCryptoLogo, withStockLikeLogo } from "../../common/asset-logo.util";
import { withCommodityLogo } from "../../common/commodity-logo.util";
import { ScreenerRawRow, ScreenerRepository } from "../screener/screener.repository";
import { StockDetailService } from "../stock-detail/stock-detail.service";
import { CryptoDetailService } from "../crypto-detail/crypto-detail.service";
import { CommodityDetailService } from "../commodity-detail/commodity-detail.service";
import { StockDetailChartQueryDto } from "../stock-detail/dto/stock-detail-chart-query.dto";
import { CryptoDetailChartQueryDto } from "../crypto-detail/dto/crypto-detail-chart-query.dto";
import { CommodityDetailChartQueryDto } from "../commodity-detail/dto/commodity-detail-chart-query.dto";
import {
  CompareAsset,
  CompareMarketType,
  ComparePerformancePoint,
  CompareResponse,
  CompareSearchItem,
  CompareSearchResponse,
  CompareSeriesPoint,
} from "./compare.types";

const MAX_ASSETS = 4;
const SERIES_TARGET_POINTS = 60;

interface ChartPoint {
  datetime: string;
  price: number;
}

interface LoadedAsset extends Omit<CompareAsset, "chartKey" | "hasChart"> {
  points: ChartPoint[];
}

@Injectable()
export class CompareService {
  constructor(
    private readonly screenerRepo: ScreenerRepository,
    private readonly stockDetail: StockDetailService,
    private readonly cryptoDetail: CryptoDetailService,
    private readonly commodityDetail: CommodityDetailService,
  ) {}

  // ---------------------------------------------------------------------------
  // Search / picker
  // ---------------------------------------------------------------------------

  private formatPrice(row: ScreenerRawRow): string {
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
        return undefined;
    }
  }

  private toSearchItem(row: ScreenerRawRow): CompareSearchItem {
    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      slug: row.slug,
      marketType: row.marketType as CompareMarketType,
      logo: this.resolveLogo(row),
      price: row.price,
      priceFormatted: this.formatPrice(row),
      change24h: Number((row.change24h ?? 0).toFixed(2)),
    };
  }

  async search(q: string | undefined, limit = 30): Promise<CompareSearchResponse> {
    const term = q?.trim();
    // When searching, scan a wider universe per market; otherwise show popular leaders.
    const perMarket = term ? 200 : 8;

    const [stocks, cryptos, commodities] = await Promise.all([
      this.screenerRepo.getStockRows(perMarket, term),
      this.screenerRepo.getCryptoRows(perMarket, term),
      this.screenerRepo.getCommodityRows(perMarket, term),
    ]);

    let rows: ScreenerRawRow[];
    if (term) {
      // Prioritise exact symbol matches, then interleave the rest by market.
      const lower = term.toLowerCase();
      const merged = [...stocks, ...cryptos, ...commodities];
      rows = merged.sort((a, b) => this.searchScore(b, lower) - this.searchScore(a, lower));
    } else {
      // Popular leaders: round-robin interleave for a balanced mix across markets.
      rows = this.interleave([stocks, cryptos, commodities]);
    }

    return {
      items: rows.slice(0, limit).map((row) => this.toSearchItem(row)),
      generatedAt: new Date().toISOString(),
    };
  }

  private interleave(groups: ScreenerRawRow[][]): ScreenerRawRow[] {
    const out: ScreenerRawRow[] = [];
    const max = Math.max(0, ...groups.map((g) => g.length));
    for (let i = 0; i < max; i++) {
      for (const group of groups) {
        if (i < group.length) out.push(group[i]);
      }
    }
    return out;
  }

  private searchScore(row: ScreenerRawRow, lower: string): number {
    const symbol = row.symbol.toLowerCase();
    const name = row.name.toLowerCase();
    if (symbol === lower) return 100;
    if (symbol.startsWith(lower)) return 80;
    if (name.startsWith(lower)) return 60;
    if (symbol.includes(lower)) return 40;
    if (name.includes(lower)) return 20;
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Compare selected assets
  // ---------------------------------------------------------------------------

  private parseAssets(raw: string | undefined): { marketType: CompareMarketType; slug: string }[] {
    if (!raw) return [];
    const seen = new Set<string>();
    const out: { marketType: CompareMarketType; slug: string }[] = [];
    for (const token of raw.split(",")) {
      const trimmed = token.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf(":");
      if (idx < 0) continue;
      const market = trimmed.slice(0, idx).trim().toLowerCase();
      const slug = trimmed.slice(idx + 1).trim().toLowerCase();
      if (!slug) continue;
      if (market !== "stock" && market !== "crypto" && market !== "commodity") continue;
      const key = `${market}:${slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ marketType: market as CompareMarketType, slug });
      if (out.length >= MAX_ASSETS) break;
    }
    return out;
  }

  private toChartPoints(chart: { points?: { datetime: string; price: number }[] } | null): ChartPoint[] {
    if (!chart?.points) return [];
    return chart.points
      .filter((p) => Number.isFinite(p.price) && p.price > 0 && typeof p.datetime === "string" && p.datetime)
      .map((p) => ({ datetime: p.datetime, price: Number(p.price) }));
  }

  private async loadAsset(
    marketType: CompareMarketType,
    slug: string,
  ): Promise<LoadedAsset | null> {
    try {
      if (marketType === "stock") {
        const detail = await this.stockDetail.getDetail(slug);
        const chart = await this.safeChart(() =>
          this.stockDetail.getChart(slug, { timeframe: "1Y" } as StockDetailChartQueryDto),
        );
        return this.mapDetail("stock", slug, detail, chart);
      }
      if (marketType === "crypto") {
        const detail = await this.cryptoDetail.getDetail(slug);
        const chart = await this.safeChart(() =>
          this.cryptoDetail.getChart(slug, { timeframe: "1Y" } as CryptoDetailChartQueryDto),
        );
        return this.mapDetail("crypto", slug, detail, chart);
      }
      const detail = await this.commodityDetail.getDetail(slug);
      const chart = await this.safeChart(() =>
        this.commodityDetail.getChart(slug, { timeframe: "1Y" } as CommodityDetailChartQueryDto),
      );
      return this.mapDetail("commodity", slug, detail, chart);
    } catch {
      // Unknown slug or upstream failure: skip this asset rather than failing the whole request.
      return null;
    }
  }

  private async safeChart<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch {
      return null;
    }
  }

  private mapDetail(
    marketType: CompareMarketType,
    slug: string,
    detail: {
      id: string;
      symbol: string;
      name: string;
      slug: string;
      logo?: string;
      price: number;
      priceFormatted: string;
      change24h: number;
      currency: string;
      performance: ComparePerformancePoint[];
      metrics: Record<string, string>;
    },
    chart: { points?: { datetime: string; price: number }[] } | null,
  ): LoadedAsset {
    return {
      key: `${marketType}:${slug}`,
      id: detail.id,
      symbol: detail.symbol,
      name: detail.name,
      slug: detail.slug ?? slug,
      marketType,
      logo: detail.logo,
      price: detail.price,
      priceFormatted: detail.priceFormatted,
      change24h: detail.change24h,
      currency: detail.currency,
      performance: detail.performance,
      metrics: detail.metrics,
      points: this.toChartPoints(chart),
    };
  }

  private assignChartKeys(assets: LoadedAsset[]): CompareAsset[] {
    const counts = new Map<string, number>();
    for (const a of assets) counts.set(a.symbol, (counts.get(a.symbol) ?? 0) + 1);

    const used = new Set<string>();
    return assets.map((a) => {
      let chartKey = a.symbol;
      if ((counts.get(a.symbol) ?? 0) > 1 || used.has(chartKey)) {
        chartKey = `${a.symbol} (${a.marketType})`;
      }
      used.add(chartKey);
      const { points, ...rest } = a;
      return { ...rest, chartKey, hasChart: points.length >= 2 };
    });
  }

  private formatSeriesLabel(datetime: string): string {
    const iso = datetime.includes("T") ? datetime : `${datetime}T00:00:00Z`;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return datetime;
    return parsed.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  private buildSeries(loaded: LoadedAsset[], keyed: CompareAsset[]): CompareSeriesPoint[] {
    const maps = loaded
      .map((asset, i) => {
        const chartKey = keyed[i].chartKey;
        const points = asset.points;
        if (points.length < 2) return null;
        const base = points.find((p) => p.price > 0)?.price ?? 0;
        if (base <= 0) return null;
        const m = new Map<string, number>();
        for (const p of points) {
          m.set(p.datetime, Number((((p.price - base) / base) * 100).toFixed(2)));
        }
        return { chartKey, m };
      })
      .filter((x): x is { chartKey: string; m: Map<string, number> } => x !== null);

    if (maps.length === 0) return [];

    const dateSet = new Set<string>();
    maps.forEach(({ m }) => m.forEach((_, dt) => dateSet.add(dt)));
    const dates = [...dateSet].sort();

    const last: Record<string, number> = {};
    const fullRows: CompareSeriesPoint[] = dates.map((dt) => {
      const row: CompareSeriesPoint = { date: dt };
      for (const { chartKey, m } of maps) {
        if (m.has(dt)) last[chartKey] = m.get(dt) as number;
        row[chartKey] = last[chartKey] ?? 0;
      }
      return row;
    });

    let rows = fullRows;
    if (rows.length > SERIES_TARGET_POINTS) {
      const step = rows.length / SERIES_TARGET_POINTS;
      const sampled: CompareSeriesPoint[] = [];
      for (let i = 0; i < SERIES_TARGET_POINTS; i++) sampled.push(rows[Math.floor(i * step)]);
      sampled.push(rows[rows.length - 1]);
      rows = sampled;
    }

    return rows.map((r) => ({ ...r, date: this.formatSeriesLabel(r.date as string) }));
  }

  async compare(rawAssets: string | undefined): Promise<CompareResponse> {
    const parsed = this.parseAssets(rawAssets);
    const loaded = (await Promise.all(parsed.map((p) => this.loadAsset(p.marketType, p.slug)))).filter(
      (x): x is LoadedAsset => x !== null,
    );

    const keyed = this.assignChartKeys(loaded);
    const series = this.buildSeries(loaded, keyed);

    return {
      assets: keyed,
      series,
      generatedAt: new Date().toISOString(),
    };
  }
}
