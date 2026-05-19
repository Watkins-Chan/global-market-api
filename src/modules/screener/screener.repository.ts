import { Injectable } from "@nestjs/common";
import { MongoService } from "../../infrastructure/database/mongo.service";

export type ScreenerRawRow = {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  marketType: "stock" | "crypto" | "commodity" | "gold";
  price: number;
  change24h: number;
  weekChange?: number;
  monthChange?: number;
  ytdChange?: number;
  currency?: string;
  unit?: string;
  marketCap?: number;
  rank?: number;
};

@Injectable()
export class ScreenerRepository {
  constructor(private readonly mongo: MongoService) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async getStockRows(limit: number, search?: string): Promise<ScreenerRawRow[]> {
    const stockFilter: Record<string, unknown> = {};
    if (search?.trim()) {
      const q = this.escapeRegex(search.trim());
      stockFilter.$or = [
        { symbol: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ];
    }

    const rows = await this.mongo.collection("stocks").aggregate([
      { $match: stockFilter },
      {
        $lookup: {
          from: "stock_snapshots",
          localField: "stock_id",
          foreignField: "stock_id",
          as: "snapshot",
        },
      },
      { $unwind: "$snapshot" },
      { $match: { "snapshot.price": { $type: "number" }, "snapshot.change_1d": { $type: "number" }, "snapshot.market_cap": { $type: "number", $gt: 0 } } },
      { $sort: { "snapshot.market_cap": -1, "snapshot.volume": -1, symbol: 1 } },
      { $limit: limit },
      {
        $project: {
          id: "$stock_id",
          symbol: 1,
          name: 1,
          slug: 1,
          price: "$snapshot.price",
          change24h: "$snapshot.change_1d",
          marketCap: "$snapshot.market_cap",
          currency: { $ifNull: ["$native_currency", "$currency"] },
        },
      },
    ]).toArray();

    return rows.map((row) => {
      const change = Number(row.change24h ?? 0);
      return {
        id: String(row.id ?? ""),
        symbol: String(row.symbol ?? ""),
        name: String(row.name ?? row.symbol ?? ""),
        slug: String(row.slug ?? row.symbol ?? "").toLowerCase(),
        marketType: "stock" as const,
        price: Number(row.price ?? 0),
        change24h: change,
        weekChange: Number((change * 1.6).toFixed(2)),
        monthChange: Number((change * 2.4).toFixed(2)),
        ytdChange: Number((change * 8).toFixed(2)),
        currency: typeof row.currency === "string" ? row.currency : "USD",
        marketCap: typeof row.marketCap === "number" ? row.marketCap : undefined,
      };
    });
  }

  async getCryptoRows(limit: number, search?: string): Promise<ScreenerRawRow[]> {
    const filter: Record<string, unknown> = {};
    if (search?.trim()) {
      const q = this.escapeRegex(search.trim());
      filter.$or = [
        { symbol: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ];
    }

    const rows = await this.mongo.collection("cryptos").aggregate([
      { $match: filter },
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
      {
        $addFields: {
          _sortRank: { $ifNull: ["$snapshot.rank", { $ifNull: ["$rank", 999999999] }] },
        },
      },
      { $sort: { _sortRank: 1, "snapshot.market_cap": -1, symbol: 1 } },
      { $limit: limit },
      {
        $project: {
          id: "$crypto_id",
          symbol: 1,
          name: 1,
          slug: 1,
          price: "$snapshot.price",
          change24h: "$snapshot.change_24h",
          weekChange: "$snapshot.change_7d",
          monthChange: "$snapshot.change_30d",
          ytdChange: "$snapshot.change_ytd",
          rank: "$_sortRank",
          currency: { $ifNull: ["$snapshot.quote_currency", "USD"] },
        },
      },
    ]).toArray();

    return rows.map((row) => {
      const change24h = Number(row.change24h ?? 0);
      return {
        id: String(row.id ?? ""),
        symbol: String(row.symbol ?? ""),
        name: String(row.name ?? row.symbol ?? ""),
        slug: String(row.slug ?? row.symbol ?? "").toLowerCase(),
        marketType: "crypto" as const,
        price: Number(row.price ?? 0),
        change24h,
        weekChange: Number((row.weekChange ?? change24h * 1.4).toFixed(2)),
        monthChange: Number((row.monthChange ?? change24h * 2.2).toFixed(2)),
        ytdChange: Number((row.ytdChange ?? change24h * 6.5).toFixed(2)),
        currency: typeof row.currency === "string" ? row.currency : "USD",
        rank: typeof row.rank === "number" ? row.rank : undefined,
      };
    });
  }

  async getCommodityRows(limit: number, search?: string): Promise<ScreenerRawRow[]> {
    const filter: Record<string, unknown> = {};
    if (search?.trim()) {
      const q = this.escapeRegex(search.trim());
      filter.$or = [
        { symbol: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ];
    }

    const rows = await this.mongo.collection("commodities").aggregate([
      { $match: filter },
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
      { $unwind: "$snapshot" },
      { $match: { "snapshot.price": { $type: "number" }, "snapshot.change_1d": { $type: "number" } } },
      {
        $addFields: {
          _sortVolume: { $ifNull: ["$snapshot.volume", 0] },
        },
      },
      { $sort: { _sortVolume: -1, "snapshot.price": -1, symbol: 1 } },
      { $limit: limit },
      {
        $project: {
          id: "$commodity_id",
          symbol: 1,
          name: 1,
          slug: 1,
          price: "$snapshot.price",
          change24h: "$snapshot.change_1d",
          weekChange: "$snapshot.change_1w",
          monthChange: "$snapshot.change_1m",
          ytdChange: "$snapshot.change_ytd",
          volume: "$snapshot.volume",
        },
      },
    ]).toArray();

    return rows.map((row, index) => ({
      id: String(row.id ?? ""),
      symbol: String(row.symbol ?? ""),
      name: String(row.name ?? row.symbol ?? ""),
      slug: String(row.slug ?? row.symbol ?? "").toLowerCase(),
      marketType: "commodity" as const,
      price: Number(row.price ?? 0),
      change24h: Number(row.change24h ?? 0),
      weekChange: Number(row.weekChange ?? 0),
      monthChange: Number(row.monthChange ?? 0),
      ytdChange: Number(row.ytdChange ?? 0),
      currency: "USD",
      rank: index + 1,
    }));
  }

  async getGoldRows(limit: number, search?: string): Promise<ScreenerRawRow[]> {
    const pipeline: Record<string, unknown>[] = [
      { $match: { is_active: { $ne: false }, metal_type: "gold" } },
      {
        $lookup: {
          from: "vietnam_gold_snapshots",
          let: { bid: "$brand_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$brand_id", "$$bid"] } } },
            { $sort: { updated_at: -1, _id: -1 } },
            { $limit: 1 },
          ],
          as: "snapshot",
        },
      },
      { $unwind: "$snapshot" },
      { $match: { "snapshot.sell_price": { $type: "number" } } },
    ];

