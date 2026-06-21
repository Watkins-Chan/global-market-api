import { Module } from "@nestjs/common";
import { ScreenerController } from "./screener.controller";
import { ScreenerRepository } from "./screener.repository";
import { ScreenerService } from "./screener.service";

@Module({
  controllers: [ScreenerController],
  providers: [ScreenerRepository, ScreenerService],
  exports: [ScreenerRepository],
})
export class ScreenerModule {}
