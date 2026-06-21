import { Injectable } from "@nestjs/common";
import { HomeService } from "../home/home.service";
import { HomeAssetItem } from "../home/home.types";
import { NewsService } from "../news/news.service";
import { VietnamGoldService } from "../vietnam-gold/vietnam-gold.service";
import {
  MarketBriefAssetItem,
  MarketBriefCommodityCard,
  MarketBriefNewsItem,
  MarketBriefResponse,
  MarketBriefSnapshotCard,
  MarketBriefSnapshotKey,
} from "./market-brief.types";

@Injectable()
export class MarketBriefService {
  constructor(
    private readonly homeService: HomeService,
    private readonly vietnamGoldService: VietnamGoldService,
    private readonly newsService: NewsService,
  ) {}

  private fmtPct(value: number): string {
    const n = Number.isFinite(value) ? value : 0;
    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  }

  private formatVndFull(value: number): string {
    return `${Math.round(value).toLocaleString("en-US")}`;
  }

  private formatUsdOz(value: number): string {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}/oz`;
  }

  private toBriefAsset(item: HomeAssetItem): MarketBriefAssetItem {
    return {
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      slug: item.slug,
      marketType: item.marketType,
      priceFormatted: item.priceFormatted,
      change24h: item.change24h,
      logo: item.logo,
    };
  }

  private async getLatestNews(limit: number): Promise<MarketBriefNewsItem[]> {
    try {
      const { items } = await this.newsService.getNews({ market: "all", limit, page: 1 });
      return items.map((n) => ({
        id: n.id,
        title: n.title,
        summary: n.summary,
        category: n.category,
        market: n.market,
        source: n.source,
        url: n.url || n.sourceUrl,
        time: n.time,
        publishedAt: n.publishedAt,
        imageUrl: n.imageUrl,
        tags: n.tags,
      }));
    } catch {
      return [];
    }
  }

  private topMoversFromGainersLosers(gainers: HomeAssetItem[], losers: HomeAssetItem[], limit: number): MarketBriefAssetItem[] {
    const merged = [...gainers, ...losers];
    const seen = new Set<string>();
    const unique = merged.filter((x) => {
      if (seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    });
    return unique
      .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
      .slice(0, limit)
      .map((x) => this.toBriefAsset(x));
  }

  private snapshotSummary(key: MarketBriefSnapshotKey, change: number): string {
    const up = change >= 0;
    const summaries: Record<MarketBriefSnapshotKey, [string, string]> = {
      stocks: [
        "Major indices moved slightly higher today as technology stocks continued their recovery. Semiconductor companies saw strong buying interest.",
        "Equity markets softened as profit-taking emerged in large-cap technology names while defensive sectors held up better.",
      ],
      crypto: [
        "Bitcoin remains stable above key support levels while Ethereum sees increased network activity. Layer 2 ecosystems continue to grow.",
        "Crypto markets pulled back modestly as traders reduced risk ahead of macro data, though large-cap tokens remain supported.",
      ],
      commodities: [
        "Oil prices declined as global demand expectations softened. Gold gained slightly as investors sought safety amid mixed economic signals.",
        "Commodity markets were mixed as energy prices eased while precious metals attracted safe-haven demand.",
      ],
      vietnam_gold: [
        "Domestic gold prices remain significantly above global gold equivalents. SJC gold continues to trade at a premium driven by limited supply.",
        "Vietnam gold prices eased slightly but domestic premiums remain elevated versus global benchmarks.",
      ],
    };
    return summaries[key][up ? 0 : 1];
  }

  private briefSummary(kind: "stocks" | "crypto" | "commodities", avgChange: number): string {
    const up = avgChange >= 0;
    if (kind === "stocks") {
      return up
        ? "The S&P 500 rose modestly today, led by gains in the technology sector. Semiconductor companies saw strong buying interest while energy stocks declined alongside falling oil prices."
        : "U.S. equities were weaker today as cyclical sectors lagged. Technology held up relatively better despite broader risk-off sentiment.";
    }
    if (kind === "crypto") {
      return up
        ? "Bitcoin remains range-bound while Ethereum continues to benefit from increased decentralized finance activity. Layer 2 ecosystems are attracting growing user adoption."
        : "Crypto markets traded lower as altcoins led declines, though Bitcoin held above recent support levels.";
    }
    return up
      ? "Gold prices rose slightly as investors sought safety amid uncertain macroeconomic signals. Oil prices were mixed as supply concerns offset softer demand expectations."
      : "Gold prices rose slightly as investors sought safety amid uncertain macroeconomic signals. Oil prices declined due to expectations of weaker global demand.";
  }

  private aiInsightFromSnapshots(changes: number[]): string {
    const avg = changes.reduce((a, b) => a + b, 0) / Math.max(changes.length, 1);
    if (avg > 0.5) {
      return "Risk appetite improved across major asset classes today. Technology and crypto led gains while gold remained firm as a hedge. Watch upcoming inflation prints for the next directional cue.";
    }
    if (avg < -0.5) {
      return "Markets are currently influenced by inflation expectations and central bank policy signals. Gold remains elevated as investors seek protection from uncertainty, while cyclical assets faced pressure.";
    }
    return "Markets are currently influenced by inflation expectations and central bank policy signals. Gold remains elevated as investors seek protection from uncertainty, while technology stocks benefit from renewed optimism around artificial intelligence growth. Crypto markets show increased stability driven by institutional flows and ETF demand.";
  }

  private moodFromChanges(changes: number[]): { mood: "mixed" | "bullish" | "bearish"; moodLabel: string } {
    const avg = changes.reduce((a, b) => a + b, 0) / Math.max(changes.length, 1);
    if (avg > 0.35) return { mood: "bullish", moodLabel: "Markets Higher" };
    if (avg < -0.35) return { mood: "bearish", moodLabel: "Markets Lower" };
    return { mood: "mixed", moodLabel: "Markets Mixed" };
  }

  async getBrief(): Promise<MarketBriefResponse> {
    const briefLimit = 4;
    const moverLimit = 5;
    const brandLimit = 8;

    const [
      explore,
      trending,
      leaders,
      stockMovers,
      cryptoMovers,
      commodityMovers,
      vnOverview,
      vnAll,
      latestNews,
    ] = await Promise.all([
      this.homeService.getExploreMarkets(),
      this.homeService.getTrendingAssets({ limit: briefLimit }),
      this.homeService.getLeaders({ limit: briefLimit }),
      this.homeService.getMovers({ market: "stock", limit: moverLimit }),
      this.homeService.getMovers({ market: "crypto", limit: moverLimit }),
      this.homeService.getMovers({ market: "commodity", limit: moverLimit }),
      this.vietnamGoldService.getOverview(),
      this.vietnamGoldService.getAll({ page: 1, limit: brandLimit, metalType: "gold", sortBy: "sell", sortDir: "desc" }),
      this.getLatestNews(10),
    ]);

    const cardByKey = new Map(explore.cards.map((c) => [c.key, c]));
    const snapshotKeys: MarketBriefSnapshotKey[] = ["stocks", "crypto", "commodities", "vietnam_gold"];
    const snapshotTitles: Record<MarketBriefSnapshotKey, string> = {
      stocks: "Stocks",
      crypto: "Crypto",
      commodities: "Commodities",
      vietnam_gold: "Vietnam Gold",
    };

    const vnCard = cardByKey.get("vietnam_gold");
    const vnChange = vnCard?.change24h ?? 0;

    const snapshotChanges: Record<MarketBriefSnapshotKey, number> = {
      stocks: cardByKey.get("stocks")?.change24h ?? 0,
      crypto: cardByKey.get("crypto")?.change24h ?? 0,
      commodities: cardByKey.get("commodities")?.change24h ?? 0,
      vietnam_gold: vnChange,
    };

    const snapshots: MarketBriefSnapshotCard[] = snapshotKeys.map((key) => {
      const change = snapshotChanges[key];
      return {
        key,
        title: snapshotTitles[key],
        changeFormatted: this.fmtPct(change),
        change24h: Number(change.toFixed(2)),
        positive: change >= 0,
        summary: this.snapshotSummary(key, change),
      };
    });

    const mood = this.moodFromChanges(snapshotKeys.map((k) => snapshotChanges[k]));
    const dateLabel = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const stockItems = (trending.tabs.stock?.items ?? []).slice(0, briefLimit).map((x) => this.toBriefAsset(x));
    const cryptoItems = (trending.tabs.crypto?.items ?? []).slice(0, briefLimit).map((x) => this.toBriefAsset(x));
    const commodityCards: MarketBriefCommodityCard[] = (leaders.commodities ?? [])
      .slice(0, 3)
      .map((x) => ({
        id: x.id,
        symbol: x.symbol,
        name: x.name,
        slug: x.slug,
        priceFormatted: x.priceFormatted,
        change24h: x.change24h,
        logo: x.logo,
      }));

    const stockAvg =
      stockItems.length > 0 ? stockItems.reduce((s, x) => s + x.change24h, 0) / stockItems.length : snapshotChanges.stocks;
    const cryptoAvg =
      cryptoItems.length > 0 ? cryptoItems.reduce((s, x) => s + x.change24h, 0) / cryptoItems.length : snapshotChanges.crypto;
    const commodityAvg =
      commodityCards.length > 0
        ? commodityCards.reduce((s, x) => s + x.change24h, 0) / commodityCards.length
        : snapshotChanges.commodities;

    const conversion = vnOverview.conversion;
    const premiumPct =
      conversion.equivalentVndPerLuong > 0
        ? Number(((conversion.premiumVnd / conversion.equivalentVndPerLuong) * 100).toFixed(1))
        : 0;

    return {
      generatedAt: new Date().toISOString(),
      meta: {
        dateLabel,
        moodLabel: mood.moodLabel,
        mood: mood.mood,
      },
      snapshots,
      aiInsight: this.aiInsightFromSnapshots(snapshotKeys.map((k) => snapshotChanges[k])),
      stocksBrief: {
        summary: this.briefSummary("stocks", stockAvg),
        items: stockItems,
      },
      cryptoBrief: {
        summary: this.briefSummary("crypto", cryptoAvg),
        items: cryptoItems,
      },
      commoditiesBrief: {
        summary: this.briefSummary("commodities", commodityAvg),
        items: commodityCards.map((c) => ({
          id: c.id,
          symbol: c.symbol,
          name: c.name,
          slug: c.slug,
          marketType: "commodity" as const,
          priceFormatted: c.priceFormatted,
          change24h: c.change24h,
          logo: c.logo,
        })),
        cards: commodityCards,
      },
      vietnamGold: {
        summary:
          "Vietnam gold prices continue to trade at a significant premium compared to global gold prices due to domestic supply limitations and strong investor demand.",
        globalGoldFormatted: this.formatUsdOz(conversion.globalPriceUsdOz),
        perLuongFormatted: `${this.formatVndFull(conversion.equivalentVndPerLuong)}₫`,
        premiumFormatted: `+${premiumPct}%`,
        premiumPct,
        brands: (vnAll.items ?? []).map((b) => ({
          brand: b.name,
          buyFormatted: this.formatVndFull(b.buyPrice),
          sellFormatted: this.formatVndFull(b.sellPrice),
        })),
      },
      topMovers: {
        stocks: this.topMoversFromGainersLosers(stockMovers.gainers, stockMovers.losers, moverLimit),
        crypto: this.topMoversFromGainersLosers(cryptoMovers.gainers, cryptoMovers.losers, moverLimit),
        commodities: this.topMoversFromGainersLosers(commodityMovers.gainers, commodityMovers.losers, moverLimit),
      },
      latestNews,
    };
  }
}
