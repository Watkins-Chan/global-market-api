import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString } from "class-validator";

export class CryptoDetailChartQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsIn(["1D", "7D", "30D", "90D", "1Y", "MAX"])
  timeframe?: "1D" | "7D" | "30D" | "90D" | "1Y" | "MAX";

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsString()
  exchange?: string;
}
