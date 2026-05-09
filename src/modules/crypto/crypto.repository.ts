import { Injectable } from "@nestjs/common";
import { MongoService } from "../../infrastructure/database/mongo.service";

type CryptoSnapshot = {
  crypto_id: string;
  price: number;
  change_24h: number;
  change_7d?: number;
  change_30d?: number;
  change_ytd?: number;
  market_cap?: number;
  volume_24h?: number;
  dominance?: number;
  rank?: number;
  quote_currency?: string;
  tradingview_scan?: Record<string, unknown>;
};

type CryptoDoc = {
  crypto_id: string;
  symbol: string;
  name: string;
  slug?: string;
  category?: string;
  ecosystem?: string;
  profile_category?: string;
  rank?: number;
};

@Injectable()
export class CryptoRepository {
  constructor(private readonly mongo: MongoService) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private normalizeCategoryToken(raw: string): string {
    const cleaned = raw
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!cleaned) return "";
    return cleaned
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private splitCategoryField(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .flatMap((item) => this.splitCategoryField(item))
        .filter(Boolean);
    }
    if (typeof value !== "string") return [];
    return value
      .split(",")
      .map((x) => this.normalizeCategoryToken(x))
      .filter(Boolean);
  }

  async getOverviewStats(): Promise<{
    totalMarketCap: number;
    totalVolume24h: number;
    cryptoMarketChange24h: number;
    btcDominance: number;
    btcDominanceChange24h: number;
    fearGreedTrend24h: number;
    fearGreed: number;
  }> {
    const [totals, avgCommodity, topCryptoRows] = await Promise.all([
      this.mongo.collection<CryptoSnapshot>("crypto_snapshots").aggregate([
        {
          $group: {
            _id: null,
            totalMarketCap: { $sum: "$market_cap" },
            totalVolume24h: { $sum: "$volume_24h" },
          },
        },
      ]).toArray(),
      this.mongo.collection("commodity_snapshots").aggregate([
        {
          $group: {
            _id: null,
            avgChange1d: { $avg: "$change_1d" },
          },
        },
      ]).toArray(),
      this.mongo.collection("cryptos").aggregate([
        {
          $lookup: {
            from: "crypto_snapshots",
            localField: "crypto_id",
            foreignField: "crypto_id",
            as: "snapshot",
          },
        },
        { $unwind: "$snapshot" },
        {
          $project: {
            symbol: 1,
            slug: 1,
            name: 1,
            market_cap: "$snapshot.market_cap",
            change_24h: "$snapshot.change_24h",
            dominance: "$snapshot.dominance",
          },
        },
        { $match: { market_cap: { $type: "number", $gt: 0 } } },
        { $sort: { market_cap: -1 } },
        { $limit: 200 },
      ]).toArray(),
    ]);

    const totalMarketCap = Number(totals[0]?.totalMarketCap ?? 0);
    const totalVolume24h = Number(totals[0]?.totalVolume24h ?? 0);
    const avgCommodityChange = Number(avgCommodity[0]?.avgChange1d ?? 0);
    const btcRow =
      topCryptoRows.find((x) => {
        const symbol = String(x.symbol ?? "").trim().toUpperCase();
        const slug = String(x.slug ?? "").trim().toLowerCase();
        const name = String(x.name ?? "").trim().toLowerCase();
        return symbol === "BTC" || slug === "bitcoin" || name === "bitcoin";
      }) ?? topCryptoRows[0];
    const snapshotDominance = Number(btcRow?.dominance ?? 0);
    const btcMarketCap = Number(btcRow?.market_cap ?? 0);
    const btcChange24h = Number(btcRow?.change_24h ?? 0);
    const computedDominance = totalMarketCap > 0 ? (btcMarketCap / totalMarketCap) * 100 : 0;
    const btcDominance = snapshotDominance > 0 ? snapshotDominance : computedDominance;
    const fearGreed = Math.max(0, Math.min(100, 50 + (btcChange24h * 4) + (avgCommodityChange * 2)));
    const fearGreedTrend24h = fearGreed - 50;
    return {
      totalMarketCap,
      totalVolume24h,
      cryptoMarketChange24h: btcChange24h,
      btcDominance,
      btcDominanceChange24h: btcChange24h,
      fearGreedTrend24h,
      fearGreed,
    };
  }

  async getTrendingEcosystems(limit: number): Promise<Array<{ name: string; change: number; count: number }>> {
    const rows = await this.mongo.collection("cryptos").aggregate([
      {
        $addFields: {
          ecosystemLabel: {
            $ifNull: [
              "$ecosystem",
              { $ifNull: ["$profile_category", { $ifNull: ["$category", "Other"] }] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "crypto_snapshots",
          localField: "crypto_id",
          foreignField: "crypto_id",
          as: "snapshot",
        },
      },
      { $unwind: "$snapshot" },
      { $match: { "snapshot.change_24h": { $type: "number" }, ecosystemLabel: { $type: "string", $ne: "" } } },
      {
        $project: {
          ecosystemLabel: 1,
          change_24h: "$snapshot.change_24h",
          market_cap: { $ifNull: ["$snapshot.market_cap", 0] },
        },
      },
      { $limit: 1500 },
    ]).toArray();

    type Bucket = { sumChange: number; count: number; totalCap: number };
    const byLabel = new Map<string, Bucket>();

    const normalizeToken = (token: string): string => {
      const cleaned = token
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (!cleaned) return "";
      return cleaned
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };

    for (const row of rows) {
      const raw = String(row.ecosystemLabel ?? "").trim();
      if (!raw) continue;
      const tokens = raw
        .split(",")
        .map((x) => normalizeToken(x))
        .filter(Boolean)
        .slice(0, 4);
      if (tokens.length === 0) continue;
      const uniqueTokens = [...new Set(tokens)];
      for (const token of uniqueTokens) {
        const existing = byLabel.get(token) ?? { sumChange: 0, count: 0, totalCap: 0 };
        existing.sumChange += Number(row.change_24h ?? 0);
        existing.count += 1;
        existing.totalCap += Number(row.market_cap ?? 0);
        byLabel.set(token, existing);
      }
    }

    return [...byLabel.entries()]
      .map(([name, data]) => ({
        name,
        change: data.count > 0 ? data.sumChange / data.count : 0,
        count: data.count,
        totalCap: data.totalCap,
      }))
      .sort((a, b) => b.change - a.change || b.totalCap - a.totalCap || b.count - a.count)
      .slice(0, limit)
      .map(({ name, change, count }) => ({ name, change, count }));
  }

  async getTopByMarketCap(limit: number): Promise<Array<CryptoSnapshot & { crypto?: CryptoDoc }>> {
    const snapshots = await this.mongo.find<CryptoSnapshot>("crypto_snapshots", {}, {
      projection: { crypto_id: 1, price: 1, change_24h: 1, change_7d: 1, change_30d: 1, change_ytd: 1, market_cap: 1, volume_24h: 1, rank: 1, quote_currency: 1 },
      sort: { market_cap: -1 },
      limit,
    });
    const ids = snapshots.map((x) => x.crypto_id);
    if (ids.length === 0) return [];
    const docs = await this.mongo.find<CryptoDoc>("cryptos", { crypto_id: { $in: ids } }, {
      projection: { crypto_id: 1, symbol: 1, name: 1, slug: 1, category: 1, ecosystem: 1, profile_category: 1, rank: 1 },
    });
    const byId = new Map(docs.map((x) => [x.crypto_id, x]));
    return snapshots.map((x) => ({ ...x, crypto: byId.get(x.crypto_id) }));
  }

  async getTopMovers(limit: number, sort: 1 | -1): Promise<Array<CryptoSnapshot & { crypto?: CryptoDoc }>> {
    const snapshots = await this.mongo.find<CryptoSnapshot>("crypto_snapshots", {}, {
      projection: { crypto_id: 1, price: 1, change_24h: 1, change_7d: 1, change_30d: 1, change_ytd: 1, market_cap: 1, volume_24h: 1, rank: 1, quote_currency: 1 },
      sort: { change_24h: sort },
      limit,
    });
    const ids = snapshots.map((x) => x.crypto_id);
    if (ids.length === 0) return [];
    const docs = await this.mongo.find<CryptoDoc>("cryptos", { crypto_id: { $in: ids } }, {
      projection: { crypto_id: 1, symbol: 1, name: 1, slug: 1, category: 1, ecosystem: 1, profile_category: 1, rank: 1 },
    });
    const byId = new Map(docs.map((x) => [x.crypto_id, x]));
    return snapshots.map((x) => ({ ...x, crypto: byId.get(x.crypto_id) }));
  }

  async getCryptos(
    limit: number,
    page: number,
    category?: string,
    search?: string,
    sortBy: "rank" | "marketCap" | "price" | "volume" = "rank",
    sortDir: "asc" | "desc" = "asc",
  ): Promise<{ items: Array<CryptoSnapshot & { crypto?: CryptoDoc }>; total: number }> {
    const filter: Record<string, unknown> = {};
    if (category) {
      const q = this.escapeRegex(category);
      filter.$or = [
        { category: { $regex: q, $options: "i" } },
        { profile_category: { $regex: q, $options: "i" } },
        { ecosystem: { $regex: q, $options: "i" } },
      ];
    }
    if (search) {
      const q = this.escapeRegex(search);
      const searchOr = [
        { symbol: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or as unknown[] }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const skip = Math.max(0, (page - 1) * limit);
    const normalizedSortBy = sortBy;
    const sortOrder = sortDir === "desc" ? -1 : 1;
    const sortFieldMap: Record<string, string> = {
      rank: "_sortRank",
      marketCap: "_sortMarketCap",
      price: "_sortPrice",
      volume: "_sortVolume",
    };
    const sortField = sortFieldMap[normalizedSortBy] ?? "_sortRank";
    const [rows, total] = await Promise.all([
      this.mongo.collection("cryptos").aggregate([
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
            _sortMarketCap: { $ifNull: ["$snapshot.market_cap", 0] },
            _sortPrice: { $ifNull: ["$snapshot.price", 0] },
            _sortVolume: { $ifNull: ["$snapshot.volume_24h", 0] },
          },
        },
        { $sort: { [sortField]: sortOrder, "_sortMarketCap": -1, "_sortVolume": -1 } },
        {
          $project: {
            crypto_id: 1,
            symbol: 1,
            name: 1,
            slug: 1,
            category: 1,
            ecosystem: 1,
            profile_category: 1,
            rank: 1,
            snapshot_rank: "$snapshot.rank",
            price: "$snapshot.price",
            change_24h: "$snapshot.change_24h",
            change_7d: "$snapshot.change_7d",
            change_30d: "$snapshot.change_30d",
            change_ytd: "$snapshot.change_ytd",
            market_cap: "$snapshot.market_cap",
            volume_24h: "$snapshot.volume_24h",
            quote_currency: "$snapshot.quote_currency",
          },
        },
        { $skip: skip },
        { $limit: limit },
      ]).toArray(),
      this.mongo.collection("cryptos").aggregate([
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
        { $count: "count" },
      ]).toArray(),
    ]);

    const items = rows.map((row) => ({
      crypto_id: String(row.crypto_id ?? ""),
      price: Number(row.price ?? 0),
      change_24h: Number(row.change_24h ?? 0),
      change_7d: typeof row.change_7d === "number" ? row.change_7d : undefined,
      change_30d: typeof row.change_30d === "number" ? row.change_30d : undefined,
      change_ytd: typeof row.change_ytd === "number" ? row.change_ytd : undefined,
      market_cap: typeof row.market_cap === "number" ? row.market_cap : undefined,
      volume_24h: typeof row.volume_24h === "number" ? row.volume_24h : undefined,
      rank: typeof row.rank === "number" ? row.rank : typeof row.snapshot_rank === "number" ? row.snapshot_rank : undefined,
      quote_currency: typeof row.quote_currency === "string" ? row.quote_currency : undefined,
      crypto: {
        crypto_id: String(row.crypto_id ?? ""),
        symbol: String(row.symbol ?? ""),
        name: String(row.name ?? ""),
        slug: typeof row.slug === "string" ? row.slug : undefined,
        category: typeof row.category === "string" ? row.category : undefined,
        ecosystem: typeof row.ecosystem === "string" ? row.ecosystem : undefined,
        profile_category: typeof row.profile_category === "string" ? row.profile_category : undefined,
        rank: typeof row.rank === "number" ? row.rank : undefined,
      },
    }));

    return { items, total: Number(total[0]?.count ?? 0) };
  }

  async getCategoryBuckets(): Promise<Array<{ name: string; count: number }>> {
    const rows = await this.mongo.collection("cryptos").find(
      {},
      {
        projection: {
          category: 1,
          profile_category: 1,
          ecosystem: 1,
        },
      },
    ).toArray();

    const counts = new Map<string, number>();
    for (const row of rows) {
      const tokens = new Set<string>([
        ...this.splitCategoryField(row.profile_category),
        ...this.splitCategoryField(row.category),
        ...this.splitCategoryField(row.ecosystem),
      ]);
      if (tokens.size === 0) continue;
      for (const token of tokens) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