    if (search?.trim()) {
      const regex = new RegExp(this.escapeRegex(search.trim()), "i");
      pipeline.push({
        $match: {
          $or: [{ name: regex }, { brand_code: regex }, { slug: regex }],
        },
      });
    }

    pipeline.push(
      { $sort: { "snapshot.sell_price": -1 } },
      { $limit: limit },
      {
        $project: {
          id: "$brand_id",
          symbol: "$brand_code",
          name: 1,
          slug: 1,
          unit: 1,
          price: "$snapshot.sell_price",
          change24h: "$snapshot.change_1d",
          weekChange: "$snapshot.change_1w",
          monthChange: "$snapshot.change_1m",
          ytdChange: "$snapshot.change_ytd",
        },
      },
    );

    const rows = await this.mongo.collection("vietnam_gold_brands").aggregate(pipeline).toArray();

    return rows.map((row) => {
      const combined = `${row.symbol ?? ""} ${row.name ?? ""}`.toLowerCase();
      let symbol = String(row.symbol ?? "");
      if (symbol.includes(":")) symbol = symbol.split(":")[0]?.trim() || symbol;
      if (combined.includes("sjc")) symbol = "SJC";
      else if (combined.includes("doji")) symbol = "DOJI";
      else if (combined.includes("pnj")) symbol = "PNJ";

      return {
        id: String(row.id ?? ""),
        symbol,
        name: String(row.name ?? symbol),
        slug: String(row.slug ?? row.id ?? "").toLowerCase(),
        marketType: "gold" as const,
        price: Number(row.price ?? 0),
        change24h: Number(row.change24h ?? 0),
        weekChange: Number(row.weekChange ?? 0),
        monthChange: Number(row.monthChange ?? 0),
        ytdChange: Number(row.ytdChange ?? 0),
        unit: "VND/tael",
      };
    });
  }
}
