import { Injectable } from "@nestjs/common";
import { Document, ObjectId } from "mongodb";
import { MongoService } from "../../infrastructure/database/mongo.service";

type StockSnapshot = {
  stock_id: string;
  price: number;
  change_1d: number;
  market_cap?: number;
  volume?: number;
};

type StockDoc = {
  stock_id: string;
  symbol: string;
  name: string;
  slug?: string;
  logo?: string;
  sector?: string;
  industry?: string;
  country?: string;
  country_code?: string;
  currency?: string;
  native_currency?: string;
};

type NewsDoc = {
  _id?: ObjectId;
  title?: string;
  summary?: string;
  market?: string;
  published_at?: Date;
  source?: string;
  url?: string;
};

@Injectable()
export class StocksRepository {
  constructor(private readonly mongo: MongoService) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async getTopStockMovers(limit: number, sort: 1 | -1, countryCode?: string): Promise<Array<StockSnapshot & { stock?: StockDoc }>> {
    if (countryCode) {
      const rows = await this.mongo.collection("stocks").aggregate([
        { $match: { country_code: { $regex: `^${this.escapeRegex(countryCode)}$`, $options: "i" } } },
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
        { $sort: { "snapshot.change_1d": sort } },
        { $limit: limit },
        {
          $project: {
            stock_id: 1,
            symbol: 1,
            name: 1,
            slug: 1,
            logo: 1,
            sector: 1,
            industry: 1,
            country: 1,
            country_code: 1,
            currency: 1,
            native_currency: 1,
            price: "$snapshot.price",
            change_1d: "$snapshot.change_1d",
            market_cap: "$snapshot.market_cap",
            volume: "$snapshot.volume",
          },
        },
      ]).toArray();
      return rows.map((row) => ({
        stock_id: String(row.stock_id ?? ""),
        price: Number(row.price ?? 0),
        change_1d: Number(row.change_1d ?? 0),
        market_cap: typeof row.market_cap === "number" ? row.market_cap : undefined,
        volume: typeof row.volume === "number" ? row.volume : undefined,
        stock: {
          stock_id: String(row.stock_id ?? ""),
          symbol: String(row.symbol ?? ""),
          name: String(row.name ?? ""),
          slug: typeof row.slug === "string" ? row.slug : undefined,
          logo: typeof row.logo === "string" ? row.logo : undefined,
          sector: typeof row.sector === "string" ? row.sector : undefined,
          industry: typeof row.industry === "string" ? row.industry : undefined,
          country: typeof row.country === "string" ? row.country : undefined,
          country_code: typeof row.country_code === "string" ? row.country_code : undefined,
          currency: typeof row.currency === "string" ? row.currency : undefined,
          native_currency: typeof row.native_currency === "string" ? row.native_currency : undefined,
        },
      }));
    }
    const snapshots = await this.mongo.find<StockSnapshot>("stock_snapshots", {}, {
      projection: { stock_id: 1, price: 1, change_1d: 1, market_cap: 1, volume: 1 },
      sort: { change_1d: sort },
      limit,
    });
    const ids = snapshots.map((x) => x.stock_id);
    if (ids.length === 0) return [];
    const docs = await this.mongo.find<StockDoc>("stocks", { stock_id: { $in: ids } }, {
      projection: { stock_id: 1, symbol: 1, name: 1, slug: 1, logo: 1, sector: 1, industry: 1, country: 1, country_code: 1, currency: 1, native_currency: 1 },
    });
    const byId = new Map(docs.map((x) => [x.stock_id, x]));
    return snapshots.map((x) => ({ ...x, stock: byId.get(x.stock_id) }));
  }

  async getTopStockByMarketCap(): Promise<(StockSnapshot & { stock?: StockDoc }) | null> {
    const [item] = await this.mongo.find<StockSnapshot>("stock_snapshots", {}, {
      projection: { stock_id: 1, price: 1, change_1d: 1, market_cap: 1, volume: 1 },
      sort: { market_cap: -1 },
      limit: 1,
    });
    if (!item) return null;
    const doc = await this.mongo.collection<StockDoc>("stocks").findOne(
      { stock_id: item.stock_id },
      { projection: { stock_id: 1, symbol: 1, name: 1, slug: 1, logo: 1, sector: 1, industry: 1, country: 1, country_code: 1, currency: 1, native_currency: 1 } },
    );
    return { ...item, stock: doc ?? undefined };
  }

