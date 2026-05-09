import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

function toInt(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : value;
}

export class CommoditiesQueryDto {
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  group?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsIn(["price", "day", "week", "month", "ytd", "volume"])
  sortBy?: "price" | "day" | "week" | "month" | "ytd" | "volume";

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
