import { Module } from "@nestjs/common";
import { ScreenerModule } from "../screener/screener.module";
import { StockDetailModule } from "../stock-detail/stock-detail.module";
import { CryptoDetailModule } from "../crypto-detail/crypto-detail.module";
import { CommodityDetailModule } from "../commodity-detail/commodity-detail.module";
import { CompareController } from "./compare.controller";
import { CompareService } from "./compare.service";

@Module({
  imports: [ScreenerModule, StockDetailModule, CryptoDetailModule, CommodityDetailModule],
  controllers: [CompareController],
  providers: [CompareService],
})
export class CompareModule {}
