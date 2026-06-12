import { Injectable } from "@nestjs/common";
import { MongoService } from "../../infrastructure/database/mongo.service";

export type VietnamGoldRow = {
  brand_id: string;
  brand_code: string;
  name: string;
  slug?: string;
  unit?: string;
  metal_type: "gold" | "silver";
  buy_price: number;
  sell_price: number;
  spread: number;
  change_1d: number;
  change_1w?: number;
  change_1m?: number;
  change_ytd?: number;
  premium_vs_global?: number | null;
  converted_vnd_per_luong?: number | null;
  global_gold_price_usd_oz?: number | null;
  sparkline_7d?: number[];
};

@Injectable()
export class VietnamGoldRepository {
  constructor(private readonly mongo: MongoService) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private brandSnapshotLookup() {
    return {
      $lookup: {
        from: "vietnam_gold_snapshots",
        let: { bid: "$brand_id", metal: "$metal_type" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$brand_id", "$$bid"] },
                  { $eq: ["$metal_type", "$$metal"] },
                ],
              },
            },
          },
          { $sort: { updated_at: -1, _id: -1 } },
          { $limit: 1 },
        ],
        as: "snapshot",
      },
    };
  }

  private projectRow() {
    return {
      $project: {
        brand_id: 1,
        brand_code: 1,
        name: 1,
        slug: 1,
        unit: 1,
        metal_type: 1,
        buy_price: "$snapshot.buy_price",
        sell_price: "$snapshot.sell_price",
        spread: "$snapshot.spread",
        change_1d: "$snapshot.change_1d",
        change_1w: "$snapshot.change_1w",
        change_1m: "$snapshot.change_1m",
        change_ytd: "$snapshot.change_ytd",
        premium_vs_global: "$snapshot.premium_vs_global",
        converted_vnd_per_luong: "$snapshot.converted_vnd_per_luong",
        global_gold_price_usd_oz: "$snapshot.global_gold_price_usd_oz",
        sparkline_7d: "$snapshot.sparkline_7d",
      },
    };
  }

  private baseMatch(metalType?: "gold" | "silver") {
    const match: Record<string, unknown> = {
      is_active: { $ne: false },
      "snapshot.sell_price": { $type: "number" },
      "snapshot.change_1d": { $type: "number" },
    };
    if (metalType) match.metal_type = metalType;
    return match;
  }

  async getLatestGlobalReference(): Promise<{
    globalGoldUsdOz: number | null;
    convertedVndPerLuong: number | null;
    usdVndRate: number | null;
    globalChange24h?: number | null;
  }> {
    const snap = await this.mongo.collection("vietnam_gold_snapshots").findOne(
      {
        global_gold_price_usd_oz: { $type: "number", $gt: 0 },
        converted_vnd_per_luong: { $type: "number", $gt: 0 },
      },
      {
        sort: { updated_at: -1 },
        projection: {
          global_gold_price_usd_oz: 1,
          converted_vnd_per_luong: 1,
        },
      },
    );

    const globalGoldUsdOz = typeof snap?.global_gold_price_usd_oz === "number" ? snap.global_gold_price_usd_oz : null;
    const convertedVndPerLuong = typeof snap?.converted_vnd_per_luong === "number" ? snap.converted_vnd_per_luong : null;

    let usdVndRate: number | null = null;
    if (globalGoldUsdOz && convertedVndPerLuong) {
      const luongPerOz = 37.5 / 31.1035;
      usdVndRate = convertedVndPerLuong / (globalGoldUsdOz * luongPerOz);
    }

    const goldDoc = await this.mongo.collection("commodities").findOne(
      { slug: "xauusd-cur" },
      { projection: { commodity_id: 1 } },
    );
    let globalChange24h: number | null = null;
    let resolvedGlobal = globalGoldUsdOz;

    if (goldDoc?.commodity_id) {
      const commoditySnap = await this.mongo.collection("commodity_snapshots").findOne(
        { commodity_id: goldDoc.commodity_id },
        { sort: { updated_at: -1 }, projection: { price: 1, change_1d: 1 } },
      );
      if (typeof commoditySnap?.price === "number") resolvedGlobal = commoditySnap.price;
      if (typeof commoditySnap?.change_1d === "number") globalChange24h = commoditySnap.change_1d;
    }

    return {
      globalGoldUsdOz: resolvedGlobal,
      convertedVndPerLuong,
      usdVndRate,
      globalChange24h,
    };
  }

  /** Latest global quote (USD/oz) for a commodity slug, e.g. "xagusd-cur" for silver. */
  async getGlobalCommodityQuote(slug: string): Promise<{ price: number | null; change24h: number | null }> {
    const doc = await this.mongo.collection("commodities").findOne(
      { slug },
      { projection: { commodity_id: 1 } },
    );
    if (!doc?.commodity_id) return { price: null, change24h: null };
    const snap = await this.mongo.collection("commodity_snapshots").findOne(
      { commodity_id: doc.commodity_id },
      { sort: { updated_at: -1 }, projection: { price: 1, change_1d: 1 } },
    );
    return {
      price: typeof snap?.price === "number" ? snap.price : null,
      change24h: typeof snap?.change_1d === "number" ? snap.change_1d : null,
    };
  }

  async getBrandByCode(brandCode: string, metalType: "gold" | "silver" = "gold"): Promise<VietnamGoldRow | null> {
    const codeRegex = new RegExp(brandCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const rows = await this.mongo.collection("vietnam_gold_brands").aggregate([
      {
        $match: {
          metal_type: metalType,
          is_active: { $ne: false },
          $or: [{ brand_code: codeRegex }, { name: codeRegex }],
        },
      },
      this.brandSnapshotLookup(),
      { $unwind: "$snapshot" },
      this.projectRow(),
      { $limit: 1 },
    ]).toArray();
    return rows[0] ? (rows[0] as VietnamGoldRow) : null;
  }

  async getFeaturedBrands(limit: number, metalType: "gold" | "silver" = "gold"): Promise<VietnamGoldRow[]> {
    const rows = await this.mongo.collection("vietnam_gold_brands").aggregate([
      { $match: { metal_type: metalType, is_active: { $ne: false } } },
      this.brandSnapshotLookup(),
      { $unwind: "$snapshot" },
      { $match: this.baseMatch(metalType) },
      this.projectRow(),
      { $sort: { sell_price: -1, change_1d: -1 } },
      { $limit: Math.max(limit, 20) },
    ]).toArray();

    const preferred = ["SJC", "DOJI", "PNJ"];
    const list = rows as VietnamGoldRow[];
    const picked: VietnamGoldRow[] = [];
    for (const code of preferred) {
      const row = list.find((x) => `${x.brand_code} ${x.name}`.toUpperCase().includes(code));
      if (row && !picked.some((p) => p.brand_id === row.brand_id)) picked.push(row);
    }
    for (const row of list) {
      if (picked.length >= limit) break;
      if (!picked.some((p) => p.brand_id === row.brand_id)) picked.push(row);
    }
    return picked.slice(0, limit);
  }

  async getTopMovers(limit: number, sort: 1 | -1, metalType: "gold" | "silver" = "gold"): Promise<VietnamGoldRow[]> {
    const rows = await this.mongo.collection("vietnam_gold_brands").aggregate([
      { $match: { metal_type: metalType, is_active: { $ne: false } } },
      this.brandSnapshotLookup(),
      { $unwind: "$snapshot" },
      { $match: this.baseMatch(metalType) },
      { $sort: { "snapshot.change_1d": sort, "snapshot.sell_price": -1 } },
      { $limit: limit },
      this.projectRow(),
    ]).toArray();
    return rows.map((x) => x as VietnamGoldRow);
  }

  async getBrands(
    limit: number,
    page: number,
    metalType?: "gold" | "silver",
    search?: string,
    sortBy: "sell" | "buy" | "spread" | "day" | "week" | "month" | "premium" = "sell",
    sortDir: "asc" | "desc" = "desc",
  ): Promise<{ items: VietnamGoldRow[]; total: number }> {
    const sortFieldMap: Record<string, string> = {
      sell: "sell_price",
      buy: "buy_price",
      spread: "spread",
      day: "change_1d",
      week: "change_1w",
      month: "change_1m",
      premium: "premium_vs_global",
    };
    const sortField = sortFieldMap[sortBy] ?? "sell_price";
    const direction = sortDir === "asc" ? 1 : -1;

    const pipeline: Record<string, unknown>[] = [
      { $match: { is_active: { $ne: false }, ...(metalType ? { metal_type: metalType } : {}) } },
      this.brandSnapshotLookup(),
      { $unwind: "$snapshot" },
      { $match: this.baseMatch(metalType) },
      this.projectRow(),
    ];

    if (search?.trim()) {
      const regex = new RegExp(this.escapeRegex(search.trim()), "i");
      pipeline.push({
        $match: {
          $or: [
            { name: regex },
            { brand_code: regex },
            { slug: regex },
          ],
        },
      });
    }

    const countPipeline = [...pipeline, { $count: "total" }];
    const dataPipeline = [
      ...pipeline,
      { $sort: { [sortField]: direction, sell_price: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const [countRows, items] = await Promise.all([
      this.mongo.collection("vietnam_gold_brands").aggregate(countPipeline).toArray(),
      this.mongo.collection("vietnam_gold_brands").aggregate(dataPipeline).toArray(),
    ]);

    return {
      items: items.map((x) => x as VietnamGoldRow),
      total: (countRows[0] as { total?: number } | undefined)?.total ?? 0,
    };
  }

  async getGroupLeaders(limitPerGroup: number): Promise<Array<{ group: string; count: number; leaders: VietnamGoldRow[] }>> {
    const rows = await this.mongo.collection("vietnam_gold_brands").aggregate([
      { $match: { is_active: { $ne: false } } },
      this.brandSnapshotLookup(),
      { $unwind: "$snapshot" },
      { $match: { "snapshot.sell_price": { $type: "number" } } },
      this.projectRow(),
      { $sort: { metal_type: 1, sell_price: -1 } },
      {
        $group: {
          _id: "$metal_type",
          count: { $sum: 1 },
          leaders: { $push: "$$ROOT" },
        },
      },
      {
        $project: {
          group: "$_id",
          count: 1,
          leaders: { $slice: ["$leaders", limitPerGroup] },
        },
      },
      { $sort: { group: 1 } },
    ]).toArray();

    return rows.map((row) => ({
      group: String((row as { group?: string }).group ?? "gold"),
      count: Number((row as { count?: number }).count ?? 0),
      leaders: ((row as { leaders?: VietnamGoldRow[] }).leaders ?? []),
    }));
  }
}
