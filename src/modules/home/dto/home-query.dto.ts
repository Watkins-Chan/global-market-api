import { Transform } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

function toInt(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : value;
}

export class HomeQueryDto {
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(20)
  newsLimit?: number;
}
