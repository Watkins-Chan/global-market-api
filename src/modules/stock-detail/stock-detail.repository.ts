import { Injectable } from "@nestjs/common";
import { Document, ObjectId } from "mongodb";
import { MongoService } from "../../infrastructure/database/mongo.service";

export interface StockDetailRecord {
  stock_id: string;
  symbol: string;
  name: string;
  slug?: string;
  logo?: string;
  exchange?: string;
  exchange_source_name?: string;
  exchange_source_url?: string;
  sector?: string;
  industry?: string;
  country?: string;
  country_code?: string;
  currency?: string;
  native_currency?: string;
  description?: string;
  ceo?: string;
  headquarters?: string;
  company_website?: string;
  founded?: string;
  number_of_employees_fy?: number;
  revenue_fy?: number;
  net_income_fy?: number;
  net_margin_fy?: number;
  gross_profit_yoy_growth_ttm?: number;
  isin?: string;
  market_cap?: number;
  source_ids?: {
    tradingviewTicker?: string;
    tradingviewSymbolSlug?: string;
    yahooSymbol?: string;
  };
}

export interface StockDetailSnapshotRecord {
  stock_id: string;
  price: number;
  change_1d: number;
  change_1w?: number;
  change_1m?: number;
  change_ytd?: number;
  market_cap?: number;
  volume?: number;
  avg_volume?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  week_52_high?: number;
  week_52_low?: number;
  pe_ratio?: number | null;
  eps?: number | null;
  dividend_yield?: number | null;
  beta?: number | null;
  sparkline_7d?: number[];
  updated_at?: Date;
}

export interface StockDetailNewsRecord {
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
export class StockDetailRepository {
  constructor(private readonly mongo: MongoService) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async getStockBySlug(slug: string): Promise<StockDetailRecord | null> {
    const trimmed = slug.trim();
    if (!trimmed) return null;
    const doc = await this.mongo.collection<StockDetailRecord & Document>("stocks").findOne(
      {
        $or: [
          { slug: trimmed.toLowerCase() },
          { symbol: { $regex: `^${this.escapeRegex(trimmed)}$`, $options: "i" } },
          { stock_id: trimmed },
        ],
      },
    );
    return (doc as StockDetailRecord) ?? null;
  }

  async getSnapshot(stockId: string): Promise<StockDetailSnapshotRecord | null> {
    const doc = await this.mongo.collection<StockDetailSnapshotRecord & Document>("stock_snapshots").findOne(
      { stock_id: stockId },
    );
    return (doc as StockDetailSnapshotRecord) ?? null;
  }

  async getRelatedStocks(
    stockId: string,
    sector: string | undefined,
    industry: string | undefined,
    countryCode: string | undefined,
    limit: number,
  ): Promise<Array<StockDetailRecord & { snapshot?: StockDetailSnapshotRecord }>> {
    const baseMatch: Record<string, unknown> = { stock_id: { $ne: stockId } };
    if (industry) baseMatch.industry = { $regex: `^${this.escapeRegex(industry)}$`, $options: "i" };
    else if (sector) baseMatch.sector = { $regex: `^${this.escapeRegex(sector)}$`, $options: "i" };
    if (countryCode) baseMatch.country_code = { $regex: `^${this.escapeRegex(countryCode)}$`, $options: "i" };

    const rows = await this.mongo.collection("stocks").aggregate([
      { $match: baseMatch },
      {
        $lookup: {
          from: "stock_snapshots",
          localField: "stock_id",
          foreignField: "stock_id",
          as: "snapshot",
        },
      },
      { $unwind: "$snapshot" },
      { $match: { "snapshot.price": { $type: "number" }, "snapshot.change_1d": { $type: "number" } } },
      { $sort: { "snapshot.market_cap": -1, "snapshot.volume": -1 } },
      { $limit: limit },
    ]).toArray();

    return rows.map((row) => ({
      ...(row as StockDetailRecord),
      snapshot: row.snapshot as StockDetailSnapshotRecord,
    }));
  }

  async getRelatedBySector(stockId: string, sector: string, countryCode: string | undefined, limit: number) {
    return this.getRelatedStocks(stockId, sector, undefined, countryCode, limit);
  }

  async getStockNews(
    symbol: string,
    sector: string | undefined,
    limit: number,
  ): Promise<StockDetailNewsRecord[]> {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return [];
    const direct = await this.mongo.find<StockDetailNewsRecord & Document>(
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

    const filler = sector
      ? await this.mongo.find<StockDetailNewsRecord & Document>(
          "market_news",
          {
            market: { $regex: /stock/i },
            $or: [
              { category: { $regex: this.escapeRegex(sector), $options: "i" } },
              { title: { $regex: this.escapeRegex(sector), $options: "i" } },
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

    const generic = await this.mongo.find<StockDetailNewsRecord & Document>(
      "market_news",
      { market: { $regex: /stock/i } },
      {
        projection: { title: 1, summary: 1, market: 1, published_at: 1, source: 1, url: 1, symbols: 1, category: 1 },
        sort: { published_at: -1 },
        limit: limit - merged.length,
      },
    );
    return [...merged, ...generic].slice(0, limit);
  }
}
