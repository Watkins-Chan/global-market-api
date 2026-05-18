import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/validate-env";
import { MongoModule } from "./infrastructure/database/mongo.module";
import { HealthModule } from "./modules/health/health.module";
import { HomeModule } from "./modules/home/home.module";
import { StocksModule } from "./modules/stocks/stocks.module";
import { CryptoModule } from "./modules/crypto/crypto.module";
import { CommoditiesModule } from "./modules/commodities/commodities.module";
import { VietnamGoldModule } from "./modules/vietnam-gold/vietnam-gold.module";

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
    CryptoModule,
    CommoditiesModule,
    VietnamGoldModule,
  ],
})
export class AppModule {}
