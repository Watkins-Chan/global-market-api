import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import type { HomeMarketType } from "../home.types";

function toInt(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : value;
}

export class HomeSectionQueryDto {
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsIn(["stock", "crypto", "commodity", "gold"])
  market?: HomeMarketType;
}
