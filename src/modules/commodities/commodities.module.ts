import { Module } from "@nestjs/common";
import { CommoditiesController } from "./commodities.controller";
import { CommoditiesRepository } from "./commodities.repository";
import { CommoditiesService } from "./commodities.service";

@Module({
  controllers: [CommoditiesController],
  providers: [CommoditiesRepository, CommoditiesService],
})
export class CommoditiesModule {}
