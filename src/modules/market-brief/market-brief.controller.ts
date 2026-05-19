import { Controller, Get } from "@nestjs/common";
import { MarketBriefService } from "./market-brief.service";
import { MarketBriefResponse } from "./market-brief.types";

@Controller("market-brief")
export class MarketBriefController {
  constructor(private readonly service: MarketBriefService) {}

  @Get()
  getBrief(): Promise<MarketBriefResponse> {
    return this.service.getBrief();
  }
}
