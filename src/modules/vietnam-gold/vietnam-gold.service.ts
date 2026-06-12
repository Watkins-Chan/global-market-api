import { Injectable } from "@nestjs/common";
import { VietnamGoldQueryDto } from "./dto/vietnam-gold-query.dto";
import { VietnamGoldRepository, VietnamGoldRow } from "./vietnam-gold.repository";
import {
  VietnamGoldAssetsResponse,
  VietnamGoldBrandItem,
  VietnamGoldGroupsResponse,
  VietnamGoldOverviewResponse,
  VietnamGoldTopMoversResponse,
} from "./vietnam-gold.types";

const TROY_OZ_GRAMS = 31.1035;
const LUONG_GRAMS = 37.5;
const LUONG_PER_OZ = LUONG_GRAMS / TROY_OZ_GRAMS;
const DEFAULT_USD_VND = 25_450;

@Injectable()
export class VietnamGoldService {
  constructor(private readonly repo: VietnamGoldRepository) {}

  private round2(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  private toMillions(value: number): number {
    return value / 1_000_000;
  }

  private formatMillionsVndShort(value: number): string {
    return `${this.toMillions(value).toFixed(1)}M VND`;
  }

  private formatMillionsWithUnit(value: number, unit: string): string {
    return `${this.toMillions(value).toFixed(1)}M ${unit}`;
  }

  private formatUsdOz(value: number, fractionDigits = 0): string {
    return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: fractionDigits }).format(value)}/oz`;
  }

  private compactSymbol(row: VietnamGoldRow): string {
    const raw = (row.brand_code ?? "").trim();
    if (raw.includes(":")) return raw.split(":")[0]?.trim() || raw;
    const combined = `${row.brand_code ?? ""} ${row.name ?? ""}`.toLowerCase();
    if (combined.includes("sjc")) return "SJC";
    if (combined.includes("doji")) return "DOJI";
    if (combined.includes("pnj")) return "PNJ";
    if (combined.includes("phú quý") || combined.includes("phu quy") || raw.startsWith("PQS")) return "PQS";
    // Crawler-generated codes look like "BRAND_LONG_SLUG"; keep only the brand prefix.
    if (raw.includes("_")) return raw.split("_")[0]?.trim() || raw;
    return raw || row.brand_id;
  }

  /** Title-case ALL-CAPS crawler names, e.g. "BẠC THỎI PHÚ QUÝ 999 1KILO" -> "Bạc Thỏi Phú Quý 999 1Kilo". */
  private prettifyName(name: string): string {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return trimmed;
    const letters = trimmed.replace(/[^\p{L}]/gu, "");
    if (!letters || letters !== letters.toLocaleUpperCase("vi-VN")) return trimmed;
    const brandAcronyms = new Set(["SJC", "DOJI", "PNJ", "PQS", "BTMC", "AJC", "VBĐQ"]);
    return trimmed
      .toLocaleLowerCase("vi-VN")
      .replace(/\p{L}+/gu, (word) => {
        const upper = word.toLocaleUpperCase("vi-VN");
        if (brandAcronyms.has(upper)) return upper;
        return word.charAt(0).toLocaleUpperCase("vi-VN") + word.slice(1);
      });
  }

  private unitLabel(unit?: string): string {
    const raw = (unit ?? "VND/luong").trim();
    if (raw.toLowerCase().includes("luong") || raw.toLowerCase().includes("lượng") || raw.toLowerCase().includes("tael")) {
      return "VND/tael";
    }
    if (raw.toLowerCase().includes("kg")) return "VND/kg";
    return raw;
  }

  private toItem(row: VietnamGoldRow): VietnamGoldBrandItem {
    const buyPrice = Number.isFinite(row.buy_price) ? row.buy_price : row.sell_price;
    const spread = Number.isFinite(row.spread) ? row.spread : Math.max(0, row.sell_price - buyPrice);
    const premium = row.premium_vs_global ?? null;
    const unit = this.unitLabel(row.unit);
    const sellFormatted = this.formatMillionsWithUnit(row.sell_price, unit);

    return {
      id: row.brand_id,
      brandCode: row.brand_code,
      symbol: this.compactSymbol(row),
      name: this.prettifyName(row.name),
      slug: row.slug ?? row.brand_id,
      unit,
      buyPrice,
      sellPrice: row.sell_price,
      spread,
      buyPriceFormatted: this.formatMillionsVndShort(buyPrice),
      sellPriceFormatted: sellFormatted,
      spreadFormatted: this.formatMillionsVndShort(spread),
      change24h: this.round2(row.change_1d),
      weekChange: this.round2(row.change_1w ?? 0),
      monthChange: this.round2(row.change_1m ?? 0),
      ytdChange: this.round2(row.change_ytd ?? 0),
      premiumVnd: premium ?? undefined,
      premiumFormatted: premium != null ? `+${this.formatMillionsVndShort(Math.abs(premium))}` : undefined,
      sparkline: row.sparkline_7d?.length
        ? row.sparkline_7d
        : [row.sell_price, row.sell_price, row.sell_price, row.sell_price, row.sell_price, row.sell_price, row.sell_price],
    };
  }

  private resolveConversion(
    globalRef: Awaited<ReturnType<VietnamGoldRepository["getLatestGlobalReference"]>>,
    sjcRow: VietnamGoldRow | null,
    xauChange?: number,
  ) {
    const globalPriceUsdOz = globalRef.globalGoldUsdOz ?? 0;
    const usdVndRate = globalRef.usdVndRate && Number.isFinite(globalRef.usdVndRate)
      ? globalRef.usdVndRate
      : DEFAULT_USD_VND;
    const equivalentVndPerLuong = globalRef.convertedVndPerLuong && globalRef.convertedVndPerLuong > 0
      ? globalRef.convertedVndPerLuong
      : globalPriceUsdOz * usdVndRate * LUONG_PER_OZ;
    const sjcSell = sjcRow?.sell_price ?? 0;
    const premiumVnd = sjcSell > 0 ? sjcSell - equivalentVndPerLuong : 0;

    return {
      globalPriceUsdOz,
      globalChange24h: this.round2(xauChange ?? 0),
      usdVndRate,
      equivalentVndPerLuong,
      sjcSellVndPerLuong: sjcSell,
      premiumVnd,
      luongPerOz: LUONG_PER_OZ,
    };
  }

  async getOverview(query?: VietnamGoldQueryDto): Promise<VietnamGoldOverviewResponse> {
    if (query?.metalType === "silver") return this.getSilverOverview();
    const [globalRef, sjcRow] = await Promise.all([
      this.repo.getLatestGlobalReference(),
      this.repo.getBrandByCode("SJC", "gold"),
    ]);

    const conversion = this.resolveConversion(
      globalRef,
      sjcRow,
      typeof globalRef.globalChange24h === "number" ? globalRef.globalChange24h : 0,
    );
    const sjcChange = sjcRow?.change_1d ?? 0;

    return {
      items: [
        {
          label: "Global Gold",
          value: this.formatUsdOz(conversion.globalPriceUsdOz),
          sub: "International benchmark",
          change: conversion.globalChange24h,
        },
        {
          label: "Converted (VND)",
          value: this.formatMillionsVndShort(conversion.equivalentVndPerLuong),
          sub: `Based on ${Math.round(conversion.usdVndRate).toLocaleString("en-US")} VND/USD`,
          change: null,
        },
        {
          label: "SJC Sell Price",
          value: conversion.sjcSellVndPerLuong > 0
            ? this.formatMillionsVndShort(conversion.sjcSellVndPerLuong)
            : "N/A",
          sub: "Domestic benchmark",
          change: this.round2(sjcChange),
        },
        {
          label: "SJC Premium",
          value: conversion.premiumVnd > 0 ? `+${this.formatMillionsVndShort(conversion.premiumVnd)}` : "N/A",
          sub: "Above global equivalent",
          change: null,
          highlight: true,
        },
      ],
      conversion,
      generatedAt: new Date().toISOString(),
    };
  }

  private async getSilverOverview(): Promise<VietnamGoldOverviewResponse> {
    const [globalRef, silverQuote, benchmarkRow] = await Promise.all([
      this.repo.getLatestGlobalReference(),
      this.repo.getGlobalCommodityQuote("xagusd-cur"),
      this.repo.getBrandByCode("BẠC MIẾNG", "silver"),
    ]);

    // USD/VND rate is derived from the gold reference snapshot; silver snapshots don't carry it.
    const usdVndRate = globalRef.usdVndRate && Number.isFinite(globalRef.usdVndRate)
      ? globalRef.usdVndRate
      : DEFAULT_USD_VND;
    const globalPriceUsdOz = silverQuote.price ?? 0;
    const globalChange24h = this.round2(silverQuote.change24h ?? 0);
    const equivalentVndPerLuong = globalPriceUsdOz * usdVndRate * LUONG_PER_OZ;
    const domesticSell = benchmarkRow?.sell_price ?? 0;
    const premiumVnd = domesticSell > 0 && equivalentVndPerLuong > 0 ? domesticSell - equivalentVndPerLuong : 0;

    return {
      items: [
        {
          label: "Global Silver",
          value: globalPriceUsdOz > 0 ? this.formatUsdOz(globalPriceUsdOz, 2) : "N/A",
          sub: "International benchmark",
          change: globalChange24h,
        },
        {
          label: "Converted (VND)",
          value: equivalentVndPerLuong > 0 ? this.formatMillionsVndShort(equivalentVndPerLuong) : "N/A",
          sub: `Based on ${Math.round(usdVndRate).toLocaleString("en-US")} VND/USD`,
          change: null,
        },
        {
          label: "Silver Sell Price",
          value: domesticSell > 0 ? this.formatMillionsVndShort(domesticSell) : "N/A",
          sub: "Domestic benchmark",
          change: this.round2(benchmarkRow?.change_1d ?? 0),
        },
        {
          label: "Silver Premium",
          value: premiumVnd !== 0
            ? `${premiumVnd > 0 ? "+" : ""}${this.formatMillionsVndShort(premiumVnd)}`
            : "N/A",
          sub: premiumVnd >= 0 ? "Above global equivalent" : "Below global equivalent",
          change: null,
          highlight: true,
        },
      ],
      conversion: {
        globalPriceUsdOz,
        globalChange24h,
        usdVndRate,
        equivalentVndPerLuong,
        sjcSellVndPerLuong: domesticSell,
        premiumVnd,
        luongPerOz: LUONG_PER_OZ,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getFeatured(query: VietnamGoldQueryDto): Promise<{ items: VietnamGoldBrandItem[]; generatedAt: string }> {
    const limit = query.limit ?? 8;
    const metalType = query.metalType === "silver" ? "silver" : "gold";
    const rows = await this.repo.getFeaturedBrands(limit, metalType);
    return {
      items: rows.map((x) => this.toItem(x)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getTopMovers(query: VietnamGoldQueryDto): Promise<VietnamGoldTopMoversResponse> {
    const limit = query.limit ?? 4;
    const metalType = query.metalType === "silver" ? "silver" : "gold";
    const [gainers, losers] = await Promise.all([
      this.repo.getTopMovers(limit, -1, metalType),
      this.repo.getTopMovers(limit, 1, metalType),
    ]);
    return {
      gainers: gainers.map((x) => this.toItem(x)),
      losers: losers.map((x) => this.toItem(x)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getAll(query: VietnamGoldQueryDto): Promise<VietnamGoldAssetsResponse> {
    const limit = query.limit ?? 10;
    const page = query.page ?? 1;
    const metalType = query.metalType === "all" ? undefined : (query.metalType === "silver" ? "silver" : "gold");
    const { items, total } = await this.repo.getBrands(
      limit,
      page,
      metalType,
      query.search,
      query.sortBy ?? "sell",
      query.sortDir ?? "desc",
    );
    return {
      items: items.map((x) => this.toItem(x)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getGroups(): Promise<VietnamGoldGroupsResponse> {
    const groups = await this.repo.getGroupLeaders(3);
    return {
      items: groups.map((g) => ({
        group: g.group,
        label: g.group === "silver" ? "Silver" : "Gold",
        count: g.count,
        leaders: g.leaders.map((x) => this.toItem(x)),
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}
