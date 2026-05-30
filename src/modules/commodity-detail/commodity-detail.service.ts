import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { withCommodityLogo } from "../../common/commodity-logo.util";
import { TwelveDataInterval, TwelveDataSeries, TwelveDataService } from "../stock-detail/providers/twelve-data.service";
import { CommodityDetailChartQueryDto } from "./dto/commodity-detail-chart-query.dto";
import { CommodityDetailNewsQueryDto } from "./dto/commodity-detail-news-query.dto";
import {
  CommodityDetailNewsRecord,
  CommodityDetailRecord,
  CommodityDetailRepository,
  CommodityDetailSnapshotRecord,
} from "./commodity-detail.repository";
import {
  CommodityDetailChartPoint,
  CommodityDetailChartResponse,
  CommodityDetailNewsItem,
  CommodityDetailNewsResponse,
  CommodityDetailPerformancePoint,
  CommodityDetailQuickFact,
  CommodityDetailRelatedItem,
  CommodityDetailRelatedResponse,
  CommodityDetailResponse,
  CommodityDetailTimeframe,
} from "./commodity-detail.types";

interface TimeframePlan {
  interval: TwelveDataInterval;
  outputsize: number;
}

const TIMEFRAME_PLAN: Record<CommodityDetailTimeframe, TimeframePlan> = {
  "1D": { interval: "5min", outputsize: 78 },
  "7D": { interval: "30min", outputsize: 96 },
  "30D": { interval: "1day", outputsize: 30 },
  "90D": { interval: "1day", outputsize: 90 },
  "1Y": { interval: "1day", outputsize: 252 },
  MAX: { interval: "1week", outputsize: 520 },
};

@Injectable()
export class CommodityDetailService {
  constructor(
    private readonly repo: CommodityDetailRepository,
    private readonly twelveData: TwelveDataService,
  ) {}

