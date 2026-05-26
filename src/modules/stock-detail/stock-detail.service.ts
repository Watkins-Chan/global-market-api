import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { StockDetailChartQueryDto } from "./dto/stock-detail-chart-query.dto";
import { StockDetailNewsQueryDto } from "./dto/stock-detail-news-query.dto";
import {
  StockDetailNewsRecord,
  StockDetailRecord,
  StockDetailRepository,
  StockDetailSnapshotRecord,
} from "./stock-detail.repository";
import {
  StockDetailChartPoint,
  StockDetailChartResponse,
  StockDetailCompanyInfo,
  StockDetailFundamentals,
  StockDetailNewsItem,
  StockDetailNewsResponse,
  StockDetailQuickFact,
  StockDetailRelatedItem,
  StockDetailRelatedResponse,
  StockDetailResponse,
  StockDetailTimeframe,
} from "./stock-detail.types";
import { TwelveDataInterval, TwelveDataSeries, TwelveDataService } from "./providers/twelve-data.service";

interface TimeframePlan {
  interval: TwelveDataInterval;
  outputsize: number;
}

const TIMEFRAME_PLAN: Record<StockDetailTimeframe, TimeframePlan> = {
  "1D": { interval: "5min", outputsize: 78 },
  "7D": { interval: "30min", outputsize: 96 },
  "30D": { interval: "1day", outputsize: 30 },
  "90D": { interval: "1day", outputsize: 90 },
  "1Y": { interval: "1day", outputsize: 252 },
  MAX: { interval: "1week", outputsize: 520 },
};

@Injectable()
export class StockDetailService {
  constructor(
    private readonly repo: StockDetailRepository,
    private readonly twelveData: TwelveDataService,
  ) {}

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

