import { Injectable } from "@nestjs/common";
import { Document, ObjectId } from "mongodb";
import { MongoService } from "../../infrastructure/database/mongo.service";

export interface CryptoDetailRecord {
  crypto_id: string;
  symbol: string;
  name: string;
  slug?: string;
  logo?: string;
  category?: string;
  profile_category?: string;
  ecosystem?: string;
  consensus?: string;
  description?: string;
  website_url?: string;
  website_urls?: string[];
  source_code_url?: string;
  source_code_urls?: string[];
  whitepaper_url?: string;
  whitepaper_urls?: string[];
  explorer_urls?: string[];
  community_url?: string;
  community_urls?: string[];
  rank?: number;
  source_ids?: {
    tradingviewTicker?: string;
    tradingviewSymbolSlug?: string;
  };
}

export interface CryptoDetailSnapshotRecord {
  crypto_id: string;
  price: number;
  change_24h: number;
  change_7d?: number;
  change_30d?: number;
  change_ytd?: number;
  market_cap?: number;
  volume_24h?: number;
  circulating_supply?: number;
  total_supply?: number | null;
  max_supply?: number | null;
  ath?: number;
  atl?: number;
  dominance?: number;
  rank?: number;
  quote_currency?: string;
  tradingview_scan?: Record<string, unknown>;
  updated_at?: Date;
}

export interface CryptoDetailNewsRecord {
  _id?: ObjectId;
  title?: string;
  summary?: string;
  market?: string;
  published_at?: Date;
  source?: string;
  url?: string;
  symbols?: string[];
  category?: string;
}

@Injectable()
export class CryptoDetailRepository {
  constructor(private readonly mongo: MongoService) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async getCryptoBySlug(slug: string): Promise<CryptoDetailRecord | null> {
    const trimmed = slug.trim();
    if (!trimmed) return null;
    const doc = await this.mongo.collection<CryptoDetailRecord & Document>("cryptos").findOne({
      $or: [
        { slug: trimmed.toLowerCase() },
        { symbol: { $regex: `^${this.escapeRegex(trimmed)}$`, $options: "i" } },
        { crypto_id: trimmed },
      ],
    });
    return (doc as CryptoDetailRecord) ?? null;
  }

  async getSnapshot(cryptoId: string): Promise<CryptoDetailSnapshotRecord | null> {
    const doc = await this.mongo.collection<CryptoDetailSnapshotRecord & Document>("crypto_snapshots").findOne(
      { crypto_id: cryptoId },
    );
    return (doc as CryptoDetailSnapshotRecord) ?? null;
  }

  async getRelatedCryptos(
    cryptoId: string,
    category: string | undefined,
    ecosystem: string | undefined,
    limit: number,
  ): Promise<Array<CryptoDetailRecord & { snapshot?: CryptoDetailSnapshotRecord }>> {
    const baseMatch: Record<string, unknown> = { crypto_id: { $ne: cryptoId } };
    const or: Record<string, unknown>[] = [];
    if (ecosystem) {
      or.push({ ecosystem: { $regex: this.escapeRegex(ecosystem.split(",")[0]?.trim() ?? ecosystem), $options: "i" } });
    }
    if (category) {
      or.push({ category: { $regex: this.escapeRegex(category.split(",")[0]?.trim() ?? category), $options: "i" } });
      or.push({ profile_category: { $regex: this.escapeRegex(category.split(",")[0]?.trim() ?? category), $options: "i" } });
    }
    if (or.length > 0) baseMatch.$or = or;

    const rows = await this.mongo.collection("cryptos").aggregate([
      { $match: baseMatch },
      {
        $lookup: {
          from: "crypto_snapshots",
          localField: "crypto_id",
          foreignField: "crypto_id",
          as: "snapshot",
        },
      },
      { $unwind: "$snapshot" },
      { $match: { "snapshot.price": { $type: "number" }, "snapshot.change_24h": { $type: "number" } } },
      { $sort: { "snapshot.market_cap": -1, "snapshot.volume_24h": -1 } },
      { $limit: limit },
    ]).toArray();

    return rows.map((row) => ({
      ...(row as CryptoDetailRecord),
      snapshot: row.snapshot as CryptoDetailSnapshotRecord,
    }));
  }

  async getCryptoNews(symbol: string, category: string | undefined, limit: number): Promise<CryptoDetailNewsRecord[]> {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return [];
    const direct = await this.mongo.find<CryptoDetailNewsRecord & Document>(
      "market_news",
      {
        $or: [
          { symbols: { $regex: `^${this.escapeRegex(sym)}$`, $options: "i" } },
          { title: { $regex: this.escapeRegex(sym), $options: "i" } },
          { summary: { $regex: this.escapeRegex(sym), $options: "i" } },
        ],
      },
      {
        projection: { title: 1, summary: 1, market: 1, published_at: 1, source: 1, url: 1, symbols: 1, category: 1 },
        sort: { published_at: -1 },
        limit,
      },
    );
    if (direct.length >= limit) return direct.slice(0, limit);

    const filler = category
      ? await this.mongo.find<CryptoDetailNewsRecord & Document>(
          "market_news",
          {
            market: { $regex: /crypto/i },
            $or: [
              { category: { $regex: this.escapeRegex(category), $options: "i" } },
              { title: { $regex: this.escapeRegex(category), $options: "i" } },
            ],
          },
          {
            projection: { title: 1, summary: 1, market: 1, published_at: 1, source: 1, url: 1, symbols: 1, category: 1 },
            sort: { published_at: -1 },
            limit: limit - direct.length,
          },
        )
      : [];

    const merged = [...direct, ...filler];
    if (merged.length >= limit) return merged.slice(0, limit);

    const generic = await this.mongo.find<CryptoDetailNewsRecord & Document>(
      "market_news",
      { market: { $regex: /crypto/i } },
      {
        projection: { title: 1, summary: 1, market: 1, published_at: 1, source: 1, url: 1, symbols: 1, category: 1 },
        sort: { published_at: -1 },
        limit: limit - merged.length,
      },
    );
    return [...merged, ...generic].slice(0, limit);
  }
}
