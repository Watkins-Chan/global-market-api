import { Injectable } from "@nestjs/common";
import { NewsQueryDto, NewsTagsQueryDto } from "./dto/news-query.dto";
import { NewsRecord, NewsRepository } from "./news.repository";
import { NewsItem, NewsListResponse, NewsMarket, NewsTagsResponse } from "./news.types";

const DEFAULT_LIMIT = 24;
const DEFAULT_TAGS_LIMIT = 24;

const MARKET_LABEL: Record<NewsMarket, string> = {
  stock: "Stocks",
  crypto: "Crypto",
  commodity: "Commodities",
};

@Injectable()
export class NewsService {
  constructor(private readonly repo: NewsRepository) {}

  private relTime(date?: Date): string {
    if (!date) return "";
    const ts = date instanceof Date ? date.getTime() : new Date(date).getTime();
    if (!Number.isFinite(ts)) return "";
    const diffMs = Date.now() - ts;
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.round(months / 12)}y ago`;
  }

  private normalizeMarket(market?: string): NewsMarket {
    if (market === "crypto" || market === "commodity") return market;
    return "stock";
  }

  private toItem(record: NewsRecord): NewsItem {
    const market = this.normalizeMarket(record.market);
    return {
      id: String(record._id ?? record.slug ?? ""),
      slug: record.slug ?? "",
      title: record.title ?? "",
      summary: record.summary ?? "",
      market,
      category: record.category ?? MARKET_LABEL[market],
      source: record.source ?? "Unknown",
      sourceUrl: record.source_url ?? "",
      url: record.url ?? "",
      imageUrl: record.image_url || undefined,
      tags: Array.isArray(record.tags) ? record.tags : [],
      symbols: Array.isArray(record.symbols) ? record.symbols : [],
      publishedAt: record.published_at ? new Date(record.published_at).toISOString() : "",
      time: this.relTime(record.published_at),
    };
  }

  async getNews(query: NewsQueryDto): Promise<NewsListResponse> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const page = query.page ?? 1;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repo.findNews(
      { market: query.market ?? "all", tag: query.tag, search: query.search },
      { skip, limit },
    );

    return {
      items: items.map((row) => this.toItem(row)),
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
      generatedAt: new Date().toISOString(),
    };
  }

  async getTags(query: NewsTagsQueryDto): Promise<NewsTagsResponse> {
    const market = query.market ?? "all";
    const limit = query.limit ?? DEFAULT_TAGS_LIMIT;
    const tags = await this.repo.topTags(market, limit);
    return { market, tags, generatedAt: new Date().toISOString() };
  }
}
