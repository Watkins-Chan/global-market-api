import { Module } from "@nestjs/common";
import { TwelveDataService } from "./providers/twelve-data.service";
import { StockDetailController } from "./stock-detail.controller";
import { StockDetailRepository } from "./stock-detail.repository";
import { StockDetailService } from "./stock-detail.service";

@Module({
  controllers: [StockDetailController],
  providers: [StockDetailRepository, StockDetailService, TwelveDataService],
  exports: [StockDetailService],
})
export class StockDetailModule {}