  private groupLabel(group?: string): string {
    const raw = (group ?? "Commodity").replace(/[-_]+/g, " ").trim();
    if (!raw) return "Commodity";
    return raw
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private fmtCurrency(value: number, currency = "USD"): string {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: value >= 1 ? 2 : 4,
      }).format(value);
    } catch {
      return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    }
  }

  private compactNumber(value?: number | null): string {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value as number);
  }

  private fmtPct(value?: number | null, digits = 2): string {
    if (!Number.isFinite(value)) return "—";
    const n = value as number;
    return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
  }

  private fmtNumber(value?: number | null, digits = 2): string {
    if (!Number.isFinite(value)) return "—";
    return (value as number).toFixed(digits);
  }

  private formatVolume(value?: number | null): string {
    if (!Number.isFinite(value) || (value as number) <= 0) return "—";
    const n = value as number;
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  }

  private relTime(date?: Date): string {
    if (!date) return "just now";
    const sec = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}h ago`;
    return `${Math.floor(hour / 24)}d ago`;
  }

  private firstSentences(text: string | undefined | null, count = 2): string {
    if (!text) return "";
    const trimmed = text.trim();
    const matches = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)/g);
    if (!matches?.length) return trimmed;
    return matches.slice(0, count).join(" ").trim() || trimmed;
  }

  private normalizeSymbolDisplay(symbol?: string): string {
    const raw = (symbol ?? "").trim();
    if (!raw.includes(":")) return raw;
    return raw.split(":")[0]?.trim() ?? raw;
  }

  private priceMetricLabel(unit?: string): string {
    const u = (unit ?? "").trim();
    if (!u) return "Price";
    if (u.includes("/")) return `Price (${u})`;
    return `Price (${u})`;
  }

  private resolveTwelveDataSymbol(commodity: CommodityDetailRecord): string {
    const yahoo = commodity.source_ids?.yahooSymbol?.trim().toUpperCase();
    if (yahoo) return yahoo.includes("/") ? yahoo : `${yahoo}/USD`;

    const sym = this.normalizeSymbolDisplay(commodity.symbol).toUpperCase();
    if (!sym) return "";

    const known: Record<string, string> = {
      XAUUSD: "XAU/USD",
      XAU: "XAU/USD",
      XAGUSD: "XAG/USD",
      XAG: "XAG/USD",
      CL1: "WTI/USD",
      CL: "WTI/USD",
      WTI: "WTI/USD",
      BRENT: "BRENT/USD",
      BRN: "BRENT/USD",
      NG: "NG/USD",
      HG: "HG/USD",
      GC: "XAU/USD",
      SI: "XAG/USD",
    };
    if (known[sym]) return known[sym];
    if (sym.includes("/")) return sym;
    if (sym.endsWith("USD") && sym.length > 3) return `${sym.slice(0, -3)}/USD`;
    return `${sym}/USD`;
  }

  private toPerformance(snapshot: CommodityDetailSnapshotRecord | null): CommodityDetailPerformancePoint[] {
    const day = Number.isFinite(snapshot?.change_1d) ? Number(snapshot?.change_1d) : 0;
    const week = Number.isFinite(snapshot?.change_1w) ? Number(snapshot?.change_1w) : day * 1.6;
    const month = Number.isFinite(snapshot?.change_1m) ? Number(snapshot?.change_1m) : day * 2.4;
    const year = Number.isFinite(snapshot?.change_ytd) ? Number(snapshot?.change_ytd) : day * 8;
    return [
      { period: "1D", change: Number(day.toFixed(2)) },
      { period: "1W", change: Number(week.toFixed(2)) },
      { period: "1M", change: Number(month.toFixed(2)) },
      { period: "1Y", change: Number(year.toFixed(2)) },
    ];
  }

  private toMetrics(
    commodity: CommodityDetailRecord,
    snapshot: CommodityDetailSnapshotRecord | null,
    currency: string,
  ): Record<string, string> {
    const price = snapshot?.price;
    const unit = commodity.unit?.trim();
    const metrics: Record<string, string> = {};

    if (Number.isFinite(price)) {
      metrics[this.priceMetricLabel(unit)] = this.fmtCurrency(price as number, currency);
    }
    metrics["Day %"] = this.fmtPct(snapshot?.change_1d);
    metrics["Week %"] = this.fmtPct(snapshot?.change_1w);
    metrics["Month %"] = this.fmtPct(snapshot?.change_1m);
    metrics["YTD"] = this.fmtPct(snapshot?.change_ytd);

    if (Number.isFinite(snapshot?.open)) metrics["Open"] = this.fmtCurrency(snapshot!.open!, currency);
    if (Number.isFinite(snapshot?.high)) metrics["Day High"] = this.fmtCurrency(snapshot!.high!, currency);
    if (Number.isFinite(snapshot?.low)) metrics["Day Low"] = this.fmtCurrency(snapshot!.low!, currency);
    if (Number.isFinite(snapshot?.volume)) metrics["Volume"] = this.formatVolume(snapshot!.volume);
    if (Number.isFinite(snapshot?.open_interest)) metrics["Open Interest"] = this.formatVolume(snapshot!.open_interest);
    if (unit) metrics["Unit"] = unit;
    if (commodity.benchmark) metrics["Benchmark"] = commodity.benchmark;

    return metrics;
  }

  private toQuickFacts(
    commodity: CommodityDetailRecord,
    snapshot: CommodityDetailSnapshotRecord | null,
    groupLabel: string,
  ): CommodityDetailQuickFact[] {
    const change = Number(snapshot?.change_1d ?? 0);
    return [
      { label: "Category", value: groupLabel },
      { label: "Unit", value: commodity.unit?.trim() || "USD" },
      { label: "Benchmark", value: commodity.benchmark?.trim() || "Global" },
      { label: "YTD", value: this.fmtPct(snapshot?.change_ytd) },
      { label: "Trend", value: change >= 0 ? "Bullish" : "Bearish" },
    ];
  }

  private buildContext(
    commodity: CommodityDetailRecord,
    snapshot: CommodityDetailSnapshotRecord | null,
    groupLabel: string,
  ): { contextTitle: string; contextBody: string; narrative: string; groupNarrative: string } {
    const change = Number(snapshot?.change_1d ?? 0);
    const week = Number(snapshot?.change_1w ?? change * 1.6);
    const month = Number(snapshot?.change_1m ?? change * 2.4);
    const unit = commodity.unit?.trim();

    const sessionTone =
      change >= 2 ? "strong buying interest"
        : change >= 0.5 ? "modest gains"
          : change >= -0.5 ? "muted action"
            : change >= -2 ? "selective selling"
              : "broad-based pressure";

    const monthTone =
      month >= 5 ? "an extended uptrend over the past month"
        : month >= 0 ? "stable price action over the past month"
          : month >= -5 ? "some consolidation over the past month"
            : "a weaker month with elevated volatility";

    const contextTitle = unit ? `${groupLabel} · ${unit}` : groupLabel;

    return {
      contextTitle,
      contextBody:
        commodity.description?.trim() ||
        `${commodity.name} (${commodity.symbol}) is tracked as a ${groupLabel.toLowerCase()} benchmark${unit ? ` quoted in ${unit}` : ""}. ` +
        `Prices reflect global supply-demand balances, macro conditions, and sector-specific catalysts.`,
      narrative:
        `${commodity.name} is currently trading with ${sessionTone} (${this.fmtPct(change)} today, ${this.fmtPct(week)} this week), showing ${monthTone}. ` +
        `Positioning continues to be shaped by dollar moves, inflation expectations, and ${groupLabel.toLowerCase()} sector flows.`,
      groupNarrative:
        `The ${groupLabel.toLowerCase()} complex continues to be driven by macro liquidity, currency moves, and physical market balances. ` +
        `Leading benchmarks in this group tend to lead capital flows during risk-on and inflation-hedge cycles.`,
    };
  }

  private toRelatedItem(
    row: CommodityDetailRecord & { snapshot?: CommodityDetailSnapshotRecord },
    currency: string,
  ): CommodityDetailRelatedItem {
    const price = Number(row.snapshot?.price ?? 0);
    const change = Number(row.snapshot?.change_1d ?? 0);
    const symbol = this.normalizeSymbolDisplay(row.symbol);
    return {
      id: row.commodity_id,
      symbol,
      name: row.name,
      slug: row.slug ?? symbol.toLowerCase(),
      marketType: "commodity",
      priceFormatted: this.fmtCurrency(price, currency),
      change24h: Number(change.toFixed(2)),
      sparkline: row.snapshot?.sparkline_7d,
      logo: withCommodityLogo({ logo: row.logo, symbol, name: row.name, group: row.group }),
    };
  }

  private toNewsItem(record: CommodityDetailNewsRecord): CommodityDetailNewsItem {
    return {
      id: String((record as { _id?: unknown })._id ?? ""),
      category: record.category ?? record.market ?? "Commodities",
      title: record.title ?? "",
      summary: record.summary ?? "",
      time: this.relTime(record.published_at),
      source: record.source,
      url: record.url,
    };
  }

  private buildMockNews(
    commodity: CommodityDetailRecord,
    groupLabel: string,
    change24h: number,
  ): CommodityDetailNewsItem[] {
    const trend = change24h >= 0 ? "rallies" : "slides";
    return [
      {
        id: "mock-1",
        category: "Commodities",
        title: `${commodity.name} ${trend} as ${groupLabel.toLowerCase()} markets react to macro data`,
        summary: `${commodity.symbol} moves with broader ${groupLabel.toLowerCase()} flows as traders reposition around inflation and dollar dynamics.`,
        time: "4h ago",
      },
      {
        id: "mock-2",
        category: groupLabel,
        title: `Institutional flows ${change24h >= 0 ? "support" : "pressure"} ${commodity.symbol} benchmarks`,
        summary: `Physical and financial demand indicators suggest ${change24h >= 0 ? "renewed interest" : "near-term caution"} across related ${groupLabel.toLowerCase()} contracts.`,
        time: "1d ago",
      },
    ];
  }

  async getDetail(slug: string): Promise<CommodityDetailResponse> {
    const commodity = await this.repo.getCommodityBySlug(slug);
    if (!commodity) {
      throw new HttpException(`Commodity '${slug}' not found.`, HttpStatus.NOT_FOUND);
    }

    const groupLabel = this.groupLabel(commodity.group);
    const [snapshot, related, news] = await Promise.all([
      this.repo.getSnapshot(commodity.commodity_id),
      this.repo.getRelatedCommodities(commodity.commodity_id, commodity.group, 6),
      this.repo.getCommodityNews(commodity.symbol, commodity.name, commodity.group, 4),
    ]);

    const currency = "USD";
    const price = Number(snapshot?.price ?? 0);
    const change24h = Number(snapshot?.change_1d ?? 0);
    const context = this.buildContext(commodity, snapshot, groupLabel);
    const twelveDataSymbol = this.resolveTwelveDataSymbol(commodity);
    const twelveDataAvailable = Boolean((process.env.TWELVEDATA_API_KEY ?? "").trim()) && Boolean(twelveDataSymbol);
    const symbol = this.normalizeSymbolDisplay(commodity.symbol);

    const newsItems = news.length > 0
      ? news.map((row) => this.toNewsItem(row))
      : this.buildMockNews(commodity, groupLabel, change24h);

    return {
      id: commodity.commodity_id,
      symbol,
      slug: commodity.slug ?? symbol.toLowerCase(),
      name: commodity.name,
      logo: withCommodityLogo({ logo: commodity.logo, symbol, name: commodity.name, group: commodity.group }),
      description:
        this.firstSentences(commodity.description, 2) ||
        `${commodity.name} (${symbol}) — ${groupLabel}${commodity.unit ? ` · ${commodity.unit}` : ""}.`,
      group: commodity.group ?? "other",
      groupLabel,
      unit: commodity.unit,
      benchmark: commodity.benchmark,
      category: commodity.category ?? "Commodity",
      currency,
      marketType: "commodity",
      price,
      priceFormatted: this.fmtCurrency(price, currency),
      change24h: Number(change24h.toFixed(2)),
      contextTitle: context.contextTitle,
      contextBody: context.contextBody,
      narrative: context.narrative,
      groupNarrative: context.groupNarrative,
      quickFacts: this.toQuickFacts(commodity, snapshot, groupLabel),
      metrics: this.toMetrics(commodity, snapshot, currency),
      performance: this.toPerformance(snapshot),
      related: related.map((row) => this.toRelatedItem(row, currency)),
      news: newsItems,
      twelveDataSymbol,
      twelveDataAvailable,
      generatedAt: new Date().toISOString(),
    };
  }

  async getRelated(slug: string): Promise<CommodityDetailRelatedResponse> {
    const commodity = await this.repo.getCommodityBySlug(slug);
    if (!commodity) throw new HttpException(`Commodity '${slug}' not found.`, HttpStatus.NOT_FOUND);
    const rows = await this.repo.getRelatedCommodities(commodity.commodity_id, commodity.group, 6);
    return {
      items: rows.map((row) => this.toRelatedItem(row, "USD")),
      generatedAt: new Date().toISOString(),
    };
  }

  async getNews(slug: string, query: CommodityDetailNewsQueryDto): Promise<CommodityDetailNewsResponse> {
    const commodity = await this.repo.getCommodityBySlug(slug);
    if (!commodity) throw new HttpException(`Commodity '${slug}' not found.`, HttpStatus.NOT_FOUND);
    const limit = query.limit ?? 6;
    const groupLabel = this.groupLabel(commodity.group);
    const rows = await this.repo.getCommodityNews(commodity.symbol, commodity.name, commodity.group, limit);
    const snapshot = await this.repo.getSnapshot(commodity.commodity_id);
    const change24h = Number(snapshot?.change_1d ?? 0);
    const items = rows.length > 0
      ? rows.map((row) => this.toNewsItem(row))
      : this.buildMockNews(commodity, groupLabel, change24h);
    return { items, generatedAt: new Date().toISOString() };
  }

  async getChart(slug: string, query: CommodityDetailChartQueryDto): Promise<CommodityDetailChartResponse> {
    const commodity = await this.repo.getCommodityBySlug(slug);
    if (!commodity) throw new HttpException(`Commodity '${slug}' not found.`, HttpStatus.NOT_FOUND);

    const timeframe: CommodityDetailTimeframe = query.timeframe ?? "1Y";
    const plan = TIMEFRAME_PLAN[timeframe];
    const symbol = this.resolveTwelveDataSymbol(commodity);
    if (!symbol) {
      throw new HttpException("Commodity symbol is missing for chart lookup.", HttpStatus.BAD_REQUEST);
    }

    const series = await this.twelveData.getTimeSeries(symbol, plan.interval, plan.outputsize, {
      exchange: query.exchange?.trim(),
    });
    return this.buildChartResponse(series, commodity, timeframe, plan.interval, symbol);
  }

  private buildChartResponse(
    series: TwelveDataSeries,
    commodity: CommodityDetailRecord,
    timeframe: CommodityDetailTimeframe,
    interval: TwelveDataInterval,
    symbol: string,
  ): CommodityDetailChartResponse {
    const points: CommodityDetailChartPoint[] = series.values.map((row) => ({
      datetime: row.datetime,
      label: this.formatLabel(row.datetime, timeframe),
      price: Number(row.close),
      volume: Math.max(0, Number(row.volume)),
    }));

    if (points.length === 0) {
      throw new HttpException("No chart data returned from Twelve Data.", HttpStatus.NOT_FOUND);
    }

    const labels = points.map((p) => p.label);
    const prices = points.map((p) => p.price);
    const volumes = points.map((p) => p.volume);

    const open = Number(series.values[0]?.open ?? prices[0]);
    const high = series.values.reduce((m, v) => Math.max(m, Number(v.high) || 0), -Infinity);
    const low = series.values.reduce((m, v) => (Number(v.low) > 0 ? Math.min(m, Number(v.low)) : m), Infinity);
    const close = Number(series.values[series.values.length - 1]?.close ?? prices[prices.length - 1]);
    const totalVolume = volumes.reduce((a, b) => a + b, 0);
    const avgVolume = volumes.length ? totalVolume / volumes.length : 0;

    return {
      symbol: this.normalizeSymbolDisplay(commodity.symbol),
      twelveDataSymbol: symbol,
      exchange: series.meta.exchange || "",
      currency: series.meta.currency || "USD",
      timeframe,
      interval,
      source: "twelve-data",
      labels,
      prices,
      volumes,
      points,
      open: Number(open),
      high: Number.isFinite(high) ? high : Math.max(...prices),
      low: Number.isFinite(low) ? low : Math.min(...prices),
      close: Number(close),
      volume: this.formatVolume(totalVolume),
      avgVolume: this.formatVolume(avgVolume),
      generatedAt: new Date().toISOString(),
    };
  }

  private formatLabel(datetime: string, timeframe: CommodityDetailTimeframe): string {
    if (!datetime) return "";
    const isDateOnly = !datetime.includes(":");
    const parsed = new Date(isDateOnly ? `${datetime}T00:00:00Z` : `${datetime.replace(" ", "T")}Z`);
    if (Number.isNaN(parsed.getTime())) return datetime;
    if (timeframe === "1D") {
      return parsed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    if (timeframe === "7D") {
      return parsed.toLocaleDateString("en-US", { weekday: "short" });
    }
    if (timeframe === "30D" || timeframe === "90D") {
      return parsed.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
    }
    if (timeframe === "1Y") {
      return parsed.toLocaleDateString("en-US", { month: "short" });
    }
    return parsed.toLocaleDateString("en-US", { year: "numeric" });
  }
}
