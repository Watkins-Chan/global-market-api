import { Module } from "@nestjs/common";
import { VietnamGoldController } from "./vietnam-gold.controller";
import { VietnamGoldRepository } from "./vietnam-gold.repository";
import { VietnamGoldService } from "./vietnam-gold.service";

@Module({
  controllers: [VietnamGoldController],
  providers: [VietnamGoldService, VietnamGoldRepository],
})
export class VietnamGoldModule {}
