import { Injectable } from "@nestjs/common";
import { Document, ObjectId } from "mongodb";
import { MongoService } from "../../infrastructure/database/mongo.service";

export interface CommodityDetailRecord {
  commodity_id: string;
  symbol: string;
  name: string;
  slug?: string;
  logo?: string;
  group?: string;
  category?: string;
  benchmark?: string;
  unit?: string;
  description?: string;
  source_ids?: {
    tradingEconomicsCommoditySlug?: string;
    yahooSymbol?: string;
  };
}

export interface CommodityDetailSnapshotRecord {
  commodity_id: string;
  price: number;
  change_1d: number;
  change_1w?: number;
  change_1m?: number;
  change_ytd?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  avg_volume?: number;
  open_interest?: number;
  sparkline_7d?: number[];
  updated_at?: Date;
}

export interface CommodityDetailNewsRecord {
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
export class CommodityDetailRepository {
  constructor(private readonly mongo: MongoService) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async getCommodityBySlug(slug: string): Promise<CommodityDetailRecord | null> {
    const trimmed = slug.trim();
    if (!trimmed) return null;
    const lowered = trimmed.toLowerCase();
    const doc = await this.mongo.collection<CommodityDetailRecord & Document>("commodities").findOne({
      $or: [
        { slug: lowered },
        { symbol: { $regex: `^${this.escapeRegex(trimmed)}$`, $options: "i" } },
        { commodity_id: trimmed },
        { "source_ids.tradingEconomicsCommoditySlug": lowered },
      ],
    });
    return (doc as CommodityDetailRecord) ?? null;
  }

  async getSnapshot(commodityId: string): Promise<CommodityDetailSnapshotRecord | null> {
    const doc = await this.mongo.collection<CommodityDetailSnapshotRecord & Document>("commodity_snapshots").findOne(
      { commodity_id: commodityId },
      { sort: { updated_at: -1, _id: -1 } },
    );
    return (doc as CommodityDetailSnapshotRecord) ?? null;
  }

  async getRelatedCommodities(
    commodityId: string,
    group: string | undefined,
    limit: number,
  ): Promise<Array<CommodityDetailRecord & { snapshot?: CommodityDetailSnapshotRecord }>> {
    const baseMatch: Record<string, unknown> = { commodity_id: { $ne: commodityId } };
    if (group) {
      baseMatch.group = { $regex: `^${this.escapeRegex(group)}$`, $options: "i" };
    }

    const rows = await this.mongo.collection("commodities").aggregate([
      { $match: baseMatch },
      {
        $lookup: {
          from: "commodity_snapshots",
          let: { cid: "$commodity_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$commodity_id", "$$cid"] } } },
            { $sort: { updated_at: -1, _id: -1 } },
            { $limit: 1 },
          ],
          as: "snapshot",
        },
      },
      { $unwind: { path: "$snapshot", preserveNullAndEmptyArrays: true } },
      { $sort: { "snapshot.volume": -1, name: 1 } },
      { $limit: limit },
    ]).toArray();

    return rows.map((row) => ({
      ...(row as CommodityDetailRecord),
      snapshot: row.snapshot as CommodityDetailSnapshotRecord | undefined,
    }));
  }

  async getCommodityNews(
    symbol: string,
    name: string,
    group: string | undefined,
    limit: number,
  ): Promise<CommodityDetailNewsRecord[]> {
    const sym = symbol.trim().toUpperCase();
    const namePart = name.trim();
    const or: Record<string, unknown>[] = [];
    if (sym) {
      or.push(
        { symbols: { $regex: `^${this.escapeRegex(sym)}$`, $options: "i" } },
        { title: { $regex: this.escapeRegex(sym), $options: "i" } },
        { summary: { $regex: this.escapeRegex(sym), $options: "i" } },
      );
    }
    if (namePart.length >= 4) {
      or.push(
        { title: { $regex: this.escapeRegex(namePart), $options: "i" } },
        { summary: { $regex: this.escapeRegex(namePart), $options: "i" } },
      );
    }

    if (or.length > 0) {
      const direct = await this.mongo.find<CommodityDetailNewsRecord & Document>(
        "market_news",
        { $or: or },
        {
          projection: { title: 1, summary: 1, market: 1, published_at: 1, source: 1, url: 1, symbols: 1, category: 1 },
          sort: { published_at: -1 },
          limit,
        },
      );
      if (direct.length >= limit) return direct.slice(0, limit);
    }

    const groupTerm = group?.trim();
    if (!groupTerm) return [];

    return this.mongo.find<CommodityDetailNewsRecord & Document>(
      "market_news",
      {
        $or: [
          { market: { $regex: /commodit/i } },
          { category: { $regex: this.escapeRegex(groupTerm), $options: "i" } },
          { title: { $regex: this.escapeRegex(groupTerm), $options: "i" } },
        ],
      },
      {
        projection: { title: 1, summary: 1, market: 1, published_at: 1, source: 1, url: 1, symbols: 1, category: 1 },
        sort: { published_at: -1 },
        limit,
      },
    );
  }
}
