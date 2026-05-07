import { Module } from "@nestjs/common";
import { StocksController } from "./stocks.controller";
import { StocksRepository } from "./stocks.repository";
import { StocksService } from "./stocks.service";

@Module({
  controllers: [StocksController],
  providers: [StocksRepository, StocksService],
})
export class StocksModule {}
