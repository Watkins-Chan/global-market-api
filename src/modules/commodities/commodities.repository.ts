import { Injectable } from "@nestjs/common";
import { MongoService } from "../../infrastructure/database/mongo.service";

type CommodityRow = {
  commodity_id: string;
  symbol: string;
  name: string;
  slug?: string;
  group?: string;
  unit?: string;
  price: number;
  change_1d: number;
  change_1w?: number;
  change_1m?: number;
  change_ytd?: number;
  volume?: number;
  sparkline_7d?: number[];
};

@Injectable()
export class CommoditiesRepository {
  constructor(private readonly mongo: MongoService) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async getOverviewByGroup(limitGroups = 12): Promise<CommodityRow[]> {
    const rows = await this.mongo.collection("commodities").aggregate([
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
      { $match: { "snapshot.price": { $type: "number" }, "snapshot.change_1d": { $type: "number" }, group: { $type: "string", $ne: "" } } },
      {
        $project: {
          commodity_id: 1,
          symbol: 1,
          name: 1,
          slug: 1,
          group: 1,
          unit: 1,
          price: "$snapshot.price",
          change_1d: "$snapshot.change_1d",
          change_1w: "$snapshot.change_1w",
          change_1m: "$snapshot.change_1m",
          change_ytd: "$snapshot.change_ytd",
          volume: "$snapshot.volume",
          sparkline_7d: "$snapshot.sparkline_7d",
          _sortPrice: { $ifNull: ["$snapshot.price", 0] },
        },
      },
      { $sort: { group: 1, _sortPrice: -1, volume: -1 } },
      {
        $group: {
          _id: "$group",
          item: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$item" } },
      { $sort: { group: 1 } },
      { $limit: limitGroups },
    ]).toArray();
    return rows.map((x) => x as CommodityRow);
  }

  async getTopMovers(limit: number, sort: 1 | -1): Promise<CommodityRow[]> {
    const rows = await this.mongo.collection("commodities").aggregate([
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
      { $sort: { "snapshot.change_1d": sort, "snapshot.volume": -1 } },
      { $limit: limit },
      {
        $project: {
          commodity_id: 1,
          symbol: 1,
          name: 1,
          slug: 1,
          group: 1,
          unit: 1,
          price: "$snapshot.price",
          change_1d: "$snapshot.change_1d",
          change_1w: "$snapshot.change_1w",
          change_1m: "$snapshot.change_1m",
          change_ytd: "$snapshot.change_ytd",
          volume: "$snapshot.volume",
          sparkline_7d: "$snapshot.sparkline_7d",
        },
      },
    ]).toArray();
    return rows.map((x) => x as CommodityRow);
  }

  async getCommodities(
    limit: number,
    page: number,
    group?: string,
    search?: string,
    sortBy: "price" | "day" | "week" | "month" | "ytd" | "volume" = "day",
    sortDir: "asc" | "desc" = "desc",
  ): Promise<{ items: CommodityRow[]; total: number }> {
    const baseFilter: Record<string, unknown> = {};
    if (group && group !== "all") baseFilter.group = { $regex: `^${this.escapeRegex(group)}$`, $options: "i" };
    if (search) {
      const q = this.escapeRegex(search);
      baseFilter.$or = [{ symbol: { $regex: q, $options: "i" } }, { name: { $regex: q, $options: "i" } }];
    }

    const sortMap: Record<string, string> = {
      price: "_sortPrice",
      day: "_sortDay",
      week: "_sortWeek",
      month: "_sortMonth",
      ytd: "_sortYtd",
      volume: "_sortVolume",
    };
    const sortField = sortMap[sortBy] ?? "_sortDay";
    const sortOrder = sortDir === "asc" ? 1 : -1;
    const skip = Math.max(0, (page - 1) * limit);

    const [rows, total] = await Promise.all([
      this.mongo.collection("commodities").aggregate([
        { $match: baseFilter },
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
            _sortPrice: { $ifNull: ["$snapshot.price", 0] },
            _sortDay: { $ifNull: ["$snapshot.change_1d", 0] },
            _sortWeek: { $ifNull: ["$snapshot.change_1w", 0] },
            _sortMonth: { $ifNull: ["$snapshot.change_1m", 0] },
            _sortYtd: { $ifNull: ["$snapshot.change_ytd", 0] },
            _sortVolume: { $ifNull: ["$snapshot.volume", 0] },
          },
        },
        { $sort: { [sortField]: sortOrder, _sortVolume: -1, name: 1 } },
        {
          $project: {
            commodity_id: 1,
            symbol: 1,
            name: 1,
            slug: 1,
            group: 1,
            unit: 1,
            price: "$snapshot.price",
            change_1d: "$snapshot.change_1d",
            change_1w: "$snapshot.change_1w",
            change_1m: "$snapshot.change_1m",
            change_ytd: "$snapshot.change_ytd",
            volume: "$snapshot.volume",
            sparkline_7d: "$snapshot.sparkline_7d",
          },
        },
        { $skip: skip },
        { $limit: limit },
      ]).toArray(),
      this.mongo.collection("commodities").aggregate([
        { $match: baseFilter },
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
        { $count: "count" },
      ]).toArray(),
    ]);

    return { items: rows.map((x) => x as CommodityRow), total: Number(total[0]?.count ?? 0) };
  }

  async getGroupBuckets(): Promise<Array<{ name: string; count: number }>> {
    const rows = await this.mongo.collection("commodities").aggregate([
      { $match: { group: { $type: "string", $ne: "" } } },
      { $group: { _id: "$group", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();
    return rows.map((x) => ({ name: String(x._id ?? ""), count: Number(x.count ?? 0) })).filter((x) => x.name);
  }

  async getGroupLeaders(perGroup = 3): Promise<Array<{ group: string; count: number; leaders: CommodityRow[] }>> {
    const rows = await this.mongo.collection("commodities").aggregate([
      { $match: { group: { $type: "string", $ne: "" } } },
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
        $project: {
          commodity_id: 1,
          symbol: 1,
          name: 1,
          slug: 1,
          group: 1,
          unit: 1,
          price: "$snapshot.price",
          change_1d: "$snapshot.change_1d",
          change_1w: "$snapshot.change_1w",
          change_1m: "$snapshot.change_1m",
          change_ytd: "$snapshot.change_ytd",
          volume: "$snapshot.volume",
          sparkline_7d: "$snapshot.sparkline_7d",
        },
      },
      { $sort: { group: 1, volume: -1, name: 1 } },
      {
        $group: {
          _id: "$group",
          count: { $sum: 1 },
          leaders: { $push: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 0,
          group: "$_id",
          count: 1,
          leaders: { $slice: ["$leaders", perGroup] },
        },
      },
      { $sort: { group: 1 } },
    ]).toArray();

    return rows.map((x) => ({
      group: String(x.group ?? ""),
      count: Number(x.count ?? 0),
      leaders: Array.isArray(x.leaders) ? (x.leaders as CommodityRow[]) : [],
    })).filter((x) => x.group);
  }
}
