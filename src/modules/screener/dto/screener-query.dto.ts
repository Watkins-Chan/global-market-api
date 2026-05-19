import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

function toInt(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : value;
}

export class ScreenerQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsIn(["stock", "crypto", "commodity", "gold"])
  market?: "stock" | "crypto" | "commodity" | "gold";

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsIn(["any", "gainers", "losers"])
  change?: "any" | "gainers" | "losers";

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsIn(["name", "symbol", "price", "change24h", "week", "month", "year", "marketCap", "rank"])
  sortBy?: "name" | "symbol" | "price" | "change24h" | "week" | "month" | "year" | "marketCap" | "rank";

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