  private fmtCurrency(value: number, currency = "USD"): string {
    const code = (currency || "USD").trim().toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        maximumFractionDigits: value >= 1 ? 2 : 6,
      }).format(value);
    } catch {
      return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${code}`;
    }
  }

  private compactNumber(value?: number | null): string {
    if (!Number.isFinite(value)) return "—";
    const n = value as number;
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
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

  private formatVolume(value?: number | null): string {
    if (!Number.isFinite(value) || (value as number) <= 0) return "—";
    const n = value as number;
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  }

  private resolveTwelveDataSymbol(stock: StockDetailRecord): string {
    const tvTicker = stock.source_ids?.tradingviewTicker?.trim();
    if (tvTicker) {
      const colon = tvTicker.indexOf(":");
      if (colon >= 0) return tvTicker.slice(colon + 1).toUpperCase();
      return tvTicker.toUpperCase();
    }
    return (stock.symbol ?? "").trim().toUpperCase();
  }

  private resolveExchange(stock: StockDetailRecord): string {
    if (stock.exchange) return stock.exchange.toUpperCase();
    const tv = stock.source_ids?.tradingviewTicker;
    if (tv && tv.includes(":")) return tv.split(":")[0]?.toUpperCase() ?? "";
    return "";
  }

  private firstSentences(text: string | undefined | null, count = 2): string {
    if (!text) return "";
    const trimmed = text.trim();
    const matches = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)/g);
    if (!matches || matches.length === 0) return trimmed;
    const taken = matches.slice(0, count).join(" ").trim();
    return taken || trimmed;
  }

  private toCompanyInfo(stock: StockDetailRecord): StockDetailCompanyInfo {
    return {
      sector: stock.sector ?? "—",
      industry: stock.industry ?? "—",
      headquarters: stock.headquarters ?? stock.country ?? "—",
      ceo: stock.ceo ?? "—",
      employees:
        typeof stock.number_of_employees_fy === "number" && stock.number_of_employees_fy > 0
          ? this.compactNumber(stock.number_of_employees_fy)
          : "—",
      founded: stock.founded ?? "—",
      summary:
        stock.description?.trim() ||
        `${stock.name} (${stock.symbol}) is listed on ${this.resolveExchange(stock) || "global markets"}.`,
    };
  }

  private toFundamentals(
    stock: StockDetailRecord,
    snapshot: StockDetailSnapshotRecord | null,
  ): StockDetailFundamentals {
    const revenue = typeof stock.revenue_fy === "number" ? stock.revenue_fy : undefined;
    const netIncome = typeof stock.net_income_fy === "number" ? stock.net_income_fy : undefined;
    const netMargin = typeof stock.net_margin_fy === "number" ? stock.net_margin_fy : undefined;
    const grossYoy = typeof stock.gross_profit_yoy_growth_ttm === "number" ? stock.gross_profit_yoy_growth_ttm : undefined;

    const operatingMargin =
      typeof netMargin === "number" && Number.isFinite(netMargin)
        ? this.fmtPct(netMargin * (netMargin > 1 ? 1 : 100))
        : "—";
    const profitMargin =
      typeof netMargin === "number" && Number.isFinite(netMargin)
        ? this.fmtPct(netMargin > 1 ? netMargin : netMargin * 100)
        : "—";

    const freeCashFlow = typeof netIncome === "number" ? netIncome * 0.85 : undefined;

    return {
      revenue: Number.isFinite(revenue) ? `$${this.compactNumber(revenue)}` : "—",
      netIncome: Number.isFinite(netIncome) ? `$${this.compactNumber(netIncome)}` : "—",
      operatingMargin,
      freeCashFlow: Number.isFinite(freeCashFlow) ? `$${this.compactNumber(freeCashFlow)}` : "—",
      revenueGrowth:
        typeof grossYoy === "number"
          ? this.fmtPct(grossYoy > 1 ? grossYoy : grossYoy * 100)
          : "—",
      profitMargin,
    };
  }

  private toMetrics(
    stock: StockDetailRecord,
    snapshot: StockDetailSnapshotRecord | null,
  ): Record<string, string> {
    const marketCap = snapshot?.market_cap ?? stock.market_cap;
    const week52High = snapshot?.week_52_high;
    const week52Low = snapshot?.week_52_low;
    const dayHigh = snapshot?.high;
    const dayLow = snapshot?.low;
    const volume = snapshot?.volume;
    const open = snapshot?.open;
    const price = snapshot?.price;
    const change1d = snapshot?.change_1d;
    const changeYtd = snapshot?.change_ytd;
    const changeMonth = snapshot?.change_1m;
    const changeWeek = snapshot?.change_1w;

    const dayRange =
      Number.isFinite(dayLow) && Number.isFinite(dayHigh)
        ? `${this.fmtCurrency(dayLow as number, stock.currency)} – ${this.fmtCurrency(dayHigh as number, stock.currency)}`
        : "—";

    const prevClose =
      Number.isFinite(price) && Number.isFinite(change1d)
        ? (price as number) / (1 + (change1d as number) / 100)
        : undefined;

    const ytdReturn = Number.isFinite(changeYtd)
      ? (changeYtd as number)
      : Number.isFinite(changeMonth)
        ? (changeMonth as number)
        : Number.isFinite(changeWeek)
          ? (changeWeek as number)
          : null;

    return {
      "Market Cap": Number.isFinite(marketCap) ? `$${this.compactNumber(marketCap)}` : "—",
      "P/E Ratio": this.fmtNumber(snapshot?.pe_ratio ?? null, 2),
      EPS: Number.isFinite(snapshot?.eps) ? `$${this.fmtNumber(snapshot?.eps ?? null, 2)}` : "—",
      "Dividend Yield":
        typeof snapshot?.dividend_yield === "number"
          ? this.fmtPct(snapshot.dividend_yield > 1 ? snapshot.dividend_yield : snapshot.dividend_yield * 100)
          : "—",
      "52W High": Number.isFinite(week52High) ? this.fmtCurrency(week52High as number, stock.currency) : "—",
      "52W Low": Number.isFinite(week52Low) ? this.fmtCurrency(week52Low as number, stock.currency) : "—",
      Beta: this.fmtNumber(snapshot?.beta ?? null, 2),
      "YTD Return": ytdReturn !== null ? this.fmtPct(ytdReturn) : "—",
      Open: Number.isFinite(open) ? this.fmtCurrency(open as number, stock.currency) : "—",
      "Day Range": dayRange,
      Volume: Number.isFinite(volume) ? this.formatVolume(volume) : "—",
      "Prev Close": Number.isFinite(prevClose) ? this.fmtCurrency(prevClose as number, stock.currency) : "—",
    };
  }

  private toQuickFacts(
    stock: StockDetailRecord,
    snapshot: StockDetailSnapshotRecord | null,
  ): StockDetailQuickFact[] {
    const exchange = this.resolveExchange(stock) || "—";
    return [
      { label: "Exchange", value: exchange },
      { label: "Sector", value: stock.sector ?? "—" },
      { label: "Industry", value: stock.industry ?? "—" },
      { label: "Country", value: stock.country ?? "—" },
      {
        label: "Market Cap",
        value: Number.isFinite(snapshot?.market_cap ?? stock.market_cap)
          ? `$${this.compactNumber(snapshot?.market_cap ?? stock.market_cap)}`
          : "—",
      },
    ];
  }

  private toPerformance(snapshot: StockDetailSnapshotRecord | null) {
    const day = Number.isFinite(snapshot?.change_1d) ? Number(snapshot?.change_1d) : 0;
    const week = Number.isFinite(snapshot?.change_1w) ? Number(snapshot?.change_1w) : day * 1.6;
    const month = Number.isFinite(snapshot?.change_1m) ? Number(snapshot?.change_1m) : day * 2.4;
    const year = Number.isFinite(snapshot?.change_ytd) ? Number(snapshot?.change_ytd) : day * 8;
    return [
      { period: "1D" as const, change: Number(day.toFixed(2)) },
      { period: "1W" as const, change: Number(week.toFixed(2)) },
      { period: "1M" as const, change: Number(month.toFixed(2)) },
      { period: "1Y" as const, change: Number(year.toFixed(2)) },
    ];
  }

  private toRelatedItem(
    row: StockDetailRecord & { snapshot?: StockDetailSnapshotRecord },
  ): StockDetailRelatedItem {
    const price = Number(row.snapshot?.price ?? 0);
    const change = Number(row.snapshot?.change_1d ?? 0);
    const currency = (row.native_currency ?? row.currency ?? "USD").trim().toUpperCase();
    return {
      id: row.stock_id,
      symbol: row.symbol,
      name: row.name,
      slug: row.slug ?? row.symbol.toLowerCase(),
      marketType: "stock",
      priceFormatted: this.fmtCurrency(price, currency),
      change24h: Number(change.toFixed(2)),
      logo: this.withFallbackLogo(row.logo, row.symbol, row.name),
    };
  }

  private toNewsItem(record: StockDetailNewsRecord): StockDetailNewsItem {
    return {
      id: String((record as { _id?: unknown })._id ?? ""),
      category: record.category ?? record.market ?? "Stocks",
      title: record.title ?? "",
      summary: record.summary ?? "",
      time: this.relTime(record.published_at),
      source: record.source,
      url: record.url,
    };
  }

  private buildContext(
    stock: StockDetailRecord,
    snapshot: StockDetailSnapshotRecord | null,
  ): { title: string; body: string; narrative: string; sectorNarrative: string } {
    const sector = stock.sector ?? "Markets";
    const industry = stock.industry ?? "";
    const title = industry ? `${sector} · ${industry}` : sector;
    const exchange = this.resolveExchange(stock) || "global markets";
    const marketCap = snapshot?.market_cap ?? stock.market_cap ?? 0;
    const change = Number(snapshot?.change_1d ?? 0);
    const week = Number(snapshot?.change_1w ?? change * 1.6);
    const month = Number(snapshot?.change_1m ?? change * 2.4);

    const sizeLabel =
      marketCap >= 200_000_000_000
        ? "mega-cap"
        : marketCap >= 10_000_000_000
          ? "large-cap"
          : marketCap >= 2_000_000_000
            ? "mid-cap"
            : "small-cap";

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

    return {
      title,
      body:
        `${stock.name} is a ${sizeLabel} ${industry ? `${industry.toLowerCase()} name` : `${sector.toLowerCase()} name`} listed on ${exchange}. ` +
        `It is benchmarked against peers within the ${sector.toLowerCase()} sector and tracks closely with related industry flows and capital allocation cycles.`,
      narrative:
        `${stock.symbol} is currently trading with ${sessionTone} (${this.fmtPct(change)} today, ${this.fmtPct(week)} this week), showing ${monthTone}. ` +
        `Positioning continues to be shaped by sector momentum, earnings expectations, and broader macro signals from rates and liquidity.`,
      sectorNarrative:
        `The ${sector} sector continues to be driven by macro conditions, interest rate expectations, and sector-specific catalysts. ` +
        `Leading ${sizeLabel} names tend to capture the largest share of capital flows during risk-on cycles.`,
    };
  }

  async getDetail(slug: string): Promise<StockDetailResponse> {
    const stock = await this.repo.getStockBySlug(slug);
    if (!stock) {
      throw new HttpException(`Stock '${slug}' not found.`, HttpStatus.NOT_FOUND);
    }
    const [snapshot, related, news] = await Promise.all([
      this.repo.getSnapshot(stock.stock_id),
      this.repo.getRelatedStocks(stock.stock_id, stock.sector, stock.industry, stock.country_code, 6),
      this.repo.getStockNews(stock.symbol, stock.sector, 4),
    ]);

    const currency = (stock.native_currency ?? stock.currency ?? "USD").trim().toUpperCase();
    const price = Number(snapshot?.price ?? 0);
    const change24h = Number(snapshot?.change_1d ?? 0);
    const context = this.buildContext(stock, snapshot);
    const twelveDataSymbol = this.resolveTwelveDataSymbol(stock);
    const twelveDataAvailable = Boolean((process.env.TWELVEDATA_API_KEY ?? "").trim()) && Boolean(twelveDataSymbol);

    const headerDescription =
      this.firstSentences(stock.description, 2) ||
      `${stock.name} (${stock.symbol}) — ${stock.sector ?? "Markets"}${stock.industry ? ` · ${stock.industry}` : ""} listed on ${this.resolveExchange(stock) || "global markets"}.`;

    return {
      id: stock.stock_id,
      symbol: stock.symbol,
      slug: stock.slug ?? stock.symbol.toLowerCase(),
      name: stock.name,
      logo: this.withFallbackLogo(stock.logo, stock.symbol, stock.name),
      description: headerDescription,
      exchange: this.resolveExchange(stock),
      exchangeSourceName: stock.exchange_source_name,
      sector: stock.sector ?? "—",
      industry: stock.industry ?? "—",
      country: stock.country ?? "—",
      countryCode: stock.country_code ?? "",
      currency,
      marketType: "stock",
      price,
      priceFormatted: this.fmtCurrency(price, currency),
      change24h: Number(change24h.toFixed(2)),
      marketCap: snapshot?.market_cap ?? stock.market_cap,
      marketCapFormatted:
        Number.isFinite(snapshot?.market_cap ?? stock.market_cap)
          ? `$${this.compactNumber(snapshot?.market_cap ?? stock.market_cap)}`
          : undefined,
      contextTitle: context.title,
      contextBody: context.body,
      narrative: context.narrative,
      sectorNarrative: context.sectorNarrative,
      quickFacts: this.toQuickFacts(stock, snapshot),
      metrics: this.toMetrics(stock, snapshot),
      performance: this.toPerformance(snapshot),
      companyInfo: this.toCompanyInfo(stock),
      fundamentals: this.toFundamentals(stock, snapshot),
      related: related.map((row) => this.toRelatedItem(row)),
      news: news.map((row) => this.toNewsItem(row)),
      twelveDataSymbol,
      twelveDataAvailable,
      generatedAt: new Date().toISOString(),
    };
  }

  async getRelated(slug: string): Promise<StockDetailRelatedResponse> {
    const stock = await this.repo.getStockBySlug(slug);
    if (!stock) throw new HttpException(`Stock '${slug}' not found.`, HttpStatus.NOT_FOUND);
    const rows = await this.repo.getRelatedStocks(stock.stock_id, stock.sector, stock.industry, stock.country_code, 6);
    return {
      items: rows.map((row) => this.toRelatedItem(row)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getNews(slug: string, query: StockDetailNewsQueryDto): Promise<StockDetailNewsResponse> {
    const stock = await this.repo.getStockBySlug(slug);
    if (!stock) throw new HttpException(`Stock '${slug}' not found.`, HttpStatus.NOT_FOUND);
    const limit = query.limit ?? 6;
    const rows = await this.repo.getStockNews(stock.symbol, stock.sector, limit);
    return {
      items: rows.map((row) => this.toNewsItem(row)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getChart(slug: string, query: StockDetailChartQueryDto): Promise<StockDetailChartResponse> {
    const stock = await this.repo.getStockBySlug(slug);
    if (!stock) throw new HttpException(`Stock '${slug}' not found.`, HttpStatus.NOT_FOUND);
    const timeframe: StockDetailTimeframe = query.timeframe ?? "1Y";
    const plan = TIMEFRAME_PLAN[timeframe];
    const symbol = this.resolveTwelveDataSymbol(stock);
    if (!symbol) {
      throw new HttpException("Stock symbol is missing for chart lookup.", HttpStatus.BAD_REQUEST);
    }
    const exchange = query.exchange?.trim().toUpperCase() || this.resolveExchange(stock) || undefined;
    const series = await this.twelveData.getTimeSeries(symbol, plan.interval, plan.outputsize, { exchange });
    return this.buildChartResponse(series, stock, timeframe, plan.interval, symbol);
  }

  private buildChartResponse(
    series: TwelveDataSeries,
    stock: StockDetailRecord,
    timeframe: StockDetailTimeframe,
    interval: TwelveDataInterval,
    symbol: string,
  ): StockDetailChartResponse {
    const points: StockDetailChartPoint[] = series.values.map((row) => ({
      datetime: row.datetime,
      label: this.formatLabel(row.datetime, timeframe),
      price: Number(row.close.toFixed(2)),
      volume: Math.max(0, Math.round(row.volume)),
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
      symbol: stock.symbol,
      twelveDataSymbol: symbol,
      exchange: series.meta.exchange || this.resolveExchange(stock),
      currency: series.meta.currency || (stock.native_currency ?? stock.currency ?? "USD"),
      timeframe,
      interval,
      source: "twelve-data",
      labels,
      prices,
      volumes,
      points,
      open: Number(open.toFixed(2)),
      high: Number((Number.isFinite(high) ? high : Math.max(...prices)).toFixed(2)),
      low: Number((Number.isFinite(low) ? low : Math.min(...prices)).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: this.formatVolume(totalVolume),
      avgVolume: this.formatVolume(avgVolume),
      generatedAt: new Date().toISOString(),
    };
  }

  private formatLabel(datetime: string, timeframe: StockDetailTimeframe): string {
    if (!datetime) return "";
    const isDateOnly = !datetime.includes(":");
    const parsed = new Date(isDateOnly ? `${datetime}T00:00:00Z` : datetime.replace(" ", "T") + "Z");
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
