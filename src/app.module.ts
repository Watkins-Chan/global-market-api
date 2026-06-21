import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/validate-env";
import { MongoModule } from "./infrastructure/database/mongo.module";
import { HealthModule } from "./modules/health/health.module";
import { HomeModule } from "./modules/home/home.module";
import { StocksModule } from "./modules/stocks/stocks.module";
import { StockDetailModule } from "./modules/stock-detail/stock-detail.module";
import { CryptoModule } from "./modules/crypto/crypto.module";
import { CryptoDetailModule } from "./modules/crypto-detail/crypto-detail.module";
import { CommoditiesModule } from "./modules/commodities/commodities.module";
import { CommodityDetailModule } from "./modules/commodity-detail/commodity-detail.module";
import { VietnamGoldModule } from "./modules/vietnam-gold/vietnam-gold.module";
import { MarketBriefModule } from "./modules/market-brief/market-brief.module";
import { ScreenerModule } from "./modules/screener/screener.module";
import { NewsModule } from "./modules/news/news.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    MongoModule,
    HealthModule,
    HomeModule,
    StocksModule,
    StockDetailModule,
    CryptoModule,
    CryptoDetailModule,
    CommoditiesModule,
    CommodityDetailModule,
    VietnamGoldModule,
    MarketBriefModule,
    ScreenerModule,
    NewsModule,
  ],
})
export class AppModule {}
