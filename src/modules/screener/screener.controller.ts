import { Controller, Get, Query } from "@nestjs/common";
import { ScreenerQueryDto } from "./dto/screener-query.dto";
import { ScreenerService } from "./screener.service";
import { ScreenerResponse } from "./screener.types";

@Controller("screener")
export class ScreenerController {
  constructor(private readonly service: ScreenerService) {}

  @Get()
  getScreener(@Query() query: ScreenerQueryDto): Promise<ScreenerResponse> {
    return this.service.getScreener(query);
  }
}
