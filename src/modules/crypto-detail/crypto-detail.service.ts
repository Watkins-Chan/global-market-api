import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { withCryptoLogo } from "../../common/asset-logo.util";
import { TwelveDataInterval, TwelveDataSeries, TwelveDataService } from "../stock-detail/providers/twelve-data.service";
import { CryptoDetailChartQueryDto } from "./dto/crypto-detail-chart-query.dto";
import { CryptoDetailNewsQueryDto } from "./dto/crypto-detail-news-query.dto";
import {
  CryptoDetailNewsRecord,
  CryptoDetailRecord,
  CryptoDetailRepository,
  CryptoDetailSnapshotRecord,
} from "./crypto-detail.repository";
import {
  CryptoDetailChartPoint,
  CryptoDetailChartResponse,
  CryptoDetailKeyStat,
  CryptoDetailNewsItem,
  CryptoDetailNewsResponse,
  CryptoDetailOnChainData,
  CryptoDetailPerformancePoint,
  CryptoDetailQuickFact,
  CryptoDetailRelatedItem,
  CryptoDetailRelatedResponse,
  CryptoDetailResources,
  CryptoDetailResponse,
  CryptoDetailSentiment,
  CryptoDetailTimeframe,
  CryptoDetailTokenOverview,
} from "./crypto-detail.types";

interface TimeframePlan {
  interval: TwelveDataInterval;
  outputsize: number;
}

const TIMEFRAME_PLAN: Record<CryptoDetailTimeframe, TimeframePlan> = {
  "1D": { interval: "5min", outputsize: 78 },
  "7D": { interval: "30min", outputsize: 96 },
  "30D": { interval: "1day", outputsize: 30 },
  "90D": { interval: "1day", outputsize: 90 },
  "1Y": { interval: "1day", outputsize: 252 },
  MAX: { interval: "1week", outputsize: 520 },
};

