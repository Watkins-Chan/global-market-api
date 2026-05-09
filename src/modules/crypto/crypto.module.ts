import { Module } from "@nestjs/common";
import { CryptoController } from "./crypto.controller";
import { CryptoRepository } from "./crypto.repository";
import { CryptoService } from "./crypto.service";

@Module({
  controllers: [CryptoController],
  providers: [CryptoRepository, CryptoService],
})
export class CryptoModule {}
