import { Module } from "@nestjs/common";
import { TwelveDataService } from "../stock-detail/providers/twelve-data.service";
import { CommodityDetailController } from "./commodity-detail.controller";
import { CommodityDetailRepository } from "./commodity-detail.repository";
import { CommodityDetailService } from "./commodity-detail.service";

@Module({
  controllers: [CommodityDetailController],
  providers: [CommodityDetailRepository, CommodityDetailService, TwelveDataService],
  exports: [CommodityDetailService],
})
export class CommodityDetailModule {}