  async getTopStocksByMarketCap(limit: number, countryCode?: string): Promise<Array<StockSnapshot & { stock?: StockDoc }>> {
    if (countryCode) {
      const rows = await this.mongo.collection("stocks").aggregate([
        { $match: { country_code: { $regex: `^${this.escapeRegex(countryCode)}$`, $options: "i" } } },
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
        {
          $project: {
            stock_id: 1,
            symbol: 1,
            name: 1,
            slug: 1,
            logo: 1,
            sector: 1,
            industry: 1,
            country: 1,
            country_code: 1,
            currency: 1,
            native_currency: 1,
            price: "$snapshot.price",
            change_1d: "$snapshot.change_1d",
            market_cap: "$snapshot.market_cap",
            volume: "$snapshot.volume",
          },
        },
      ]).toArray();
      return rows.map((row) => ({
        stock_id: String(row.stock_id ?? ""),
        price: Number(row.price ?? 0),
        change_1d: Number(row.change_1d ?? 0),
        market_cap: typeof row.market_cap === "number" ? row.market_cap : undefined,
        volume: typeof row.volume === "number" ? row.volume : undefined,
        stock: {
          stock_id: String(row.stock_id ?? ""),
          symbol: String(row.symbol ?? ""),
          name: String(row.name ?? ""),
          slug: typeof row.slug === "string" ? row.slug : undefined,
          logo: typeof row.logo === "string" ? row.logo : undefined,
          sector: typeof row.sector === "string" ? row.sector : undefined,
          industry: typeof row.industry === "string" ? row.industry : undefined,
          country: typeof row.country === "string" ? row.country : undefined,
          country_code: typeof row.country_code === "string" ? row.country_code : undefined,
          currency: typeof row.currency === "string" ? row.currency : undefined,
          native_currency: typeof row.native_currency === "string" ? row.native_currency : undefined,
        },
      }));
    }
    const snapshots = await this.mongo.find<StockSnapshot>("stock_snapshots", {}, {
      projection: { stock_id: 1, price: 1, change_1d: 1, market_cap: 1, volume: 1 },
      sort: { market_cap: -1 },
      limit,
    });
    const ids = snapshots.map((s) => s.stock_id);
    if (ids.length === 0) return [];
    const docs = await this.mongo.find<StockDoc>("stocks", { stock_id: { $in: ids } }, {
      projection: { stock_id: 1, symbol: 1, name: 1, slug: 1, logo: 1, sector: 1, industry: 1, country: 1, country_code: 1, currency: 1, native_currency: 1 },
    });
    const byId = new Map(docs.map((d) => [d.stock_id, d]));
    return snapshots.map((snap) => ({ ...snap, stock: byId.get(snap.stock_id) }));
  }

