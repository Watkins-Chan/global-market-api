import { Module } from "@nestjs/common";
import { TwelveDataService } from "../stock-detail/providers/twelve-data.service";
import { CryptoDetailController } from "./crypto-detail.controller";
import { CryptoDetailRepository } from "./crypto-detail.repository";
import { CryptoDetailService } from "./crypto-detail.service";

@Module({
  controllers: [CryptoDetailController],
  providers: [CryptoDetailRepository, CryptoDetailService, TwelveDataService],
  exports: [CryptoDetailService],
})
export class CryptoDetailModule {}
