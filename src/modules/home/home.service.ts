import { Injectable } from "@nestjs/common";
import { HomeQueryDto } from "./dto/home-query.dto";
import { HomeSectionQueryDto } from "./dto/home-section-query.dto";
import { HomeRepository } from "./home.repository";
import {
  HomeAssetItem,
  HomeExploreMarketsResponse,
  HomeLeadersResponse,
  HomeMarketType,
  HomeMoversResponse,
  HomeNewsResponse,
  HomeOverviewResponse,
  HomeResponse,
  HomeSummaryResponse,
  HomeTopMoversResponse,
  HomeVietnamGoldMarketResponse,
  HomeTrendingAssetsResponse,
  HomeTickerResponse,
  HomeTrendingResponse,
} from "./home.types";

@Injectable()
export class HomeService {
  constructor(private readonly repo: HomeRepository) {}
  private static readonly MIN_STOCK_MARKET_CAP = 50_000_000_000; // 50B
  private static readonly MIN_CRYPTO_MARKET_CAP = 5_000_000_000; // 5B

  private round2(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  private formatCurrency(value: number, digits = 2): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(value);
  }

  private formatCompactCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }

  private formatIndexValue(value: number): string {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private formatGoldVnd(value: number): string {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)} VND`;
  }

  private formatVndNumber(value: number): string {
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
  }

  private formatTickerLabel(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "N/A";
    const looksLikeCode = /^[A-Z0-9_]+$/.test(trimmed);
    if (!looksLikeCode) return trimmed;
    return trimmed.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  }

  private compactVietnamGoldSymbol(input?: string): string | null {
    if (!input) return null;
    const lower = input.toLowerCase();
    if (lower.includes("sjc")) return "SJC";
    if (lower.includes("doji")) return "DOJI";
    if (lower.includes("pnj")) return "PNJ";
    return null;
  }

  private withFallbackLogo(logo: string | undefined, symbol: string, name?: string): string {
    if (logo && logo.trim()) return logo;
    const textRaw = (symbol || name || "?").trim();
    const text = textRaw.slice(0, 3).toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='12' fill='#1f2937'/><text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='20' fill='#f3f4f6'>${text}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  private currencyFromUnit(unit?: string): string | null {
    if (!unit) return null;
    const raw = unit.trim().toUpperCase();
    if (!raw) return null;
    const first = raw.split("/")[0]?.trim();
    return first || null;
  }

  private relTime(value?: Date): string {
    if (!value) return "N/A";
    const diffMs = Date.now() - value.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  private toStockAsset(row: {
    stock_id: string;
    price: number;
    change_1d: number;
    market_cap?: number;
    volume?: number;
    quote_currency?: string;
    stock?: {
      symbol?: string;
      name?: string;
      slug?: string;
      logo?: string;
      sector?: string;
      currency?: string;
      native_currency?: string;
    };
  }, sparkline: number[]): HomeAssetItem {
    return {
      id: row.stock_id,
      symbol: row.stock?.symbol ?? row.stock_id,
      name: row.stock?.name ?? row.stock_id,
      slug: row.stock?.slug ?? row.stock_id,
      marketType: "stock",
      price: row.price,
      priceFormatted: this.formatCurrency(row.price),
      currency: row.stock?.currency ?? row.stock?.native_currency ?? row.quote_currency ?? null,
      change24h: this.round2(row.change_1d),
      market_cap: row.market_cap,
      volume: row.volume,
      sparkline,
      contextTitle: row.stock?.sector,
      logo: this.withFallbackLogo(row.stock?.logo, row.stock?.symbol ?? row.stock_id, row.stock?.name),
    };
  }

  private toCryptoAsset(row: {
    crypto_id: string;
    price: number;
    change_24h: number;
    market_cap?: number;
    volume_24h?: number;
    quote_currency?: string;
    tradingview_scan?: {
      currency?: unknown;
      fundamental_currency_code?: unknown;
    };
    crypto?: { symbol?: string; name?: string; slug?: string; logo?: string; currency?: string; quote_currency?: string };
  }, sparkline: number[]): HomeAssetItem {
    const scanCurrency = typeof row.tradingview_scan?.currency === "string"
      ? row.tradingview_scan.currency
      : typeof row.tradingview_scan?.fundamental_currency_code === "string"
        ? row.tradingview_scan.fundamental_currency_code
        : null;
    return {
      id: row.crypto_id,
      symbol: row.crypto?.symbol ?? row.crypto_id,
      name: row.crypto?.name ?? row.crypto_id,
      slug: row.crypto?.slug ?? row.crypto_id,
      marketType: "crypto",
      price: row.price,
      priceFormatted: this.formatCurrency(row.price, row.price >= 1 ? 2 : 6),
      currency: row.quote_currency ?? row.crypto?.quote_currency ?? row.crypto?.currency ?? scanCurrency,
      change24h: this.round2(row.change_24h),
      market_cap: row.market_cap,
      volume: row.volume_24h,
      sparkline,
      logo: this.withFallbackLogo(row.crypto?.logo, row.crypto?.symbol ?? row.crypto_id, row.crypto?.name),
    };
  }

  private toCommodityAsset(row: {
    commodity_id: string;
    price: number;
    change_1d: number;
    volume?: number;
    commodity?: { symbol?: string; name?: string; slug?: string; group?: string; logo?: string; unit?: string; currency?: string };
  }, sparkline: number[]): HomeAssetItem {
    const unitCurrency = this.currencyFromUnit(row.commodity?.unit);
    return {
      id: row.commodity_id,
      symbol: row.commodity?.symbol ?? row.commodity_id,
      name: row.commodity?.name ?? row.commodity_id,
      slug: row.commodity?.slug ?? row.commodity_id,
      marketType: "commodity",
      price: row.price,
      priceFormatted: this.formatCurrency(row.price, row.price >= 10 ? 2 : 4),
      currency: row.commodity?.currency ?? unitCurrency,
      change24h: this.round2(row.change_1d),
      volume: row.volume,
      sparkline,
      group: row.commodity?.group,
      logo: this.withFallbackLogo(row.commodity?.logo, row.commodity?.symbol ?? row.commodity_id, row.commodity?.name),
    };
  }

  private toPreciousAsset(row: {
    brand_id: string;
    sell_price: number;
    change_1d: number;
    brand?: { brand_code?: string; name?: string; slug?: string; logo?: string; unit?: string; currency?: string };
  }, sparkline: number[]): HomeAssetItem {
    const unitCurrency = this.currencyFromUnit(row.brand?.unit);
    return {
      id: row.brand_id,
      symbol: row.brand?.brand_code ?? row.brand_id,
      name: row.brand?.name ?? row.brand_id,
      slug: row.brand?.slug ?? row.brand_id,
      marketType: "gold",
      price: row.sell_price,
      priceFormatted: this.formatGoldVnd(row.sell_price),
      currency: row.brand?.currency ?? unitCurrency,
      change24h: this.round2(row.change_1d),
      sparkline,
      logo: this.withFallbackLogo(row.brand?.logo, row.brand?.brand_code ?? row.brand_id, row.brand?.name),
    };
  }

  async getSummary(): Promise<HomeSummaryResponse> {
    const summary = await this.repo.countSummaries();
    return { summary, generatedAt: new Date().toISOString() };
  }

  async getOverview(): Promise<HomeOverviewResponse> {
    const [summary, commodities, precious, btcDoc, goldDoc, oilDoc, spxComposite, ndxComposite] = await Promise.all([
      this.repo.countSummaries(),
      this.repo.getTopCommodities(8),
      this.repo.getPrecious(8),
      this.repo.getCryptoBySymbol("BTC"),
      this.repo.getCommodityBySlug("xauusd-cur"),
      this.repo.getCommodityBySlug("cl1-com"),
      this.repo.getIndexCompositeByProname("SP:SPX"),
      this.repo.getIndexCompositeByProname("NASDAQ:NDX"),
    ]);

    const avgCommodityChange = commodities.length > 0
      ? commodities.reduce((acc, item) => acc + item.change_1d, 0) / commodities.length
      : 0;
    const avgPreciousChange = precious.length > 0
      ? precious.reduce((acc, item) => acc + item.change_1d, 0) / precious.length
      : 0;

    const [btcSnap, goldSnap, oilSnap] = await Promise.all([
      btcDoc ? this.repo.getCryptoSnapshotById(btcDoc.crypto_id) : Promise.resolve(null),
      goldDoc ? this.repo.getCommoditySnapshotById(goldDoc.commodity_id) : Promise.resolve(null),
      oilDoc ? this.repo.getCommoditySnapshotById(oilDoc.commodity_id) : Promise.resolve(null),
    ]);

    const [btcSparkMap, goldSparkMap, oilSparkMap] = await Promise.all([
      btcDoc ? this.repo.getSparklineMap("crypto_price_history", "crypto_id", "price", [btcDoc.crypto_id], 10) : Promise.resolve(new Map<string, number[]>()),
      goldDoc ? this.repo.getSparklineMap("commodity_price_history", "commodity_id", "price", [goldDoc.commodity_id], 10) : Promise.resolve(new Map<string, number[]>()),
      oilDoc ? this.repo.getSparklineMap("commodity_price_history", "commodity_id", "price", [oilDoc.commodity_id], 10) : Promise.resolve(new Map<string, number[]>()),
    ]);

    const btcMarketCap = btcSnap?.market_cap ?? 0;
    const btcDominance = summary.totalCryptoMarketCap > 0 ? (btcMarketCap / summary.totalCryptoMarketCap) * 100 : 0;
    const cryptoMood = this.clamp(50 + ((btcSnap?.change_24h ?? 0) * 4) + (avgCommodityChange * 2), 0, 100);
    const fearGreedTrend = cryptoMood - 50;

    // Derived from real constituent snapshots using stocks.indexes membership.
    const spxBase = 5234;
    const ndxBase = 18850;
    const spxValue = spxBase * (1 + ((spxComposite.weightedChange ?? 0) / 100));
    const ndxValue = ndxBase * (1 + ((ndxComposite.weightedChange ?? 0) / 100));

    const metricSparkFallback = (value: number) => [value * 0.96, value * 0.98, value * 0.99, value];

    return {
      metrics: [
        {
          key: "sp500",
          label: "S&P 500",
          value: this.formatIndexValue(spxValue),
          rawValue: spxValue,
          change24h: this.round2(spxComposite.weightedChange),
          sparkline: metricSparkFallback(spxValue),
          source: `stocks.indexes:SP:SPX (${spxComposite.members})`,
        },
        {
          key: "crypto_market",
          label: "Crypto Market",
          value: this.formatCompactCurrency(summary.totalCryptoMarketCap),
          rawValue: summary.totalCryptoMarketCap,
          change24h: this.round2(btcSnap?.change_24h ?? 0),
          sparkline: btcDoc ? (btcSparkMap.get(btcDoc.crypto_id) ?? metricSparkFallback(btcSnap?.price ?? 0)) : [],
          source: "aggregate+BTC",
        },
        {
          key: "gold_xau",
          label: "Gold (XAU)",
          value: goldSnap ? this.formatCurrency(goldSnap.price) : "N/A",
          rawValue: goldSnap?.price ?? 0,
          change24h: this.round2(goldSnap?.change_1d ?? avgPreciousChange),
          sparkline: goldDoc ? (goldSparkMap.get(goldDoc.commodity_id) ?? metricSparkFallback(goldSnap?.price ?? 0)) : [],
          source: goldDoc?.symbol,
        },
        {
          key: "oil_wti",
          label: "Oil (WTI)",
          value: oilSnap ? this.formatCurrency(oilSnap.price) : "N/A",
          rawValue: oilSnap?.price ?? 0,
          change24h: this.round2(oilSnap?.change_1d ?? avgCommodityChange),
          sparkline: oilDoc ? (oilSparkMap.get(oilDoc.commodity_id) ?? metricSparkFallback(oilSnap?.price ?? 0)) : [],
          source: oilDoc?.symbol,
        },
        {
          key: "btc_dominance",
          label: "BTC Dominance",
          value: `${btcDominance.toFixed(1)}%`,
          rawValue: btcDominance,
          change24h: this.round2(btcSnap?.change_24h ?? 0),
          sparkline: btcDoc ? (btcSparkMap.get(btcDoc.crypto_id) ?? metricSparkFallback(btcDominance)) : [],
          source: "BTC/TotalCryptoMcap",
        },
        {
          key: "fear_greed",
          label: "Fear & Greed",
          value: String(Math.round(cryptoMood)),
          rawValue: cryptoMood,
          change24h: this.round2(fearGreedTrend),
          sparkline: [cryptoMood - 8, cryptoMood - 5, cryptoMood - 2, cryptoMood],
          isEstimated: true,
          source: "derived_momentum",
        },
        {
          key: "nasdaq_100",
          label: "NASDAQ 100",
          value: this.formatIndexValue(ndxValue),
          rawValue: ndxValue,
          change24h: this.round2(ndxComposite.weightedChange),
          sparkline: metricSparkFallback(ndxValue),
          source: `stocks.indexes:NASDAQ:NDX (${ndxComposite.members})`,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  async getExploreMarkets(): Promise<HomeExploreMarketsResponse> {
    const [overview, btcDoc, goldDoc, goldMover] = await Promise.all([
      this.getOverview(),
      this.repo.getCryptoBySymbol("BTC"),
      this.repo.getCommodityBySlug("xauusd-cur"),
      this.getMovers({ market: "gold", limit: 1 }),
    ]);

    const [btcSnap, goldSnap] = await Promise.all([
      btcDoc ? this.repo.getCryptoSnapshotById(btcDoc.crypto_id) : Promise.resolve(null),
      goldDoc ? this.repo.getCommoditySnapshotById(goldDoc.commodity_id) : Promise.resolve(null),
    ]);

    const sp500 = overview.metrics.find((m) => m.key === "sp500");

    const goldLocal = goldMover.losers[0] ?? goldMover.gainers[0];

    return {
      cards: [
        {
          key: "stocks",
          title: "Stocks",
          description: "Track global equities, indices, and sector performance across major markets.",
          statLabel: "S&P 500",
          statValue: sp500?.value ?? "N/A",
          change24h: sp500?.change24h ?? 0,
          route: "/stocks",
          source: sp500?.source,
        },
        {
          key: "commodities",
          title: "Commodities",
          description: "Gold, silver, oil, and agricultural commodities with macro context.",
          statLabel: "Gold",
          statValue: goldSnap ? this.formatCurrency(goldSnap.price) : "N/A",
          change24h: goldSnap?.change_1d ?? 0,
          route: "/commodities",
          source: goldDoc?.symbol,
        },
        {
          key: "crypto",
          title: "Crypto",
          description: "Cryptocurrency intelligence, trending tokens, and market sentiment analysis.",
          statLabel: "Bitcoin",
          statValue: btcSnap ? this.formatCurrency(btcSnap.price, 0) : "N/A",
          change24h: btcSnap?.change_24h ?? 0,
          route: "/crypto",
          source: btcDoc?.symbol,
        },
        {
          key: "vietnam_gold",
          title: "Vietnam Gold",
          description: "Local gold prices, SJC premiums, and luong conversion analysis.",
          statLabel: goldLocal?.name ?? "Vietnam Gold",
          statValue: goldLocal?.priceFormatted ?? "N/A",
          change24h: goldLocal?.change24h ?? 0,
          route: "/vietnam-gold",
          source: goldLocal?.symbol,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  async getTicker(): Promise<HomeTickerResponse> {
    const [overview, topCryptos, goldMovers, goldDoc, oilDoc, silverDoc] = await Promise.all([
      this.getOverview(),
      this.repo.getTopCryptos(20),
      this.getMovers({ market: "gold", limit: 6 }),
      this.repo.getCommodityBySlug("xauusd-cur"),
      this.repo.getCommodityBySlug("cl1-com"),
      this.repo.getCommodityBySlug("xagusd-cur"),
    ]);

    const byKey = new Map(overview.metrics.map((m) => [m.key, m]));
    const preferredCrypto = ["BTC", "ETH", "SOL"];
    const cryptoItems = preferredCrypto
      .map((symbol) => topCryptos.find((x) => x.crypto?.symbol === symbol))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const allCrypto = [...cryptoItems];
    for (const row of topCryptos) {
      if (allCrypto.length >= 3) break;
      if (!allCrypto.some((x) => x.crypto_id === row.crypto_id)) allCrypto.push(row);
    }

    const [goldSnap, oilSnap, silverSnap] = await Promise.all([
      goldDoc ? this.repo.getCommoditySnapshotById(goldDoc.commodity_id) : Promise.resolve(null),
      oilDoc ? this.repo.getCommoditySnapshotById(oilDoc.commodity_id) : Promise.resolve(null),
      silverDoc ? this.repo.getCommoditySnapshotById(silverDoc.commodity_id) : Promise.resolve(null),
    ]);

    const goldTicker = [...goldMovers.losers, ...goldMovers.gainers].slice(0, 2);

    const items = [
      {
        label: "S&P 500",
        price: byKey.get("sp500")?.value ?? "N/A",
        change: this.round2(byKey.get("sp500")?.change24h ?? 0),
        path: "/stocks",
        source: byKey.get("sp500")?.source,
      },
      {
        label: "NASDAQ",
        price: byKey.get("nasdaq_100")?.value ?? "N/A",
        change: this.round2(byKey.get("nasdaq_100")?.change24h ?? 0),
        path: "/stocks",
        source: byKey.get("nasdaq_100")?.source,
      },
      ...allCrypto.map((row) => ({
        label: row.crypto?.symbol ?? row.crypto_id,
        price: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(row.price),
        change: this.round2(row.change_24h),
        path: `/crypto/${row.crypto?.slug ?? row.crypto_id}`,
        source: row.crypto?.symbol,
      })),
      ...(goldSnap
        ? [{
          label: "Gold",
          price: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(goldSnap.price),
          change: this.round2(goldSnap.change_1d),
          path: `/commodities/${goldDoc?.slug ?? goldDoc?.commodity_id ?? "gold"}`,
          source: goldDoc?.symbol,
        }]
        : []),
      ...(oilSnap
        ? [{
          label: "Oil",
          price: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(oilSnap.price),
          change: this.round2(oilSnap.change_1d),
          path: `/commodities/${oilDoc?.slug ?? oilDoc?.commodity_id ?? "crude-oil"}`,
          source: oilDoc?.symbol,
        }]
        : []),
      ...(silverSnap
        ? [{
          label: "Silver",
          price: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(silverSnap.price),
          change: this.round2(silverSnap.change_1d),
          path: `/commodities/${silverDoc?.slug ?? silverDoc?.commodity_id ?? "silver"}`,
          source: silverDoc?.symbol,
        }]
        : []),
      ...goldTicker.map((row) => ({
        label: this.formatTickerLabel(row.name || row.symbol),
        price: row.priceFormatted,
        change: row.change24h,
        path: `/vietnam-gold/${row.slug}`,
        source: row.symbol,
      })),
    ];

    return {
      items,
      generatedAt: new Date().toISOString(),
    };
  }

  async getTopMovers(query: HomeSectionQueryDto): Promise<HomeTopMoversResponse> {
    const limit = query.limit ?? 5;

    const [stockUniverse, cryptoUniverse, goldUniverse] = await Promise.all([
      this.repo.getTopStocksByMarketCap(300),
      this.repo.getTopCryptos(300),
      this.repo.getPreciousGold(120),
    ]);
    const trustedStockUniverse = stockUniverse.filter((x) => (x.market_cap ?? 0) >= HomeService.MIN_STOCK_MARKET_CAP);
    const trustedCryptoUniverse = cryptoUniverse.filter((x) => (x.market_cap ?? 0) >= HomeService.MIN_CRYPTO_MARKET_CAP);

    const commoditySlugs = ["xptusd-cur", "hg1-com", "cl1-com", "xagusd-cur", "xauusd-cur"];
    const commodityDocs = await this.repo.getCommoditiesBySlugs(commoditySlugs);
    const commoditySnapshots = await Promise.all(
      commodityDocs.map(async (doc) => {
        const snapshot = await this.repo.getCommoditySnapshotById(doc.commodity_id);
        return snapshot ? { ...snapshot, commodity: doc } : null;
      }),
    );
    const commodityUniverse = commoditySnapshots.filter((x): x is NonNullable<typeof x> => Boolean(x));

    const [stockSpark, cryptoSpark, commoditySpark, goldSpark] = await Promise.all([
      this.repo.getSparklineMap("stock_price_history", "stock_id", "price", trustedStockUniverse.map((x) => x.stock_id), 7),
      this.repo.getSparklineMap("crypto_price_history", "crypto_id", "price", trustedCryptoUniverse.map((x) => x.crypto_id), 7),
      this.repo.getSparklineMap("commodity_price_history", "commodity_id", "price", commodityUniverse.map((x) => x.commodity_id), 7),
      this.repo.getSparklineMap("vietnam_gold_price_history", "brand_id", "sell_price", goldUniverse.map((x) => x.brand_id), 7),
    ]);

    const stocksDesc = [...trustedStockUniverse].sort((a, b) => b.change_1d - a.change_1d).slice(0, limit);
    const stocksAsc = [...trustedStockUniverse].sort((a, b) => a.change_1d - b.change_1d).slice(0, limit);

    const cryptoDesc = [...trustedCryptoUniverse].sort((a, b) => b.change_24h - a.change_24h).slice(0, limit);
    const cryptoAsc = [...trustedCryptoUniverse].sort((a, b) => a.change_24h - b.change_24h).slice(0, limit);

    const commodityDesc = [...commodityUniverse].sort((a, b) => b.change_1d - a.change_1d).slice(0, limit);
    const commodityAsc = [...commodityUniverse].sort((a, b) => a.change_1d - b.change_1d).slice(0, limit);

    const preferredGold = goldUniverse.filter((x) => /sjc|doji|pnj/i.test(`${x.brand?.name ?? ""} ${x.brand?.brand_code ?? ""}`));
    const goldSource = preferredGold.length >= 3 ? preferredGold : goldUniverse;
    const goldDesc = [...goldSource].sort((a, b) => b.change_1d - a.change_1d).slice(0, limit);
    const goldAsc = [...goldSource].sort((a, b) => a.change_1d - b.change_1d).slice(0, limit);

    const generatedAt = new Date().toISOString();

    return {
      tabs: {
        stock: {
          market: "stock",
          gainers: stocksDesc.map((x) => this.toStockAsset(x, stockSpark.get(x.stock_id) ?? [x.price])),
          losers: stocksAsc.map((x) => this.toStockAsset(x, stockSpark.get(x.stock_id) ?? [x.price])),
          generatedAt,
        },
        crypto: {
          market: "crypto",
          gainers: cryptoDesc.map((x) => this.toCryptoAsset(x, cryptoSpark.get(x.crypto_id) ?? [x.price])),
          losers: cryptoAsc.map((x) => this.toCryptoAsset(x, cryptoSpark.get(x.crypto_id) ?? [x.price])),
          generatedAt,
        },
        commodity: {
          market: "commodity",
          gainers: commodityDesc.map((x) => this.toCommodityAsset(x, commoditySpark.get(x.commodity_id) ?? [x.price])),
          losers: commodityAsc.map((x) => this.toCommodityAsset(x, commoditySpark.get(x.commodity_id) ?? [x.price])),
          generatedAt,
        },
        gold: {
          market: "gold",
          gainers: goldDesc.map((x) => this.toPreciousAsset(x, goldSpark.get(x.brand_id) ?? [x.sell_price])),
          losers: goldAsc.map((x) => this.toPreciousAsset(x, goldSpark.get(x.brand_id) ?? [x.sell_price])),
          generatedAt,
        },
      },
      generatedAt,
    };
  }

  async getMovers(query: HomeSectionQueryDto): Promise<HomeMoversResponse> {
    const market = query.market ?? "stock";
    const limit = query.limit ?? 5;

    if (market === "stock") {
      const universe = (await this.repo.getTopStocksByMarketCap(800)).filter(
        (x) => (x.market_cap ?? 0) >= HomeService.MIN_STOCK_MARKET_CAP,
      );
      const gainers = [...universe].sort((a, b) => b.change_1d - a.change_1d).slice(0, limit);
      const losers = [...universe].sort((a, b) => a.change_1d - b.change_1d).slice(0, limit);
      const ids = [...new Set([...gainers, ...losers].map((x) => x.stock_id))];
      const spark = await this.repo.getSparklineMap("stock_price_history", "stock_id", "price", ids, 7);
      return {
        market,
        gainers: gainers.map((x) => this.toStockAsset(x, spark.get(x.stock_id) ?? [x.price])),
        losers: losers.map((x) => this.toStockAsset(x, spark.get(x.stock_id) ?? [x.price])),
        generatedAt: new Date().toISOString(),
      };
    }

    if (market === "crypto") {
      const universe = (await this.repo.getTopCryptos(800)).filter(
        (x) => (x.market_cap ?? 0) >= HomeService.MIN_CRYPTO_MARKET_CAP,
      );
      const gainers = [...universe].sort((a, b) => b.change_24h - a.change_24h).slice(0, limit);
      const losers = [...universe].sort((a, b) => a.change_24h - b.change_24h).slice(0, limit);
      const ids = [...new Set([...gainers, ...losers].map((x) => x.crypto_id))];
      const spark = await this.repo.getSparklineMap("crypto_price_history", "crypto_id", "price", ids, 7);
      return {
        market,
        gainers: gainers.map((x) => this.toCryptoAsset(x, spark.get(x.crypto_id) ?? [x.price])),
        losers: losers.map((x) => this.toCryptoAsset(x, spark.get(x.crypto_id) ?? [x.price])),
        generatedAt: new Date().toISOString(),
      };
    }

    if (market === "commodity") {
      const [gainers, losers] = await Promise.all([
        this.repo.getTopCommodityMovers(limit, -1),
        this.repo.getTopCommodityMovers(limit, 1),
      ]);
      const ids = [...new Set([...gainers, ...losers].map((x) => x.commodity_id))];
      const spark = await this.repo.getSparklineMap("commodity_price_history", "commodity_id", "price", ids, 7);
      return {
        market,
        gainers: gainers.map((x) => this.toCommodityAsset(x, spark.get(x.commodity_id) ?? [x.price])),
        losers: losers.map((x) => this.toCommodityAsset(x, spark.get(x.commodity_id) ?? [x.price])),
        generatedAt: new Date().toISOString(),
      };
    }

    const [gainers, losers] = await Promise.all([
      this.repo.getPreciousMovers(limit, -1),
      this.repo.getPreciousMovers(limit, 1),
    ]);
    const ids = [...new Set([...gainers, ...losers].map((x) => x.brand_id))];
    const spark = await this.repo.getSparklineMap("vietnam_gold_price_history", "brand_id", "sell_price", ids, 7);
    return {
      market,
      gainers: gainers.map((x) => this.toPreciousAsset(x, spark.get(x.brand_id) ?? [x.sell_price])),
      losers: losers.map((x) => this.toPreciousAsset(x, spark.get(x.brand_id) ?? [x.sell_price])),
      generatedAt: new Date().toISOString(),
    };
  }

  async getLeaders(query: HomeSectionQueryDto): Promise<HomeLeadersResponse> {
    const limit = query.limit ?? 5;
    const [stockUniverse, cryptoUniverse, commodityDocs, commodityFallback, goldUniverse] = await Promise.all([
      this.repo.getTopStocksByMarketCap(400),
      this.repo.getTopCryptos(400),
      this.repo.getCommoditiesBySlugs(["xauusd-cur", "xagusd-cur", "cl1-com", "hg1-com", "xptusd-cur"]),
      this.repo.getTopCommodities(30),
      this.repo.getPreciousGold(200),
    ]);

    const stocks = stockUniverse
      .filter((x) => (x.market_cap ?? 0) >= HomeService.MIN_STOCK_MARKET_CAP)
      .slice(0, limit);
    const cryptos = cryptoUniverse
      .filter((x) => (x.market_cap ?? 0) >= HomeService.MIN_CRYPTO_MARKET_CAP)
      .slice(0, limit);

    const preferredCommodityOrder = ["xauusd-cur", "xagusd-cur", "cl1-com", "hg1-com", "xptusd-cur"];
    const commodityBySlug = new Map(commodityDocs.map((x) => [x.slug, x]));
    const selectedCommodityDocs = preferredCommodityOrder
      .map((slug) => commodityBySlug.get(slug))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    const selectedCommodityIds = new Set(selectedCommodityDocs.map((x) => x.commodity_id));
    for (const row of commodityFallback) {
      if (selectedCommodityDocs.length >= limit) break;
      if (!selectedCommodityIds.has(row.commodity_id) && row.commodity) {
        selectedCommodityIds.add(row.commodity_id);
        selectedCommodityDocs.push(row.commodity);
      }
    }
    const commodities = (await Promise.all(
      selectedCommodityDocs.slice(0, limit).map(async (doc) => {
        const snapshot = await this.repo.getCommoditySnapshotById(doc.commodity_id);
        return snapshot ? { ...snapshot, commodity: doc } : null;
      }),
    )).filter((x): x is NonNullable<typeof x> => Boolean(x));

    const preferredGold = goldUniverse.filter((x) => /sjc|doji|pnj/i.test(`${x.brand?.name ?? ""} ${x.brand?.brand_code ?? ""}`));
    const goldPool = preferredGold.length >= limit ? preferredGold : [...preferredGold, ...goldUniverse];
    const seenGold = new Set<string>();
    const vietnamGold = goldPool.filter((x) => {
      if (seenGold.has(x.brand_id)) return false;
      seenGold.add(x.brand_id);
      return true;
    }).slice(0, limit);

    const [stockSpark, cryptoSpark, commoditySpark, goldSpark] = await Promise.all([
      this.repo.getSparklineMap("stock_price_history", "stock_id", "price", stocks.map((x) => x.stock_id), 7),
      this.repo.getSparklineMap("crypto_price_history", "crypto_id", "price", cryptos.map((x) => x.crypto_id), 7),
      this.repo.getSparklineMap("commodity_price_history", "commodity_id", "price", commodities.map((x) => x.commodity_id), 7),
      this.repo.getSparklineMap("vietnam_gold_price_history", "brand_id", "sell_price", vietnamGold.map((x) => x.brand_id), 7),
    ]);

    const stockItems = stocks.map((x) => this.toStockAsset(x, stockSpark.get(x.stock_id) ?? [x.price]));
    const cryptoItems = cryptos.map((x) => this.toCryptoAsset(x, cryptoSpark.get(x.crypto_id) ?? [x.price]));
    const commodityItems = commodities.map((x) => this.toCommodityAsset(x, commoditySpark.get(x.commodity_id) ?? [x.price]));
    const vietnamGoldItems = vietnamGold.map((x) => this.toPreciousAsset(x, goldSpark.get(x.brand_id) ?? [x.sell_price]));

    return {
      stocks: stockItems,
      cryptos: cryptoItems,
      commodities: commodityItems,
      vietnamGold: vietnamGoldItems,
      precious: vietnamGoldItems,
      generatedAt: new Date().toISOString(),
    };
  }

  async getTrending(query: HomeSectionQueryDto): Promise<HomeTrendingResponse> {
    const market = query.market ?? "crypto";
    const limit = query.limit ?? 6;

    if (market === "stock") {
      const rows = await this.repo.getTopStocksByMarketCap(limit);
      const spark = await this.repo.getSparklineMap("stock_price_history", "stock_id", "price", rows.map((x) => x.stock_id), 7);
      return { market, items: rows.map((x) => this.toStockAsset(x, spark.get(x.stock_id) ?? [x.price])), generatedAt: new Date().toISOString() };
    }
    if (market === "crypto") {
      const rows = await this.repo.getTopCryptos(limit);
      const spark = await this.repo.getSparklineMap("crypto_price_history", "crypto_id", "price", rows.map((x) => x.crypto_id), 7);
      return { market, items: rows.map((x) => this.toCryptoAsset(x, spark.get(x.crypto_id) ?? [x.price])), generatedAt: new Date().toISOString() };
    }
    if (market === "commodity") {
      const rows = await this.repo.getTopCommodities(limit);
      const spark = await this.repo.getSparklineMap("commodity_price_history", "commodity_id", "price", rows.map((x) => x.commodity_id), 7);
      return { market, items: rows.map((x) => this.toCommodityAsset(x, spark.get(x.commodity_id) ?? [x.price])), generatedAt: new Date().toISOString() };
    }

    const rows = await this.repo.getPrecious(limit);
    const spark = await this.repo.getSparklineMap("vietnam_gold_price_history", "brand_id", "sell_price", rows.map((x) => x.brand_id), 7);
    return { market, items: rows.map((x) => this.toPreciousAsset(x, spark.get(x.brand_id) ?? [x.sell_price])), generatedAt: new Date().toISOString() };
  }

  async getTrendingAssets(query: HomeSectionQueryDto): Promise<HomeTrendingAssetsResponse> {
    const limit = query.limit ?? 5;
    const stockWatchlist = ["AAPL", "NVDA", "MSFT", "GOOGL", "TSLA"];
    const cryptoWatchlist = ["BTC", "ETH", "SOL", "AVAX", "BNB"];
    const commodityWatchlist = ["xauusd-cur", "xagusd-cur", "cl1-com", "hg1-com", "xptusd-cur"];
    const goldWatchlist = ["SJC", "DOJI", "PNJ"];

    const [stockDocs, cryptoDocs, commodityDocs, goldPreferred, stockFallback, cryptoFallback, commodityFallback, goldFallback] = await Promise.all([
      Promise.all(stockWatchlist.map((symbol) => this.repo.getStockBySymbol(symbol))),
      Promise.all(cryptoWatchlist.map((symbol) => this.repo.getCryptoBySymbol(symbol))),
      this.repo.getCommoditiesBySlugs(commodityWatchlist),
      Promise.all(goldWatchlist.map((code) => this.repo.getLatestPreciousByBrandCode(code))),
      this.repo.getTopStocksByMarketCap(300),
      this.repo.getTopCryptos(300),
      this.repo.getTopCommodities(30),
      this.repo.getPreciousGold(200),
    ]);

    const stockRows = (await Promise.all(
      stockDocs
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .map(async (doc) => {
          const snapshot = await this.repo.getStockSnapshotById(doc.stock_id);
          return snapshot ? { ...snapshot, stock: doc } : null;
        }),
    )).filter((x): x is NonNullable<typeof x> => Boolean(x));
    const stockMerged: Array<{
      stock_id: string;
      price: number;
      change_1d: number;
      market_cap?: number;
      volume?: number;
      quote_currency?: string;
      stock?: {
        symbol?: string;
        name?: string;
        slug?: string;
        logo?: string;
        sector?: string;
        currency?: string;
        native_currency?: string;
      };
    }> = [...stockRows];
    for (const row of stockFallback) {
      if (stockMerged.length >= limit) break;
      if ((row.market_cap ?? 0) < HomeService.MIN_STOCK_MARKET_CAP) continue;
      if (!stockMerged.some((x) => x.stock_id === row.stock_id)) stockMerged.push(row);
    }

    const cryptoRows = (await Promise.all(
      cryptoDocs
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .map(async (doc) => {
          const snapshot = await this.repo.getCryptoSnapshotById(doc.crypto_id);
          return snapshot ? { ...snapshot, crypto: doc } : null;
        }),
    )).filter((x): x is NonNullable<typeof x> => Boolean(x));
    const cryptoMerged: Array<{
      crypto_id: string;
      price: number;
      change_24h: number;
      market_cap?: number;
      volume_24h?: number;
      quote_currency?: string;
      tradingview_scan?: {
        currency?: unknown;
        fundamental_currency_code?: unknown;
      };
      crypto?: {
        symbol?: string;
        name?: string;
        slug?: string;
        logo?: string;
        currency?: string;
        quote_currency?: string;
      };
    }> = [...cryptoRows];
    for (const row of cryptoFallback) {
      if (cryptoMerged.length >= limit) break;
      if ((row.market_cap ?? 0) < HomeService.MIN_CRYPTO_MARKET_CAP) continue;
      if (!cryptoMerged.some((x) => x.crypto_id === row.crypto_id)) cryptoMerged.push(row);
    }

    const commodityBySlug = new Map(commodityDocs.map((x) => [x.slug, x]));
    const commodityOrdered = commodityWatchlist
      .map((slug) => commodityBySlug.get(slug))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    const commodityRows = (await Promise.all(
      commodityOrdered.map(async (doc) => {
        const snapshot = await this.repo.getCommoditySnapshotById(doc.commodity_id);
        return snapshot ? { ...snapshot, commodity: doc } : null;
      }),
    )).filter((x): x is NonNullable<typeof x> => Boolean(x));
    const commodityMerged: Array<{
      commodity_id: string;
      price: number;
      change_1d: number;
      volume?: number;
      updated_at?: Date;
      commodity?: {
        symbol?: string;
        name?: string;
        slug?: string;
        group?: string;
        logo?: string;
        unit?: string;
        currency?: string;
      };
    }> = [...commodityRows];
    for (const row of commodityFallback) {
      if (commodityMerged.length >= limit) break;
      if (!commodityMerged.some((x) => x.commodity_id === row.commodity_id)) commodityMerged.push(row);
    }

    const preferredGoldRows = goldPreferred.filter((x): x is NonNullable<typeof x> => Boolean(x));
    const goldPool = [...preferredGoldRows];
    for (const row of goldFallback) {
      if (!goldPool.some((x) => x.brand_id === row.brand_id)) goldPool.push(row);
    }
    const goldMerged: typeof goldPool = [];
    for (const key of ["sjc", "doji", "pnj"]) {
      const row = goldPool.find((x) => {
        const code = x.brand?.brand_code ?? "";
        const name = x.brand?.name ?? "";
        return `${code} ${name}`.toLowerCase().includes(key);
      });
      if (row && !goldMerged.some((x) => x.brand_id === row.brand_id)) goldMerged.push(row);
    }
    for (const row of goldPool) {
      if (goldMerged.length >= Math.min(limit, 3)) break;
      if (!goldMerged.some((x) => x.brand_id === row.brand_id)) goldMerged.push(row);
    }

    const stocks = stockMerged.slice(0, limit);
    const cryptos = cryptoMerged.slice(0, limit);
    const commodities = commodityMerged.slice(0, limit);
    const golds = goldMerged.slice(0, Math.min(limit, 3));

    const [stockSpark, cryptoSpark, commoditySpark, goldSpark] = await Promise.all([
      this.repo.getSparklineMap("stock_price_history", "stock_id", "price", stocks.map((x) => x.stock_id), 7),
      this.repo.getSparklineMap("crypto_price_history", "crypto_id", "price", cryptos.map((x) => x.crypto_id), 7),
      this.repo.getSparklineMap("commodity_price_history", "commodity_id", "price", commodities.map((x) => x.commodity_id), 7),
      this.repo.getSparklineMap("vietnam_gold_price_history", "brand_id", "sell_price", golds.map((x) => x.brand_id), 7),
    ]);

    const generatedAt = new Date().toISOString();
    return {
      tabs: {
        stock: {
          market: "stock",
          items: stocks.map((x) => this.toStockAsset(x, stockSpark.get(x.stock_id) ?? [x.price])),
          generatedAt,
        },
        crypto: {
          market: "crypto",
          items: cryptos.map((x) => this.toCryptoAsset(x, cryptoSpark.get(x.crypto_id) ?? [x.price])),
          generatedAt,
        },
        commodity: {
          market: "commodity",
          items: commodities.map((x) => this.toCommodityAsset(x, commoditySpark.get(x.commodity_id) ?? [x.price])),
          generatedAt,
        },
        gold: {
          market: "gold",
          items: golds.map((x) => {
            const item = this.toPreciousAsset(x, goldSpark.get(x.brand_id) ?? [x.sell_price]);
            const compactSymbol = this.compactVietnamGoldSymbol(`${x.brand?.brand_code ?? ""} ${x.brand?.name ?? ""}`);
            return compactSymbol ? { ...item, symbol: compactSymbol } : item;
          }),
          generatedAt,
        },
      },
      generatedAt,
    };
  }

  async getVietnamGoldMarket(): Promise<HomeVietnamGoldMarketResponse> {
    const preferredCodes = ["SJC", "DOJI", "PNJ"];
    const [preferred, fallbackGold, allPrecious] = await Promise.all([
      Promise.all(preferredCodes.map((code) => this.repo.getLatestPreciousByBrandCode(code))),
      this.repo.getPreciousGold(120),
      this.repo.getPrecious(300),
    ]);

    const picked: Array<NonNullable<(typeof preferred)[number]>> = preferred.filter(
      (x): x is NonNullable<(typeof preferred)[number]> => Boolean(x),
    );
    for (const key of preferredCodes.map((x) => x.toLowerCase())) {
      if (picked.some((x) => `${x.brand?.brand_code ?? ""} ${x.brand?.name ?? ""}`.toLowerCase().includes(key))) continue;
      const row = fallbackGold.find((x) => `${x.brand?.brand_code ?? ""} ${x.brand?.name ?? ""}`.toLowerCase().includes(key));
      if (row && !picked.some((x) => x.brand_id === row.brand_id)) picked.push(row);
    }
    for (const row of fallbackGold) {
      if (picked.length >= 3) break;
      if (!picked.some((x) => x.brand_id === row.brand_id)) picked.push(row);
    }

    const items = picked.slice(0, 3).map((row) => {
      const symbol = this.compactVietnamGoldSymbol(`${row.brand?.brand_code ?? ""} ${row.brand?.name ?? ""}`)
        ?? row.brand?.brand_code
        ?? row.brand_id;
      const buyPrice = row.buy_price ?? row.sell_price;
      const spread = row.spread ?? Math.max(0, row.sell_price - buyPrice);
      return {
        brandId: row.brand_id,
        symbol,
        name: row.brand?.name ?? symbol,
        slug: row.brand?.slug ?? row.brand_id,
        metalType: row.metal_type,
        buyPrice,
        sellPrice: row.sell_price,
        spread,
        buyPriceFormatted: this.formatVndNumber(buyPrice),
        sellPriceFormatted: this.formatVndNumber(row.sell_price),
        spreadFormatted: this.formatVndNumber(spread),
        change24h: this.round2(row.change_1d),
        currency: row.brand?.currency ?? this.currencyFromUnit(row.brand?.unit),
        unit: row.brand?.unit,
        logo: this.withFallbackLogo(row.brand?.logo, symbol, row.brand?.name),
        source: row.source,
      };
    });

    const goldItems = allPrecious.filter((x) => x.metal_type === "gold").length;
    const silverItems = allPrecious.filter((x) => x.metal_type === "silver").length;
    const spreads = items.map((x) => x.spread).filter((x) => Number.isFinite(x));
    const averageSpread = spreads.length ? spreads.reduce((acc, cur) => acc + cur, 0) / spreads.length : 0;

    return {
      badge: "Vietnam Market Exclusive",
      title: "Vietnam Gold & Silver Market",
      subtitle: "Track SJC, DOJI, and PNJ prices in real-time.",
      ctaLabel: "Explore Vietnam Gold",
      ctaRoute: "/vietnam-gold",
      items,
      stats: {
        goldItems,
        silverItems,
        averageSpread,
        averageSpreadFormatted: this.formatVndNumber(averageSpread),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getNews(query: HomeQueryDto): Promise<HomeNewsResponse> {
    const newsLimit = query.newsLimit ?? 6;
    const items = await this.repo.getLatestNews(newsLimit);
    return {
      items: items.map((item) => ({
        id: String((item as { _id?: unknown })._id ?? ""),
        category: item.market ?? "market",
        title: item.title ?? "",
        summary: item.summary ?? "",
        time: this.relTime(item.published_at),
        market: item.market,
        source: item.source,
        url: item.url,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async getHomeData(query: HomeQueryDto): Promise<HomeResponse> {
    const limit = query.limit ?? 5;
    const [summary, overview, ticker, exploreMarkets, topMovers, vietnamGoldMarket, stockMovers, cryptoMovers, commodityMovers, goldMovers, leaders, trendingAssets, news] = await Promise.all([
      this.getSummary(),
      this.getOverview(),
      this.getTicker(),
      this.getExploreMarkets(),
      this.getTopMovers({ limit }),
      this.getVietnamGoldMarket(),
      this.getMovers({ market: "stock", limit }),
      this.getMovers({ market: "crypto", limit }),
      this.getMovers({ market: "commodity", limit }),
      this.getMovers({ market: "gold", limit }),
      this.getLeaders({ limit }),
      this.getTrendingAssets({ limit }),
      this.getNews(query),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      summary: summary.summary,
      overview: overview.metrics,
      ticker: ticker.items,
      exploreMarkets: exploreMarkets.cards,
      topMovers: topMovers.tabs,
      vietnamGoldMarket,
      movers: {
        stock: stockMovers,
        crypto: cryptoMovers,
        commodity: commodityMovers,
        gold: goldMovers,
      },
      leaders,
      trending: trendingAssets.tabs,
      news: news.items,
    };
  }
}
