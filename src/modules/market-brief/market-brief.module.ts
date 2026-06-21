import { Module } from "@nestjs/common";
import { HomeModule } from "../home/home.module";
import { NewsModule } from "../news/news.module";
import { VietnamGoldModule } from "../vietnam-gold/vietnam-gold.module";
import { MarketBriefController } from "./market-brief.controller";
import { MarketBriefService } from "./market-brief.service";

@Module({
  imports: [HomeModule, VietnamGoldModule, NewsModule],
  controllers: [MarketBriefController],
  providers: [MarketBriefService],
})
export class MarketBriefModule {}
