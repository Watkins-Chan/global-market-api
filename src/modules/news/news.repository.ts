import { Injectable } from "@nestjs/common";
import { Document, Filter, ObjectId } from "mongodb";
import { MongoService } from "../../infrastructure/database/mongo.service";
import { NewsMarket, NewsTagCount } from "./news.types";

export interface NewsRecord {
  _id?: ObjectId;
  slug?: string;
  title?: string;
  summary?: string;
  market?: string;
  category?: string;
  source?: string;
  source_url?: string;
  url?: string;
  image_url?: string;
  tags?: string[];
  symbols?: string[];
  published_at?: Date;
}

export interface NewsQueryFilter {
  market?: "all" | NewsMarket;
  tag?: string;
  search?: string;
}

const MARKETS: NewsMarket[] = ["stock", "crypto", "commodity"];

@Injectable()
export class NewsRepository {
  constructor(private readonly mongo: MongoService) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private buildFilter(query: NewsQueryFilter): Filter<NewsRecord & Document> {
    const filter: Filter<NewsRecord & Document> = {
      url: { $type: "string", $ne: "" },
    };
    filter.market = query.market && query.market !== "all" ? query.market : { $in: MARKETS };
    if (query.tag) {
      filter.tags = { $regex: `^${this.escapeRegex(query.tag)}$`, $options: "i" };
    }
    if (query.search) {
      const rx = { $regex: this.escapeRegex(query.search), $options: "i" };
      filter.$or = [{ title: rx }, { summary: rx }, { tags: rx }];
    }
    return filter;
  }

  async findNews(
    query: NewsQueryFilter,
    pagination: { skip: number; limit: number },
  ): Promise<{ items: NewsRecord[]; total: number }> {
    const filter = this.buildFilter(query);
    const collection = this.mongo.collection<NewsRecord & Document>("market_news");
    const [items, total] = await Promise.all([
      collection
        .find(filter, {
          projection: {
            title: 1,
            summary: 1,
            market: 1,
            category: 1,
            source: 1,
            source_url: 1,
            url: 1,
            image_url: 1,
            tags: 1,
            symbols: 1,
            published_at: 1,
            slug: 1,
          },
          sort: { published_at: -1 },
          skip: pagination.skip,
          limit: pagination.limit,
        })
        .toArray(),
      collection.countDocuments(filter),
    ]);
    return { items, total };
  }

  async topTags(market: "all" | NewsMarket, limit: number): Promise<NewsTagCount[]> {
    const match: Filter<NewsRecord & Document> = {
      url: { $type: "string", $ne: "" },
    };
    match.market = market && market !== "all" ? market : { $in: MARKETS };

    const rows = await this.mongo
      .collection<NewsRecord & Document>("market_news")
      .aggregate<{ _id: string; count: number }>([
        { $match: match },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: limit },
      ])
      .toArray();

    return rows.map((row) => ({ tag: row._id, count: row.count }));
  }
}
