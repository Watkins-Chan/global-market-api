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
  slug: string;
  logo?: string;
  sector?: string;
  currency?: string;
  native_currency?: string;
};

type CryptoSnapshot = {
  crypto_id: string;
  price: number;
  change_24h: number;
  market_cap?: number;
  volume_24h?: number;
  quote_currency?: string;
  tradingview_scan?: {
    currency?: unknown;
    fundamental_currency_code?: unknown;
    ticker_view?: unknown;
  };
};

type CryptoDoc = {
  crypto_id: string;
  symbol: string;
  name: string;
  slug: string;
  logo?: string;
  currency?: string;
  quote_currency?: string;
};

type CommoditySnapshot = {
  commodity_id: string;
  price: number;
  change_1d: number;
  volume?: number;
  updated_at?: Date;
};

type CommodityDoc = {
  commodity_id: string;
  symbol: string;
  name: string;
  slug: string;
  group?: string;
  logo?: string;
  unit?: string;
  currency?: string;
};

type PreciousSnapshot = {
  brand_id: string;
  metal_type: "gold" | "silver";
  source?: string;
  buy_price?: number;
  sell_price: number;
  spread?: number;
  change_1d: number;
  updated_at?: Date;
};

type PreciousBrand = {
  brand_id: string;
  name: string;
  brand_code: string;
  slug: string;
  logo?: string;
  unit?: string;
  currency?: string;
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

type IndexCompositeRow = {
  weightedChange: number;
  members: number;
  totalMarketCap: number;
};

@Injectable()
export class HomeRepository {
  constructor(private readonly mongo: MongoService) {}

  private async sumField(collection: string, field: string): Promise<number> {
    const rows = await this.mongo.collection(collection).aggregate([{ $group: { _id: null, value: { $sum: `$${field}` } } }]).toArray();
    const n = rows[0]?.value;
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  }

  async countSummaries(): Promise<{
    stocks: number;
    cryptos: number;
    commodities: number;
    precious: number;
    totalStockMarketCap: number;
    totalCryptoMarketCap: number;
  }> {
    const [stocks, cryptos, commodities, precious, totalStockMarketCap, totalCryptoMarketCap] = await Promise.all([
      this.mongo.collection("stock_snapshots").countDocuments({}),
      this.mongo.collection("crypto_snapshots").countDocuments({}),
      this.mongo.collection("commodity_snapshots").countDocuments({}),
      this.mongo.collection("vietnam_gold_snapshots").countDocuments({}),
      this.sumField("stock_snapshots", "market_cap"),
      this.sumField("crypto_snapshots", "market_cap"),
    ]);
    return { stocks, cryptos, commodities, precious, totalStockMarketCap, totalCryptoMarketCap };
  }

  async getTopStockMovers(limit: number, sort: 1 | -1): Promise<Array<StockSnapshot & { stock?: StockDoc }>> {
    const snapshots = await this.mongo.find<StockSnapshot>("stock_snapshots", {}, {
      projection: {
        stock_id: 1,
        price: 1,
        change_1d: 1,
        market_cap: 1,
        volume: 1,
      },
      sort: { change_1d: sort },
      limit,
    });
    const ids = snapshots.map((s) => s.stock_id);
    if (ids.length === 0) return [];
    const stocks = await this.mongo.find<StockDoc>("stocks", { stock_id: { $in: ids } }, {
      projection: { stock_id: 1, symbol: 1, name: 1, slug: 1, logo: 1, sector: 1, currency: 1, native_currency: 1 },
    });
    const byId = new Map(stocks.map((s) => [s.stock_id, s]));
    return snapshots.map((snap) => ({ ...snap, stock: byId.get(snap.stock_id) }));
  }

  async getTopStocksByMarketCap(limit: number): Promise<Array<StockSnapshot & { stock?: StockDoc }>> {
    const snapshots = await this.mongo.find<StockSnapshot>("stock_snapshots", {}, {
      projection: { stock_id: 1, price: 1, change_1d: 1, market_cap: 1, volume: 1 },
      sort: { market_cap: -1 },
      limit,
    });
    const ids = snapshots.map((s) => s.stock_id);
    if (ids.length === 0) return [];
    const docs = await this.mongo.find<StockDoc>("stocks", { stock_id: { $in: ids } }, {
      projection: { stock_id: 1, symbol: 1, name: 1, slug: 1, logo: 1, sector: 1, currency: 1, native_currency: 1 },
    });
    const byId = new Map(docs.map((d) => [d.stock_id, d]));
    return snapshots.map((snap) => ({ ...snap, stock: byId.get(snap.stock_id) }));
  }

  async getTopCryptos(limit: number): Promise<Array<CryptoSnapshot & { crypto?: CryptoDoc }>> {
    const snapshots = await this.mongo.find<CryptoSnapshot>("crypto_snapshots", {}, {
      projection: {
        crypto_id: 1,
        price: 1,
        change_24h: 1,
        market_cap: 1,
        volume_24h: 1,
        quote_currency: 1,
        "tradingview_scan.currency": 1,
        "tradingview_scan.fundamental_currency_code": 1,
        "tradingview_scan.ticker_view": 1,
      },
      sort: { market_cap: -1 },
      limit,
    });
    const ids = snapshots.map((s) => s.crypto_id);
    if (ids.length === 0) return [];
    const docs = await this.mongo.find<CryptoDoc>("cryptos", { crypto_id: { $in: ids } }, {
      projection: { crypto_id: 1, symbol: 1, name: 1, slug: 1, logo: 1, currency: 1, quote_currency: 1 },
    });
    const byId = new Map(docs.map((d) => [d.crypto_id, d]));
    return snapshots.map((snap) => ({ ...snap, crypto: byId.get(snap.crypto_id) }));
  }

  async getTopCryptoMovers(limit: number, sort: 1 | -1): Promise<Array<CryptoSnapshot & { crypto?: CryptoDoc }>> {
    const snapshots = await this.mongo.find<CryptoSnapshot>("crypto_snapshots", {}, {
      projection: { crypto_id: 1, price: 1, change_24h: 1, market_cap: 1, volume_24h: 1, quote_currency: 1, "tradingview_scan.currency": 1, "tradingview_scan.fundamental_currency_code": 1, "tradingview_scan.ticker_view": 1 },
      sort: { change_24h: sort },
      limit,
    });
    const ids = snapshots.map((s) => s.crypto_id);
    if (ids.length === 0) return [];
    const docs = await this.mongo.find<CryptoDoc>("cryptos", { crypto_id: { $in: ids } }, {
      projection: { crypto_id: 1, symbol: 1, name: 1, slug: 1, logo: 1, currency: 1, quote_currency: 1 },
    });
    const byId = new Map(docs.map((d) => [d.crypto_id, d]));
    return snapshots.map((snap) => ({ ...snap, crypto: byId.get(snap.crypto_id) }));
  }

  async getTopCommodities(limit: number): Promise<Array<CommoditySnapshot & { commodity?: CommodityDoc }>> {
    const snapshots = await this.mongo.find<CommoditySnapshot>("commodity_snapshots", {}, {
      projection: { commodity_id: 1, price: 1, change_1d: 1, volume: 1 },
      sort: { volume: -1, change_1d: -1 },
      limit,
    });
    const ids = snapshots.map((s) => s.commodity_id);
    if (ids.length === 0) return [];
    const docs = await this.mongo.find<CommodityDoc>("commodities", { commodity_id: { $in: ids } }, {
      projection: { commodity_id: 1, symbol: 1, name: 1, slug: 1, group: 1, logo: 1, unit: 1, currency: 1 },
    });
    const byId = new Map(docs.map((d) => [d.commodity_id, d]));
    return snapshots.map((snap) => ({ ...snap, commodity: byId.get(snap.commodity_id) }));
  }

  async getTopCommodityMovers(limit: number, sort: 1 | -1): Promise<Array<CommoditySnapshot & { commodity?: CommodityDoc }>> {
    const snapshots = await this.mongo.find<CommoditySnapshot>("commodity_snapshots", {}, {
      projection: { commodity_id: 1, price: 1, change_1d: 1, volume: 1, updated_at: 1 },
      sort: { change_1d: sort },
      limit,
    });
    const ids = snapshots.map((s) => s.commodity_id);
    if (ids.length === 0) return [];
    const docs = await this.mongo.find<CommodityDoc>("commodities", { commodity_id: { $in: ids } }, {
      projection: { commodity_id: 1, symbol: 1, name: 1, slug: 1, group: 1, logo: 1, unit: 1, currency: 1 },
    });
    const byId = new Map(docs.map((d) => [d.commodity_id, d]));
    return snapshots.map((snap) => ({ ...snap, commodity: byId.get(snap.commodity_id) }));
  }

  async getPrecious(limit: number): Promise<Array<PreciousSnapshot & { brand?: PreciousBrand }>> {
    const snapshots = await this.mongo.find<PreciousSnapshot>("vietnam_gold_snapshots", {}, {
      projection: {
        brand_id: 1,
        metal_type: 1,
        source: 1,
        buy_price: 1,
        sell_price: 1,
        spread: 1,
        change_1d: 1,
        updated_at: 1,
      },
      sort: { updated_at: -1 },
      limit,
    });
    const ids = snapshots.map((s) => s.brand_id);
    if (ids.length === 0) return [];
    const brands = await this.mongo.find<PreciousBrand>("vietnam_gold_brands", { brand_id: { $in: ids } }, {
      projection: { brand_id: 1, name: 1, brand_code: 1, slug: 1, logo: 1, unit: 1, currency: 1 },
    });
    const byId = new Map(brands.map((d) => [d.brand_id, d]));
    return snapshots.map((snap) => ({ ...snap, brand: byId.get(snap.brand_id) }));
  }

  async getPreciousMovers(limit: number, sort: 1 | -1): Promise<Array<PreciousSnapshot & { brand?: PreciousBrand }>> {
    const snapshots = await this.mongo.find<PreciousSnapshot>("vietnam_gold_snapshots", {}, {
      projection: { brand_id: 1, metal_type: 1, source: 1, buy_price: 1, sell_price: 1, spread: 1, change_1d: 1, updated_at: 1 },
      sort: { change_1d: sort, updated_at: -1 },
      limit,
    });
    const ids = snapshots.map((s) => s.brand_id);
    if (ids.length === 0) return [];
    const brands = await this.mongo.find<PreciousBrand>("vietnam_gold_brands", { brand_id: { $in: ids } }, {
      projection: { brand_id: 1, name: 1, brand_code: 1, slug: 1, logo: 1, unit: 1, currency: 1 },
    });
    const byId = new Map(brands.map((d) => [d.brand_id, d]));
    return snapshots.map((snap) => ({ ...snap, brand: byId.get(snap.brand_id) }));
  }

  async getSparklineMap(
    collection: string,
    idField: string,
    priceField: string,
    ids: string[],
    points: number,
  ): Promise<Map<string, number[]>> {
    const out = new Map<string, number[]>();
    if (ids.length === 0) return out;

    const docs = await this.mongo.collection(collection).find(
      { [idField]: { $in: ids } },
      {
        projection: { [idField]: 1, [priceField]: 1, timestamp: 1, updated_at: 1 },
        sort: { timestamp: -1, updated_at: -1 },
      },
    ).toArray();

    for (const raw of docs) {
      const id = raw[idField] as string | undefined;
      const price = raw[priceField] as number | undefined;
      if (!id || typeof price !== "number" || !Number.isFinite(price)) continue;
      const arr = out.get(id) ?? [];
      if (arr.length < points) {
        arr.push(price);
        out.set(id, arr);
      }
    }

    for (const [id, arr] of out.entries()) {
      out.set(id, [...arr].reverse());
    }
    return out;
  }

  async getLatestNews(limit: number): Promise<NewsDoc[]> {
    return this.mongo.find<NewsDoc & Document>("market_news", {}, {
      projection: {
        title: 1,
        summary: 1,
        market: 1,
        published_at: 1,
        source: 1,
        url: 1,
      },
      sort: { published_at: -1 },
      limit,
    });
  }

  async getStockBySymbol(symbol: string): Promise<StockDoc | null> {
    return this.mongo.collection<StockDoc>("stocks").findOne({ symbol }, { projection: { stock_id: 1, symbol: 1, name: 1, slug: 1, logo: 1, sector: 1, currency: 1, native_currency: 1 } });
  }

  async getStockSnapshotById(stockId: string): Promise<StockSnapshot | null> {
    return this.mongo.collection<StockSnapshot>("stock_snapshots").findOne(
      { stock_id: stockId },
      { projection: { stock_id: 1, price: 1, change_1d: 1, market_cap: 1, volume: 1 } },
    );
  }

  async getCryptoBySymbol(symbol: string): Promise<CryptoDoc | null> {
    return this.mongo.collection<CryptoDoc>("cryptos").findOne({ symbol }, { projection: { crypto_id: 1, symbol: 1, name: 1, slug: 1, logo: 1, currency: 1, quote_currency: 1 } });
  }

  async getCryptoSnapshotById(cryptoId: string): Promise<CryptoSnapshot | null> {
    return this.mongo.collection<CryptoSnapshot>("crypto_snapshots").findOne(
      { crypto_id: cryptoId },
      { projection: { crypto_id: 1, price: 1, change_24h: 1, market_cap: 1, volume_24h: 1, quote_currency: 1, "tradingview_scan.currency": 1, "tradingview_scan.fundamental_currency_code": 1, "tradingview_scan.ticker_view": 1 } },
    );
  }

  async getCommodityBySlug(slug: string): Promise<CommodityDoc | null> {
    return this.mongo.collection<CommodityDoc>("commodities").findOne(
      { slug },
      { projection: { commodity_id: 1, symbol: 1, name: 1, slug: 1, group: 1, logo: 1, unit: 1, currency: 1 } },
    );
  }

  async getCommoditiesBySlugs(slugs: string[]): Promise<CommodityDoc[]> {
    if (slugs.length === 0) return [];
    return this.mongo.find<CommodityDoc>("commodities", { slug: { $in: slugs } }, {
      projection: { commodity_id: 1, symbol: 1, name: 1, slug: 1, group: 1, logo: 1, unit: 1, currency: 1 },
    });
  }

  async getPreciousGold(limit: number): Promise<Array<PreciousSnapshot & { brand?: PreciousBrand }>> {
    const snapshots = await this.mongo.find<PreciousSnapshot>("vietnam_gold_snapshots", { metal_type: "gold" }, {
      projection: { brand_id: 1, metal_type: 1, source: 1, buy_price: 1, sell_price: 1, spread: 1, change_1d: 1, updated_at: 1 },
      sort: { updated_at: -1 },
      limit,
    });
    const ids = snapshots.map((s) => s.brand_id);
    if (ids.length === 0) return [];
    const brands = await this.mongo.find<PreciousBrand>("vietnam_gold_brands", { brand_id: { $in: ids } }, {
      projection: { brand_id: 1, name: 1, brand_code: 1, slug: 1, logo: 1, unit: 1, currency: 1 },
    });
    const byId = new Map(brands.map((d) => [d.brand_id, d]));
    return snapshots.map((snap) => ({ ...snap, brand: byId.get(snap.brand_id) }));
  }

  async getCommoditySnapshotById(commodityId: string): Promise<CommoditySnapshot | null> {
    return this.mongo.collection<CommoditySnapshot>("commodity_snapshots").findOne(
      { commodity_id: commodityId },
      { projection: { commodity_id: 1, price: 1, change_1d: 1, volume: 1, updated_at: 1 } },
    );
  }

  async getLatestPreciousByBrandCode(brandCode: string): Promise<(PreciousSnapshot & { brand?: PreciousBrand }) | null> {
    const brand = await this.mongo.collection<PreciousBrand>("vietnam_gold_brands").findOne(
      { brand_code: brandCode },
      { projection: { brand_id: 1, name: 1, brand_code: 1, slug: 1, logo: 1, unit: 1, currency: 1 } },
    );
    if (!brand) return null;

    const snapshot = await this.mongo.collection<PreciousSnapshot>("vietnam_gold_snapshots").findOne(
      { brand_id: brand.brand_id, metal_type: "gold" },
      { projection: { brand_id: 1, metal_type: 1, source: 1, buy_price: 1, sell_price: 1, spread: 1, change_1d: 1, updated_at: 1 }, sort: { updated_at: -1 } },
    );
    if (!snapshot) return null;
    return { ...snapshot, brand };
  }

  async getLatestPreciousGold(): Promise<(PreciousSnapshot & { brand?: PreciousBrand }) | null> {
    const snapshot = await this.mongo.collection<PreciousSnapshot>("vietnam_gold_snapshots").findOne(
      { metal_type: "gold" },
      { projection: { brand_id: 1, metal_type: 1, source: 1, buy_price: 1, sell_price: 1, spread: 1, change_1d: 1, updated_at: 1 }, sort: { updated_at: -1 } },
    );
    if (!snapshot) return null;
    const brand = await this.mongo.collection<PreciousBrand>("vietnam_gold_brands").findOne(
      { brand_id: snapshot.brand_id },
      { projection: { brand_id: 1, name: 1, brand_code: 1, slug: 1, logo: 1, unit: 1, currency: 1 } },
    );
    return { ...snapshot, brand: brand ?? undefined };
  }

  async getIndexCompositeByProname(proname: string): Promise<IndexCompositeRow> {
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
          members: { $sum: 1 },
          totalMarketCap: { $sum: "$snapshot.market_cap" },
          weightedNumerator: { $sum: { $multiply: ["$snapshot.change_1d", "$snapshot.market_cap"] } },
        },
      },
      {
        $project: {
          _id: 0,
          members: 1,
          totalMarketCap: 1,
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

    const row = rows[0] as IndexCompositeRow | undefined;
    if (!row) return { weightedChange: 0, members: 0, totalMarketCap: 0 };
    return row;
  }
}