  async getStocks(
    limit: number,
    page: number,
    sector?: string,
    industry?: string,
    search?: string,
    countryCode?: string,
  ): Promise<{ items: Array<StockSnapshot & { stock?: StockDoc }>; total: number }> {
    const stockFilter: Record<string, unknown> = {};
    if (sector) stockFilter.sector = { $regex: `^${this.escapeRegex(sector)}$`, $options: "i" };
    if (industry) stockFilter.industry = { $regex: `^${this.escapeRegex(industry)}$`, $options: "i" };
    if (countryCode) stockFilter.country_code = { $regex: `^${this.escapeRegex(countryCode)}$`, $options: "i" };
    if (search) {
      const q = this.escapeRegex(search);
      stockFilter.$or = [
        { symbol: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ];
    }

    const skip = Math.max(0, (page - 1) * limit);
    const [rows, total] = await Promise.all([
      this.mongo.collection("stocks").aggregate([
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
        { $match: { "snapshot.price": { $type: "number" }, "snapshot.change_1d": { $type: "number" } } },
        { $sort: { "snapshot.market_cap": -1, "snapshot.volume": -1 } },
        {
          $project: {
            stock_id: 1,
            symbol: 1,
            name: 1,
            slug: 1,
            logo: 1,
            sector: 1,
            industry: 1,
            country: 1,
            country_code: 1,
            currency: 1,
            native_currency: 1,
            price: "$snapshot.price",
            change_1d: "$snapshot.change_1d",
            market_cap: "$snapshot.market_cap",
            volume: "$snapshot.volume",
          },
        },
        { $skip: skip },
        { $limit: limit },
      ]).toArray(),
      this.mongo.collection("stocks").aggregate([
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
        { $match: { "snapshot.price": { $type: "number" }, "snapshot.change_1d": { $type: "number" } } },
        { $count: "count" },
      ]).toArray(),
    ]);

    const items = rows.map((row) => ({
      stock_id: String(row.stock_id ?? ""),
      price: Number(row.price ?? 0),
      change_1d: Number(row.change_1d ?? 0),
      market_cap: typeof row.market_cap === "number" ? row.market_cap : undefined,
      volume: typeof row.volume === "number" ? row.volume : undefined,
      stock: {
        stock_id: String(row.stock_id ?? ""),
        symbol: String(row.symbol ?? ""),
        name: String(row.name ?? ""),
        slug: typeof row.slug === "string" ? row.slug : undefined,
        logo: typeof row.logo === "string" ? row.logo : undefined,
        sector: typeof row.sector === "string" ? row.sector : undefined,
        industry: typeof row.industry === "string" ? row.industry : undefined,
        country: typeof row.country === "string" ? row.country : undefined,
        country_code: typeof row.country_code === "string" ? row.country_code : undefined,
          currency: typeof row.currency === "string" ? row.currency : undefined,
          native_currency: typeof row.native_currency === "string" ? row.native_currency : undefined,
      },
    }));

    return { items, total: Number(total[0]?.count ?? 0) };
  }

  async getFilterBuckets(countryCode?: string): Promise<{
    sectors: Array<{ name: string; count: number }>;
    industries: Array<{ name: string; count: number }>;
    countries: Array<{ name: string; code: string }>;
  }> {
    const baseMatch: Record<string, unknown> = {};
    if (countryCode) baseMatch.country_code = { $regex: `^${this.escapeRegex(countryCode)}$`, $options: "i" };
    const [sectorsRaw, industriesRaw, countriesRaw] = await Promise.all([
      this.mongo.collection("stocks").aggregate([
        { $match: { ...baseMatch, sector: { $type: "string", $ne: "" } } },
        { $group: { _id: "$sector", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      this.mongo.collection("stocks").aggregate([
        { $match: { ...baseMatch, industry: { $type: "string", $ne: "" } } },
        { $group: { _id: "$industry", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      this.mongo.collection("stocks").aggregate([
        { $match: { country: { $type: "string", $ne: "" }, country_code: { $type: "string", $ne: "" } } },
        { $group: { _id: { name: "$country", code: "$country_code" } } },
        { $sort: { "_id.code": 1, "_id.name": 1 } },
      ]).toArray(),
    ]);

    return {
      sectors: sectorsRaw.map((x) => ({ name: String(x._id ?? ""), count: Number(x.count ?? 0) })).filter((x) => x.name),
      industries: industriesRaw.map((x) => ({ name: String(x._id ?? ""), count: Number(x.count ?? 0) })).filter((x) => x.name),
      countries: countriesRaw.map((x) => ({ name: String(x._id?.name ?? ""), code: String(x._id?.code ?? "") })).filter((x) => x.name && x.code),
    };
  }

  async getAllCountries(): Promise<Array<{ name: string; code: string }>> {
    const rows = await this.mongo.collection("stocks").aggregate([
      { $match: { country: { $type: "string", $ne: "" }, country_code: { $type: "string", $ne: "" } } },
      { $group: { _id: { name: "$country", code: "$country_code" } } },
      { $sort: { "_id.code": 1, "_id.name": 1 } },
    ]).toArray();
    return rows.map((x) => ({ name: String(x._id?.name ?? ""), code: String(x._id?.code ?? "") })).filter((x) => x.name && x.code);
  }

  async getSectorPerformance(limit: number, countryCode?: string): Promise<Array<{ sector: string; change: number }>> {
    const stockMatch: Record<string, unknown> = { sector: { $type: "string", $ne: "" } };
    if (countryCode) stockMatch.country_code = { $regex: `^${this.escapeRegex(countryCode)}$`, $options: "i" };
    const rows = await this.mongo.collection("stocks").aggregate([
      { $match: stockMatch },
      {
        $lookup: {
          from: "stock_snapshots",
          localField: "stock_id",
          foreignField: "stock_id",
          as: "snapshot",
        },
      },
      { $unwind: "$snapshot" },
      { $match: { "snapshot.change_1d": { $type: "number" } } },
      {
        $group: {
          _id: "$sector",
          avgChange: { $avg: "$snapshot.change_1d" },
        },
      },
      { $sort: { avgChange: -1 } },
      { $limit: limit },
    ]).toArray();

    return rows.map((row) => ({
      sector: String(row._id ?? ""),
      change: typeof row.avgChange === "number" ? row.avgChange : 0,
    }));
  }

  async getIndexCompositeByProname(proname: string): Promise<number> {
    const rows = await this.mongo.collection("stocks").aggregate([
      { $match: { "indexes.proname": proname } },
      { $project: { stock_id: 1 } },
      {
        $lookup: {
          from: "stock_snapshots",
          localField: "stock_id",
          foreignField: "stock_id",
          as: "snapshot",
        },
      },
      { $unwind: "$snapshot" },
      { $match: { "snapshot.market_cap": { $gt: 0 }, "snapshot.change_1d": { $type: "number" } } },
      {
        $group: {
          _id: null,
          totalMarketCap: { $sum: "$snapshot.market_cap" },
          weightedNumerator: { $sum: { $multiply: ["$snapshot.change_1d", "$snapshot.market_cap"] } },
        },
      },
      {
        $project: {
          _id: 0,
          weightedChange: {
            $cond: [
              { $gt: ["$totalMarketCap", 0] },
              { $divide: ["$weightedNumerator", "$totalMarketCap"] },
              0,
            ],
          },
        },
      },
    ]).toArray();
    const change = rows[0]?.weightedChange;
    return typeof change === "number" && Number.isFinite(change) ? change : 0;
  }

  async getLatestStockNews(limit: number): Promise<NewsDoc[]> {
    const stockOnly = await this.mongo.find<NewsDoc & Document>("market_news", { market: { $regex: /stock/i } }, {
      projection: { title: 1, summary: 1, market: 1, published_at: 1, source: 1, url: 1 },
      sort: { published_at: -1 },
      limit,
    });
    if (stockOnly.length > 0) return stockOnly;
    return this.mongo.find<NewsDoc & Document>("market_news", {}, {
      projection: { title: 1, summary: 1, market: 1, published_at: 1, source: 1, url: 1 },
      sort: { published_at: -1 },
      limit,
    });
  }
}