@Injectable()
export class CryptoDetailService {
  constructor(
    private readonly repo: CryptoDetailRepository,
    private readonly twelveData: TwelveDataService,
  ) {}

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
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value as number);
  }

  private fmtPct(value?: number | null, digits = 2): string {
    if (!Number.isFinite(value)) return "—";
    const n = value as number;
    return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
  }

  private formatSupply(value?: number | null, symbol?: string): string {
    if (!Number.isFinite(value)) return "—";
    const sym = (symbol ?? "").trim().toUpperCase();
    return `${this.compactNumber(value)}${sym ? ` ${sym}` : ""}`;
  }

  private fmtUsdCompact(value?: number | null): string {
    if (!Number.isFinite(value)) return "—";
    return `$${this.compactNumber(value as number)}`;
  }

  private scanNum(snapshot: CryptoDetailSnapshotRecord | null, key: string): number | undefined {
    const raw = snapshot?.tradingview_scan?.[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
  }

  private scanStrings(snapshot: CryptoDetailSnapshotRecord | null, key: string): string[] {
    const raw = snapshot?.tradingview_scan?.[key];
    if (Array.isArray(raw)) {
      return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    }
    return [];
  }

  private uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
      const trimmed = v.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out;
  }

  private collectUrls(...sources: Array<string | string[] | undefined>): string[] {
    const flat: string[] = [];
    for (const src of sources) {
      if (!src) continue;
      if (Array.isArray(src)) flat.push(...src);
      else flat.push(src);
    }
    return this.uniqueStrings(flat);
  }

  private splitCategoryTokens(value: string): string[] {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private toResources(
    crypto: CryptoDetailRecord,
    snapshot: CryptoDetailSnapshotRecord | null,
  ): CryptoDetailResources {
    const categories = this.uniqueCategories([
      ...(crypto.profile_category ? this.splitCategoryTokens(crypto.profile_category) : []),
      ...(crypto.category ? this.splitCategoryTokens(crypto.category) : []),
      ...this.scanStrings(snapshot, "crypto_common_categories"),
    ]);

    return {
      categories,
      websites: this.collectUrls(crypto.website_url, crypto.website_urls),
      sourceCodes: this.collectUrls(crypto.source_code_url, crypto.source_code_urls),
      whitepapers: this.collectUrls(crypto.whitepaper_url, crypto.whitepaper_urls),
      explorers: this.collectUrls(crypto.explorer_urls),
      communities: this.collectUrls(crypto.community_url, crypto.community_urls),
    };
  }

  private toKeyStats(
    crypto: CryptoDetailRecord,
    snapshot: CryptoDetailSnapshotRecord | null,
    currency: string,
  ): CryptoDetailKeyStat[] {
    const sym = crypto.symbol.toUpperCase();
    const stats: CryptoDetailKeyStat[] = [];

    const marketCap = snapshot?.market_cap ?? this.scanNum(snapshot, "market_cap_calc");
    if (Number.isFinite(marketCap)) {
      stats.push({ label: "Market capitalization", value: `${this.fmtUsdCompact(marketCap)} ${currency}` });
    }

    const fdv = this.scanNum(snapshot, "market_cap_diluted_calc");
    if (Number.isFinite(fdv)) {
      stats.push({ label: "Fully diluted market cap", value: `${this.fmtUsdCompact(fdv)} ${currency}` });
    }

    const volume24h = snapshot?.volume_24h ?? this.scanNum(snapshot, "vc_24h_vol_cmc");
    if (Number.isFinite(volume24h)) {
      stats.push({ label: "Trading volume 24h", value: `${this.fmtUsdCompact(volume24h)} ${currency}` });
    }

    const volToMc =
      this.scanNum(snapshot, "vtmkc_24h_vol_to_market_cap") ??
      (Number.isFinite(marketCap) && Number.isFinite(volume24h) && (marketCap as number) > 0
        ? (volume24h as number) / (marketCap as number)
        : undefined);
    if (Number.isFinite(volToMc)) {
      stats.push({ label: "Volume / Market Cap", value: (volToMc as number).toFixed(4) });
    }

    const ath = snapshot?.ath ?? this.scanNum(snapshot, "high_all");
    if (Number.isFinite(ath)) {
      stats.push({ label: "All time high", value: `${this.fmtCurrency(ath as number, currency)} ${currency}` });
    }

    if (Number.isFinite(snapshot?.circulating_supply)) {
      stats.push({
        label: "Circulating supply",
        value: this.formatSupply(snapshot?.circulating_supply, sym),
      });
    }

    const maxSupply = snapshot?.max_supply ?? this.scanNum(snapshot, "max_supply");
    if (maxSupply === null) {
      stats.push({ label: "Max supply", value: "—" });
    } else if (Number.isFinite(maxSupply)) {
      stats.push({ label: "Max supply", value: this.formatSupply(maxSupply, sym) });
    }

    const totalSupply = snapshot?.total_supply ?? this.scanNum(snapshot, "total_supply");
    if (totalSupply === null) {
      stats.push({ label: "Total supply", value: "—" });
    } else if (Number.isFinite(totalSupply)) {
      stats.push({ label: "Total supply", value: this.formatSupply(totalSupply, sym) });
    }

    return stats;
  }

  private formatVolume(value?: number | null): string {
    if (!Number.isFinite(value) || (value as number) <= 0) return "—";
    const n = value as number;
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
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
    if (!matches || matches.length === 0) return trimmed;
    return matches.slice(0, count).join(" ").trim() || trimmed;
  }

  private primaryCategory(crypto: CryptoDetailRecord): string {
    const profile = crypto.profile_category?.split(",")[0]?.trim();
    const category = crypto.category?.split(",")[0]?.trim();
    return profile || category || "Cryptocurrency";
  }

  private formatTagLabel(raw: string): string {
    return raw
      .trim()
      .split(/[\s,_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  private tagDedupeKey(raw: string): string {
    const k = raw.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    if (k === "cryptocurrency" || k === "cryptocurrencies") return "crypto-class";
    return k;
  }

  private uniqueCategories(values: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
      const trimmed = v.trim();
      if (!trimmed) continue;
      const key = this.tagDedupeKey(trimmed);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(this.formatTagLabel(trimmed));
    }
    return out;
  }

  private refineHeaderTags(rawTokens: string[]): string[] {
    const seen = new Set<string>();
    const formatted: string[] = [];
    for (const token of rawTokens) {
      const key = this.tagDedupeKey(token);
      if (seen.has(key)) continue;
      seen.add(key);
      formatted.push(this.formatTagLabel(token));
    }

    const cryptoLike = formatted.filter((t) => /^cryptocurrenc/i.test(t));
    let result = formatted;
    if (cryptoLike.length > 1) {
      const keep = [...cryptoLike].sort((a, b) => b.length - a.length)[0];
      result = formatted.filter((t) => !/^cryptocurrenc/i.test(t) || t === keep);
    }

    if (result.length === 0) result = ["Cryptocurrency"];
    return result.slice(0, 3);
  }

  private buildTags(crypto: CryptoDetailRecord, snapshot: CryptoDetailSnapshotRecord | null): string[] {
    const tokens = [
      ...(crypto.profile_category ? this.splitCategoryTokens(crypto.profile_category) : []),
      ...(crypto.category ? this.splitCategoryTokens(crypto.category) : []),
      ...this.scanStrings(snapshot, "crypto_common_categories"),
    ];
    return this.refineHeaderTags(tokens);
  }

  private resolveTwelveDataSymbol(crypto: CryptoDetailRecord, quoteCurrency = "USD"): string {
    const base = (crypto.symbol ?? "").trim().toUpperCase();
    const quote = (quoteCurrency || "USD").trim().toUpperCase();
    if (!base) return "";
    return `${base}/${quote}`;
  }

  private toPerformance(snapshot: CryptoDetailSnapshotRecord | null): CryptoDetailPerformancePoint[] {
    const day = Number.isFinite(snapshot?.change_24h) ? Number(snapshot?.change_24h) : 0;
    const week = Number.isFinite(snapshot?.change_7d) ? Number(snapshot?.change_7d) : day * 1.6;
    const month = Number.isFinite(snapshot?.change_30d) ? Number(snapshot?.change_30d) : day * 2.4;
    const year = Number.isFinite(snapshot?.change_ytd) ? Number(snapshot?.change_ytd) : day * 8;
    return [
      { period: "1D", change: Number(day.toFixed(2)) },
      { period: "1W", change: Number(week.toFixed(2)) },
      { period: "1M", change: Number(month.toFixed(2)) },
      { period: "1Y", change: Number(year.toFixed(2)) },
    ];
  }

  private toMetrics(
    crypto: CryptoDetailRecord,
    snapshot: CryptoDetailSnapshotRecord | null,
    currency: string,
  ): Record<string, string> {
    const sym = crypto.symbol.toUpperCase();
    const maxSupply = snapshot?.max_supply;
    const totalSupply = snapshot?.total_supply;
    const rank = snapshot?.rank ?? crypto.rank;

    return {
      "Market Cap": Number.isFinite(snapshot?.market_cap)
        ? `$${this.compactNumber(snapshot?.market_cap)}`
        : "—",
      "Circulating Supply": this.formatSupply(snapshot?.circulating_supply, sym),
      "Total Supply":
        totalSupply === null || totalSupply === undefined
          ? "—"
          : this.formatSupply(totalSupply, sym),
      "Max Supply":
        maxSupply === null || maxSupply === undefined
          ? maxSupply === null ? "Unlimited" : "—"
          : this.formatSupply(maxSupply, sym),
      "24h Volume": this.formatVolume(snapshot?.volume_24h),
      "All-Time High": Number.isFinite(snapshot?.ath)
        ? this.fmtCurrency(snapshot?.ath as number, currency)
        : "—",
      "All-Time Low": Number.isFinite(snapshot?.atl)
        ? this.fmtCurrency(snapshot?.atl as number, currency)
        : "—",
      Dominance: Number.isFinite(snapshot?.dominance)
        ? `${(snapshot?.dominance as number).toFixed(1)}%`
        : rank
          ? `#${rank}`
          : "—",
    };
  }

  private toQuickFacts(
    crypto: CryptoDetailRecord,
    snapshot: CryptoDetailSnapshotRecord | null,
  ): CryptoDetailQuickFact[] {
    const category = this.primaryCategory(crypto);
    const ecosystem = crypto.ecosystem?.split(",")[0]?.trim();
    const consensus = crypto.consensus?.split(",")[0]?.trim();
    const rank = snapshot?.rank ?? crypto.rank;
    return [
      { label: "Rank", value: rank ? `#${rank}` : "—" },
      { label: "Category", value: category },
      { label: "Ecosystem", value: ecosystem || "—" },
      { label: "Consensus", value: consensus || "—" },
      {
        label: "Market Cap",
        value: Number.isFinite(snapshot?.market_cap)
          ? `$${this.compactNumber(snapshot?.market_cap)}`
          : "—",
      },
    ];
  }

  private mockTokenOverview(crypto: CryptoDetailRecord): CryptoDetailTokenOverview {
    const category = this.primaryCategory(crypto);
    const consensus =
      crypto.consensus?.split(",")[0]?.trim() ||
      "Proof of Stake / Hybrid consensus (varies by network)";
    const ecosystem = crypto.ecosystem?.split(",")[0]?.trim();
    const summary =
      crypto.description?.trim() ||
      `${crypto.name} (${crypto.symbol}) is a digital asset operating on a decentralized blockchain network.`;

    const useCaseByCategory: Record<string, string> = {
      "Store Of Value": "Decentralized digital store of value and peer-to-peer payment network",
      "Smart Contract Platform": "Smart contract platform for decentralized applications, DeFi, and NFTs",
      "Layer 1": "High-throughput blockchain for DeFi, NFTs, and consumer applications",
      "Exchange Token": "Exchange utility token and ecosystem gas token",
      Infrastructure: "Customizable blockchain infrastructure for enterprise and DeFi deployments",
    };
    const normalizedCategory = category.replace(/\s+/g, " ");
    const useCase =
      Object.entries(useCaseByCategory).find(([key]) =>
        normalizedCategory.toLowerCase().includes(key.toLowerCase()),
      )?.[1] ??
      `Digital asset within the ${ecosystem ?? normalizedCategory.toLowerCase()} ecosystem`;

    return {
      useCase,
      consensus,
      category,
      layer: ecosystem?.toLowerCase().includes("layer 2") ? "Layer 2" : "Layer 1",
      summary,
    };
  }

  private mockOnChainData(crypto: CryptoDetailRecord, change24h: number): CryptoDetailOnChainData {
    const seed = crypto.symbol.charCodeAt(0) + crypto.symbol.length;
    const activeBase = 200_000 + (seed * 17_000) % 1_500_000;
    const feeBase = 200_000 + (seed * 31_000) % 8_000_000;
    const whaleActivity =
      change24h >= 3 ? "Accumulating" : change24h <= -3 ? "Distributing" : "Stable";
    const exchangeFlows =
      change24h >= 1 ? "Net Outflow" : change24h <= -1 ? "Net Inflow" : "Neutral";

    return {
      activeAddresses: this.compactNumber(activeBase),
      whaleActivity,
      exchangeFlows,
      networkFees: `${this.formatVolume(feeBase)}/day`,
    };
  }

  private mockSentiment(change24h: number, name: string): CryptoDetailSentiment {
    const overall: CryptoDetailSentiment["overall"] =
      change24h >= 2 ? "bullish" : change24h <= -2 ? "bearish" : "neutral";
    const socialSentiment =
      change24h >= 4 ? "Very Positive" : change24h >= 1 ? "Positive" : change24h <= -4 ? "Negative" : "Neutral";
    const marketMomentum =
      change24h >= 4 ? "Strong Uptrend" : change24h >= 1 ? "Moderate Uptrend" : change24h <= -4 ? "Sharp Downtrend" : "Sideways";
    const investorPositioning =
      change24h >= 2 ? "Net Long" : change24h <= -2 ? "Net Short" : "Neutral";

    return {
      overall,
      socialSentiment,
      marketMomentum,
      investorPositioning,
      summary:
        `${name} sentiment is ${overall} with ${marketMomentum.toLowerCase()} price action over the past 24 hours. ` +
        `On-chain flows and positioning suggest ${investorPositioning.toLowerCase()} bias as traders respond to macro liquidity and sector rotation.`,
    };
  }

  private buildContext(
    crypto: CryptoDetailRecord,
    snapshot: CryptoDetailSnapshotRecord | null,
  ): { contextTitle: string; contextBody: string; narrative: string; ecosystemNarrative: string } {
    const category = this.primaryCategory(crypto);
    const tags = this.buildTags(crypto, snapshot);
    const contextTitle = tags.join(" · ");
    const change = Number(snapshot?.change_24h ?? 0);
    const week = Number(snapshot?.change_7d ?? change * 1.6);
    const ecosystem = crypto.ecosystem?.split(",")[0]?.trim();

    const contextBody =
      crypto.description?.trim() ||
      `${crypto.name} is a leading digital asset within the ${category.toLowerCase()} segment` +
        `${ecosystem ? ` of the ${ecosystem} ecosystem` : ""}. ` +
        `It trades globally across major exchanges with 24/7 liquidity and transparent on-chain settlement.`;

    const narrativeTone =
      change >= 2 ? "constructive momentum"
        : change >= 0.5 ? "steady accumulation"
          : change >= -0.5 ? "range-bound consolidation"
            : change >= -2 ? "selective profit-taking"
              : "defensive repositioning";

    const narrative =
      `${crypto.name}'s market narrative reflects ${narrativeTone} (${this.fmtPct(change)} over 24h, ${this.fmtPct(week)} over 7d). ` +
      `Capital flows continue to be shaped by macro liquidity, regulatory developments, and relative strength within the broader crypto market.`;

    const ecosystemNarrative =
      ecosystem
        ? `${crypto.name} participates in the ${ecosystem} ecosystem, competing for developer activity, TVL, and user adoption. ` +
          `Cross-chain liquidity and protocol innovation remain key drivers of long-term relevance.`
        : `${crypto.name} anchors activity within the ${category.toLowerCase()} vertical, where liquidity depth and exchange listings determine short-term price discovery.`;

    return { contextTitle, contextBody, narrative, ecosystemNarrative };
  }

  private toRelatedItem(
    row: CryptoDetailRecord & { snapshot?: CryptoDetailSnapshotRecord },
  ): CryptoDetailRelatedItem {
    const price = Number(row.snapshot?.price ?? 0);
    const change = Number(row.snapshot?.change_24h ?? 0);
    const currency = (row.snapshot?.quote_currency ?? "USD").trim().toUpperCase();
    const symbol = row.symbol;
    return {
      id: row.crypto_id,
      symbol,
      name: row.name,
      slug: row.slug ?? symbol.toLowerCase(),
      marketType: "crypto",
      priceFormatted: this.fmtCurrency(price, currency),
      change24h: Number(change.toFixed(2)),
      logo: withCryptoLogo({
        logo: row.logo,
        tickerView: row.snapshot?.tradingview_scan?.ticker_view,
        symbol,
        name: row.name,
      }),
    };
  }

  private toNewsItem(record: CryptoDetailNewsRecord): CryptoDetailNewsItem {
    return {
      id: String((record as { _id?: unknown })._id ?? ""),
      category: record.category ?? record.market ?? "Crypto",
      title: record.title ?? "",
      summary: record.summary ?? "",
      time: this.relTime(record.published_at),
      source: record.source,
      url: record.url,
    };
  }

  private buildMockNews(crypto: CryptoDetailRecord, change24h: number): CryptoDetailNewsItem[] {
    const trend = change24h >= 0 ? "rallies" : "slides";
    const category = this.primaryCategory(crypto);
    return [
      {
        id: "mock-1",
        category: "Markets",
        title: `${crypto.name} ${trend} as traders reposition ahead of macro data`,
        summary: `${crypto.symbol} moves with broader crypto beta as ${category.toLowerCase()} flows respond to liquidity and risk appetite.`,
        time: "3h ago",
      },
      {
        id: "mock-2",
        category: "On-Chain",
        title: `${crypto.symbol} network activity ${change24h >= 0 ? "picks up" : "cools"} on major exchanges`,
        summary: `Wallet flows and exchange balances suggest ${change24h >= 0 ? "renewed accumulation" : "short-term distribution"} among large holders.`,
        time: "8h ago",
      },
    ];
  }

  async getDetail(slug: string): Promise<CryptoDetailResponse> {
    const crypto = await this.repo.getCryptoBySlug(slug);
    if (!crypto) {
      throw new HttpException(`Crypto '${slug}' not found.`, HttpStatus.NOT_FOUND);
    }

    const category = this.primaryCategory(crypto);
    const [snapshot, related, news] = await Promise.all([
      this.repo.getSnapshot(crypto.crypto_id),
      this.repo.getRelatedCryptos(crypto.crypto_id, category, crypto.ecosystem, 6),
      this.repo.getCryptoNews(crypto.symbol, category, 4),
    ]);

    const currency = (snapshot?.quote_currency ?? "USD").trim().toUpperCase();
    const price = Number(snapshot?.price ?? 0);
    const change24h = Number(snapshot?.change_24h ?? 0);
    const context = this.buildContext(crypto, snapshot);
    const twelveDataSymbol = this.resolveTwelveDataSymbol(crypto, currency);
    const twelveDataAvailable = Boolean((process.env.TWELVEDATA_API_KEY ?? "").trim()) && Boolean(twelveDataSymbol);

    const headerDescription =
      this.firstSentences(crypto.description, 2) ||
      `${crypto.name} (${crypto.symbol}) — ${category}.`;

    const newsItems = news.length > 0 ? news.map((row) => this.toNewsItem(row)) : this.buildMockNews(crypto, change24h);
    const resources = this.toResources(crypto, snapshot);
    const keyStats = this.toKeyStats(crypto, snapshot, currency);

    return {
      id: crypto.crypto_id,
      symbol: crypto.symbol,
      slug: crypto.slug ?? crypto.symbol.toLowerCase(),
      name: crypto.name,
      logo: withCryptoLogo({
        logo: crypto.logo,
        tickerView: snapshot?.tradingview_scan?.ticker_view,
        symbol: crypto.symbol,
        name: crypto.name,
      }),
      tags: this.buildTags(crypto, snapshot),
      description: headerDescription,
      category,
      ecosystem: crypto.ecosystem?.split(",")[0]?.trim(),
      currency,
      marketType: "crypto",
      price,
      priceFormatted: this.fmtCurrency(price, currency),
      change24h: Number(change24h.toFixed(2)),
      marketCap: snapshot?.market_cap,
      marketCapFormatted: Number.isFinite(snapshot?.market_cap)
        ? `$${this.compactNumber(snapshot?.market_cap)}`
        : undefined,
      contextTitle: context.contextTitle,
      contextBody: context.contextBody,
      narrative: context.narrative,
      ecosystemNarrative: context.ecosystemNarrative,
      quickFacts: this.toQuickFacts(crypto, snapshot),
      metrics: this.toMetrics(crypto, snapshot, currency),
      performance: this.toPerformance(snapshot),
      tokenOverview: this.mockTokenOverview(crypto),
      resources,
      keyStats,
      onChainData: this.mockOnChainData(crypto, change24h),
      sentiment: this.mockSentiment(change24h, crypto.name),
      related: related.map((row) => this.toRelatedItem(row)),
      news: newsItems,
      twelveDataSymbol,
      twelveDataAvailable,
      generatedAt: new Date().toISOString(),
    };
  }

  async getRelated(slug: string): Promise<CryptoDetailRelatedResponse> {
    const crypto = await this.repo.getCryptoBySlug(slug);
    if (!crypto) throw new HttpException(`Crypto '${slug}' not found.`, HttpStatus.NOT_FOUND);
    const category = this.primaryCategory(crypto);
    const rows = await this.repo.getRelatedCryptos(crypto.crypto_id, category, crypto.ecosystem, 6);
    return {
      items: rows.map((row) => this.toRelatedItem(row)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getNews(slug: string, query: CryptoDetailNewsQueryDto): Promise<CryptoDetailNewsResponse> {
    const crypto = await this.repo.getCryptoBySlug(slug);
    if (!crypto) throw new HttpException(`Crypto '${slug}' not found.`, HttpStatus.NOT_FOUND);
    const limit = query.limit ?? 6;
    const category = this.primaryCategory(crypto);
    const rows = await this.repo.getCryptoNews(crypto.symbol, category, limit);
    const items =
      rows.length > 0
        ? rows.map((row) => this.toNewsItem(row))
        : this.buildMockNews(crypto, 0);
    return { items, generatedAt: new Date().toISOString() };
  }

  async getChart(slug: string, query: CryptoDetailChartQueryDto): Promise<CryptoDetailChartResponse> {
    const crypto = await this.repo.getCryptoBySlug(slug);
    if (!crypto) throw new HttpException(`Crypto '${slug}' not found.`, HttpStatus.NOT_FOUND);

    const snapshot = await this.repo.getSnapshot(crypto.crypto_id);
    const currency = (snapshot?.quote_currency ?? "USD").trim().toUpperCase();
    const timeframe: CryptoDetailTimeframe = query.timeframe ?? "1Y";
    const plan = TIMEFRAME_PLAN[timeframe];
    const symbol = this.resolveTwelveDataSymbol(crypto, currency);
    if (!symbol) {
      throw new HttpException("Crypto symbol is missing for chart lookup.", HttpStatus.BAD_REQUEST);
    }

    const series = await this.twelveData.getTimeSeries(symbol, plan.interval, plan.outputsize, {
      exchange: query.exchange?.trim(),
    });
    return this.buildChartResponse(series, crypto, timeframe, plan.interval, symbol, currency);
  }

  private buildChartResponse(
    series: TwelveDataSeries,
    crypto: CryptoDetailRecord,
    timeframe: CryptoDetailTimeframe,
    interval: TwelveDataInterval,
    symbol: string,
    currency: string,
  ): CryptoDetailChartResponse {
    const points: CryptoDetailChartPoint[] = series.values.map((row) => ({
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
      symbol: crypto.symbol,
      twelveDataSymbol: symbol,
      exchange: series.meta.exchange || "",
      currency: series.meta.currency || currency,
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

  private formatLabel(datetime: string, timeframe: CryptoDetailTimeframe): string {
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
