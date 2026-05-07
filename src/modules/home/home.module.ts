import { Module } from "@nestjs/common";
import { HomeController } from "./home.controller";
import { HomeRepository } from "./home.repository";
import { HomeService } from "./home.service";

@Module({
  controllers: [HomeController],
  providers: [HomeRepository, HomeService],
})
export class HomeModule {}
