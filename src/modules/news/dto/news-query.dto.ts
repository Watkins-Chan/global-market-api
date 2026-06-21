import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

function toInt(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : value;
}

function normalizeMarket(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const v = value.trim().toLowerCase();
  if (v === "stocks") return "stock";
  if (v === "commodities") return "commodity";
  if (v === "cryptos") return "crypto";
  return v;
}

export class NewsQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeMarket(value))
  @IsIn(["all", "stock", "crypto", "commodity"])
  market?: "all" | "stock" | "crypto" | "commodity";

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  tag?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;
}

export class NewsTagsQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeMarket(value))
  @IsIn(["all", "stock", "crypto", "commodity"])
  market?: "all" | "stock" | "crypto" | "commodity";

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
